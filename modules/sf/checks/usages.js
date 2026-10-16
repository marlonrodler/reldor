'use strict';

/**
 * Where is something used? Accepts: a class ("AccountsService"), a method ("AccountsService.calcularScore"),
 * a field ("Score__c" or "Account.Score__c"), a flow name or an object name.
 * Each hit has a certainty: "certo", "provável" or "possível" (name found only inside a text string).
 */
function findUsages(model, query) {
  const hits = [];
  const add = (where, name, how, certainty = 'certo') => hits.push({ where, name, how, certainty });
  const q = String(query).trim();
  const [left, right] = q.includes('.') ? q.split('.', 2) : [null, q];

  const isClass = Boolean(model.classes[q]) || (left && Boolean(model.classes[left]) && !right.endsWith('__c'));
  const isFlow = Boolean(model.flows[q]);
  const isObject = !left && Boolean(model.objects[q]) && !isClass;
  const isField = !isObject && (/__c$/i.test(right) || Boolean(left && model.objects[left] && !model.classes[left]));

  if (isClass) {
    const cls = left && model.classes[left] ? left : q;
    const method = left && model.classes[left] ? right : null;
    const iface = Object.entries(model.application.services).find(([, impl]) => impl === cls)?.[0];
    const aliases = new Set([cls, iface].filter(Boolean));

    for (const c of Object.values(model.classes)) {
      if (c.name === cls || (iface && c.kinds.includes('application'))) continue;
      const refers = c.identifiers.some((id) => aliases.has(id)) || c.classRefs.some((id) => aliases.has(id));
      if (method) {
        if (c.calls.some((call) => aliases.has(call.split('.')[0]) && call.endsWith(`.${method}`))) add('Apex', c.name, `chama ${q}`);
        else if (refers && c.invoked.includes(method)) add('Apex', c.name, `usa ${iface || cls} e chama .${method}()`, 'provável');
      } else if (refers) {
        add('Apex', c.name, c.isTest ? 'classe de teste' : `referencia ${[...aliases].filter((a) => c.identifiers.includes(a) || c.classRefs.includes(a)).join(', ')}`);
      }
      if (!refers && c.strings.includes(cls)) add('Apex', c.name, `nome em texto (ex.: Type.forName)`, 'possível');
    }
    for (const t of Object.values(model.triggers)) if (t.identifiers.includes(cls) || t.classRefs.includes(cls)) add('Trigger', t.name, `referencia ${cls}`);
    for (const f of Object.values(model.flows)) if (f.apexActions.includes(cls)) add('Flow', f.name, 'ação Apex (@InvocableMethod)');
    for (const [name, l] of Object.entries(model.lwc)) {
      for (const a of l.apex || []) if (a === q || (!method && a.startsWith(`${cls}.`))) add('LWC', name, `importa ${a}`);
    }
    if (iface && !method) add('Application', 'Application', `fábrica: ${iface} → ${cls}`);
  }

  if (isField) {
    const field = right;
    const object = left && model.objects[left] ? left : null;
    const sameField = (ref) => ref.split('.').pop().toLowerCase() === field.toLowerCase();
    const exact = (ref) => object && ref.toLowerCase() === `${object}.${field}`.toLowerCase();

    for (const o of Object.values(model.objects)) {
      if (object && o.name !== object) {
        for (const f of Object.values(o.fields)) if (f.formulaRefs.some(exact)) add('Fórmula', `${o.name}.${f.name}`, 'fórmula usa o campo');
        continue;
      }
      for (const v of o.validationRules) if (v.refs.some(sameField)) add('Validation rule', `${o.name}.${v.name}`, v.active ? 'condição usa o campo' : 'condição usa o campo (inativa)');
      for (const f of Object.values(o.fields)) {
        if (f.formulaRefs.some(sameField)) add('Fórmula', `${o.name}.${f.name}`, 'fórmula usa o campo');
        if (f.summary && f.summary.field && sameField(f.summary.field)) add('Roll-up', `${o.name}.${f.name}`, 'resume o campo');
      }
      if (o.workflow) for (const u of o.workflow.fieldUpdates) if (sameField(u.field)) add('Workflow', `${o.name}.${u.name}`, 'atualização de campo');
    }
    for (const c of Object.values(model.classes)) {
      const inSoql = c.soql.some((s) => (!object || s.object === object) && s.fields.some(sameField));
      const inSelector = (c.selectorFields || []).some((f) => (object ? exact(f) : sameField(f)));
      const inCode = c.fieldRefs.some((r) => (object ? exact(r) : sameField(r)));
      const inCodeLoose = object && !inCode && c.fieldRefs.some(sameField);
      if (inSelector) add('Selector', c.name, 'lista de campos (getSObjectFieldList)');
      if (inSoql) add('Apex', c.name, 'consulta (SOQL)');
      if (inCode && !inSelector) add('Apex', c.name, c.isTest ? 'classe de teste' : 'lê ou grava o campo');
      else if (inCodeLoose && !inSoql) add('Apex', c.name, 'usa um campo com esse nome', 'provável');
    }
    for (const f of Object.values(model.flows)) {
      if (object && f.object && f.object !== object) continue;
      if (f.fieldsWritten.some(sameField)) add('Flow', f.name, 'grava o campo');
      if (f.filters.some((x) => x.field && sameField(x.field)) || (f.filterFormula && f.filterFormula.includes(field))) add('Flow', f.name, 'critério de entrada');
    }
    for (const [name, l] of Object.entries(model.lwc)) {
      for (const s of l.schema || []) if (object ? exact(s) : sameField(s)) add('LWC', name, `importa ${s}`);
    }
  }

  if (isFlow) {
    for (const f of Object.values(model.flows)) if (f.subflows.includes(q)) add('Flow', f.name, 'chama como subflow');
  }

  if (isObject) {
    const o = model.objects[q];
    for (const t of o.triggers) add('Trigger', t, 'trigger do objeto');
    for (const timing of ['before', 'after', 'process']) for (const f of o.flows[timing]) add('Flow', f, `flow ${timing}`);
    for (const c of o.queriedBy) add('Apex', c, 'consulta (SOQL)');
    for (const c of o.writtenBy) add('Apex', c, 'grava (DML)');
    for (const s of o.selectors) add('Selector', s, 'selector do objeto');
    for (const l of o.lwcs) add('LWC', l, 'usa campos do objeto');
    for (const r of o.rollupsTo) add('Roll-up', `${r.parent}.${r.field}`, 'resume registros deste objeto');
  }

  const seen = new Set();
  return hits.filter((h) => {
    const key = `${h.where}|${h.name}|${h.how}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderUsages(query, hits) {
  if (!hits.length) return [`\n🛡️  Não encontrei usos de ${query} no projeto.`, '', 'ℹ️  Isso cobre o código do repositório. Algo criado direto na org não aparece aqui.'];
  const order = { certo: 0, 'provável': 1, 'possível': 2 };
  const out = [`\n🛡️  ${query} é usado em ${hits.length} lugar(es):`, ''];
  for (const h of [...hits].sort((a, b) => order[a.certainty] - order[b.certainty])) {
    const tag = h.certainty === 'certo' ? '' : ` (${h.certainty})`;
    out.push(`• ${h.where.padEnd(15)} ${h.name} — ${h.how}${tag}`);
  }
  if (hits.some((h) => h.certainty !== 'certo')) out.push('', '⚠️ Itens "provável" e "possível" precisam de conferência manual.');
  return out;
}

module.exports = { findUsages, renderUsages };

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
        const call = c.calls.find((x) => aliases.has(x.split('.')[0]) && x.toLowerCase().endsWith(`.${method.toLowerCase()}`));
        if (call) add('Apex', c.name, call.split('.')[0] === cls ? `chama ${q}` : `chama ${call} (a fábrica Application liga ${iface} a ${cls})`);
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
    if (!method) for (const p of model.permissions) if (p.classes.includes(cls)) add(p.kind, p.name, 'dá acesso à classe');
    if (!method) {
      for (const [type, records] of Object.entries(model.customMetadata)) {
        for (const r of records) if (Object.values(r.values).map(String).includes(cls)) add('Custom metadata', `${type}.${r.name}`, 'registro aponta para a classe');
      }
    }
  }

  if (isField) {
    const field = right;
    const object = left ? require('./fieldresolve').objectName(model, left) : null;

    // Code and flows: every reference carries the object it belongs to (see indexer/fieldrefs.js).
    const { resolveFieldRef } = require('./fieldresolve');
    const elsewhere = [];
    const consider = (where, name, refs, screen, isTest, owner = null) => {
      const mine = [];
      const unsure = [];
      for (const r of refs || []) {
        if (!require('./dynamicfields').sameField(model, r.field, field)) continue;
        const res = resolveFieldRef(model, r, screen, owner);
        if (res.objectMention) {
          elsewhere.push({ where, name, object: res.prose ? 'mensagem de texto' : `${r.field} (o objeto)`, how: res.prose ? 'o campo só aparece numa frase (mensagem), não é um uso' : 'o texto é o nome do objeto, não um campo', line: r.line });
          continue;
        }
        if (!object) mine.push(res);
        else if (res.object && res.object.toLowerCase() === object.toLowerCase()) mine.push(res);
        else if (res.object) elsewhere.push({ where, name, object: res.object, how: res.how, line: r.line });
        else if (!res.candidates.length || res.candidates.some((o) => o.toLowerCase() === object.toLowerCase())) unsure.push({ ...res, line: r.line });
        else elsewhere.push({ where, name, object: res.candidates.join(' ou '), how: res.how, line: r.line });
      }
      if (mine.length) {
        const hows = [...new Set(mine.map((x) => x.how))];
        const prefix = isTest ? 'classe de teste: ' : '';
        add(where, name, `${prefix}${hows.slice(0, 3).join('; ')}${hows.length > 3 ? `; e mais ${hows.length - 3}` : ''}`);
      } else if (unsure.length) {
        const u = unsure[0];
        const cands = u.candidates.length > 1 ? ` — pode ser de ${u.candidates.join(', ')}` : '';
        add(where, name, `não dá para saber o objeto: ${u.how}${u.line ? ` (linha ${u.line})` : ''}${cands}`, 'possível');
      }
    };
    // Formulas, validation rules, roll-ups and workflow field updates, with the same resolution as code:
    // Parent__r.Field__c in a rule of Child__c is Field__c of the parent object.
    const formulaUses = (o, list, how) => list
      .filter((r) => !r.startsWith('$') && /__c$/i.test(r.split('.').pop()))
      .map((r) => ({ field: r.split('.').pop(), base: o.name, path: r.split('.'), how }));
    for (const o of Object.values(model.objects)) {
      for (const v of o.validationRules) consider('Validation rule', `${o.name}.${v.name}`, formulaUses(o, v.refs, v.active ? 'condição usa o campo' : 'condição usa o campo (inativa)'));
      for (const f of Object.values(o.fields)) {
        consider('Fórmula', `${o.name}.${f.name}`, formulaUses(o, f.formulaRefs || [], 'fórmula usa o campo'));
        if (f.summary && f.summary.field) {
          const [child, fld] = f.summary.field.includes('.') ? f.summary.field.split('.') : [null, f.summary.field];
          consider('Roll-up', `${o.name}.${f.name}`, [{ field: fld, base: child, path: [fld], how: 'resume o campo' }]);
        }
      }
      if (o.workflow && o.workflow.fieldUses) consider('Workflow', o.name, o.workflow.fieldUses);
      else if (o.workflow) for (const u of o.workflow.fieldUpdates) if (u.field) consider('Workflow', `${o.name}.${u.name}`, [{ field: u.field.split('.').pop(), base: o.name, path: u.field.split('.'), how: 'atualização de campo' }]);
    }
    for (const c of Object.values(model.classes)) {
      consider((c.kinds || []).includes('selector') ? 'Selector' : 'Apex', c.name, c.fieldUses, null, c.isTest, c);
    }
    for (const t of Object.values(model.triggers)) consider('Trigger', t.name, t.fieldUses, null, false);
    for (const f of Object.values(model.flows)) consider('Flow', f.name, f.fieldUses, null, false);
    for (const sc of Object.values(model.screens || {})) consider(sc.kind, sc.name, sc.refs, sc, false);
    // Other metadata: layouts, permissions, record types, reports, record pages, quick actions, field sets...
    const UI_LABEL = { layout: 'Layout', listView: 'List view', compactLayout: 'Compact layout' };
    for (const u of model.ui) if (u.fieldUses) consider(UI_LABEL[u.kind], u.name, u.fieldUses, null, false);
    for (const p of model.permissions) if (p.fieldUses) consider(p.kind, p.name, p.fieldUses, null, false);
    for (const o of Object.values(model.objects)) for (const rt of o.recordTypes || []) if (rt.fieldUses) consider('Record type', `${o.name}.${rt.name}`, rt.fieldUses, null, false);
    for (const m of Object.values(model.meta || {})) consider(m.where, m.name, m.fieldUses, null, false);
    for (const [type, records] of Object.entries(model.customMetadata)) for (const r of records) if (r.fieldUses) consider('Custom metadata', `${type.replace(/__mdt$/, '')}.${r.name}`, r.fieldUses, null, false);
    hits.elsewhere = elsewhere;
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
  const out = hits.filter((h) => {
    const key = `${h.where}|${h.name}|${h.how}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  out.elsewhere = hits.elsewhere || [];
  return out;
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

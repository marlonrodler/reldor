'use strict';

/**
 * Reldor's own security rules. Each rule reads one file's text and returns findings:
 * { rule, severity: 'alta' | 'média' | 'baixa', line, message, fix }.
 * They are heuristics: precise enough to point at the line, explained so a person can judge.
 */
const { stripApex, blockAfter } = require('../indexer/apex');

const DEFAULT_SENSITIVE = ['cpf', 'cnpj', 'rg', 'senha', 'password', 'token', 'secret', 'cartao', 'card', 'cvv', 'saldo', 'balance', 'agencia', 'contacorrente', 'iban', 'ssn', 'renda', 'salario'];

function lineAt(text, index) {
  return text.slice(0, index).split('\n').length;
}

/** Same length as the original, so indexes still point at the right line. */
function maskComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

/** Methods with their annotations: { name, annotations, start, body }. */
function methodsOf(code) {
  const out = [];
  const re = /((?:@\w+(?:\([^)]*\))?\s*)*)\b(?:(?:public|private|protected|global|static|override|virtual|webservice)\s+)+[\w<>,.\s]+?\s+(\w+)\s*\(([^)]*)\)\s*\{/gi;
  let m;
  while ((m = re.exec(code))) {
    const params = m[3].split(',').map((p) => p.trim().split(/\s+/).pop()).filter(Boolean);
    const body = blockAfter(code, m.index);
    out.push({ name: m[2], annotations: m[1] || '', start: m.index, length: m[0].length + body.length + 1, body, params });
  }
  return out;
}

function entryPoint(code) {
  return /@AuraEnabled|@RestResource|\bwebservice\b|@InvocableMethod|@RemoteAction/i.test(code);
}

const APEX_RULES = [
  function soqlInjection(text, code) {
    const out = [];
    const methods = methodsOf(code);
    for (const m of code.matchAll(/Database\.(?:query|queryWithBinds|countQuery|getQueryLocator)\s*\(([\s\S]*?)\)\s*;/gi)) {
      const method = methods.find((x) => m.index > x.start && m.index < x.start + x.length);
      if (!method || /escapeSingleQuotes/.test(method.body)) continue;
      // Values that come from outside the method: its parameters, and variables assigned from them (one hop).
      const tainted = new Set(method.params);
      for (const a of method.body.matchAll(/\b(\w+)\s*(?:\+?=)\s*([^;]+);/g)) {
        if ([...tainted].some((t) => new RegExp(`\\b${t}\\b`).test(a[2]))) tainted.add(a[1]);
      }
      const concatenated = (expr) => [...expr.matchAll(/\+\s*([A-Za-z_][\w.]*)|([A-Za-z_][\w.]*)\s*\+/g)].map((x) => (x[1] || x[2]).split('.')[0]);
      let names = concatenated(m[1]);
      const variable = /^\s*(\w+)\s*$/.exec(m[1]);
      if (variable) {
        for (const a of method.body.matchAll(new RegExp(`\\b${variable[1]}\\s*(?:\\+?=)\\s*([^;]+);`, 'g'))) names = names.concat(concatenated(a[1]), /^\s*\w+\s*$/.test(a[1]) ? [a[1].trim()] : []);
      }
      const hit = names.find((n) => tainted.has(n));
      if (!hit) continue;
      out.push({
        rule: 'soql-injection',
        severity: 'alta',
        line: lineAt(text, m.index),
        message: `Query dinâmica concatena "${hit}", que vem de fora do método: risco de SOQL injection.`,
        fix: 'Use bind (:variavel) com Database.queryWithBinds, ou String.escapeSingleQuotes() em todo valor vindo do usuário.',
      });
    }
    return out;
  },

  function crudFls(text, code) {
    const out = [];
    const classLevelRest = /@RestResource/i.test(code);
    for (const m of methodsOf(code)) {
      if (/SuppressWarnings\([^)]*ApexCRUDViolation/i.test(m.annotations)) continue;
      const exposed = /@AuraEnabled|@RemoteAction|@InvocableMethod/i.test(m.annotations) || (classLevelRest && /@Http(Get|Post|Put|Patch|Delete)/i.test(m.annotations)) || /\bwebservice\b/i.test(code.slice(m.start, m.start + 120));
      if (!exposed) continue;
      const original = text.slice(m.start, m.start + m.length);
      const guarded = /USER_MODE|SECURITY_ENFORCED|stripInaccessible|isAccessible\(\)|isCreateable\(\)|isUpdateable\(\)|isDeletable\(\)|\bas\s+user\b/i.test(original);
      if (guarded) continue;
      const soql = /\[\s*SELECT\b|Database\.query/i.test(m.body);
      const dml = /\b(insert|update|upsert|delete)\s+\w+\s*;|Database\.(insert|update|upsert|delete)\s*\(/i.test(m.body);
      if (!soql && !dml) continue;
      out.push({
        rule: 'crud-fls',
        severity: 'alta',
        line: lineAt(text, m.start),
        message: `${m.name} é chamado de fora (tela, API ou flow) e ${soql && dml ? 'lê e grava' : soql ? 'lê' : 'grava'} dados sem checar permissão de objeto e campo.`,
        fix: 'Use WITH USER_MODE na SOQL, "insert as user" / AccessLevel.USER_MODE no DML, ou Security.stripInaccessible().',
      });
    }
    return out;
  },

  function sharing(text, code, ctx) {
    const out = [];
    const decl = /\b((?:public|global)\s+(?:(?:virtual|abstract)\s+)?)((?:with|without|inherited)\s+sharing\s+)?class\s+(\w+)/i.exec(code);
    if (!decl || /@isTest/i.test(code)) return out;
    const keyword = (decl[2] || '').trim().toLowerCase();
    const exposed = entryPoint(code);
    if (!keyword && exposed) {
      out.push({ rule: 'sharing', severity: 'alta', line: lineAt(text, decl.index), message: `${decl[3]} é chamada de fora e não declara sharing: roda sem respeitar o compartilhamento do usuário.`, fix: 'Declare "with sharing" (ou "inherited sharing" para utilitários).' });
    } else if (keyword.startsWith('without') && exposed) {
      out.push({ rule: 'sharing', severity: 'alta', line: lineAt(text, decl.index), message: `${decl[3]} é "without sharing" e é chamada de fora (tela, API ou flow).`, fix: 'Use "with sharing" na classe exposta e isole só o trecho que precisa ver tudo numa classe interna "without sharing", com comentário do porquê.' });
    } else if (!keyword && ctx.strictSharing) {
      out.push({ rule: 'sharing', severity: 'baixa', line: lineAt(text, decl.index), message: `${decl[3]} não declara sharing.`, fix: 'Declare "inherited sharing" ou "with sharing".' });
    }
    return out;
  },

  function sensitiveDebug(text, code, ctx) {
    const out = [];
    const terms = ctx.sensitiveTerms;
    for (const m of code.matchAll(/System\.debug\s*\(([^;]*)\)\s*;/gi)) {
      const arg = m[1].toLowerCase().replace(/[^a-z0-9_.]/g, ' ');
      const hit = terms.find((t) => new RegExp(`(^|[\\s._])${t}`).test(arg));
      if (!hit) continue;
      out.push({ rule: 'dado-sensivel-no-log', severity: 'média', line: lineAt(text, m.index), message: `System.debug pode gravar dado sensível no log (${hit}). Logs ficam visíveis para quem tem acesso à org (LGPD).`, fix: 'Remova o debug ou mascare o valor antes de logar.' });
    }
    return out;
  },

  function secrets(text) {
    const out = [];
    for (const m of text.matchAll(/'([^'\n]*)'/g)) {
      const s = m[1];
      if (/^(Bearer|Basic)\s+[A-Za-z0-9+/=._-]{12,}$/.test(s) || /(password|senha|secret|api[_-]?key|client_secret|token)\s*[=:]\s*[^\s]{4,}/i.test(s)) {
        out.push({ rule: 'segredo-no-codigo', severity: 'alta', line: lineAt(text, m.index), message: 'Credencial ou token escrito no código.', fix: 'Use Named Credential / External Credential, ou Custom Metadata protegido. Troque a credencial exposta.' });
      }
    }
    for (const m of text.matchAll(/setEndpoint\s*\(\s*'(https?:\/\/[^']+)'/gi)) {
      const http = m[1].startsWith('http://');
      out.push({ rule: http ? 'callout-sem-tls' : 'endpoint-fixo', severity: http ? 'alta' : 'média', line: lineAt(text, m.index), message: http ? 'Callout por http:// (sem criptografia).' : 'Endpoint fixo no código.', fix: 'Use Named Credential (setEndpoint(\'callout:Nome/...\')), com https.' });
    }
    return out;
  },

  function weakCrypto(text) {
    const out = [];
    for (const m of maskComments(text).matchAll(/Crypto\.generateDigest\s*\(\s*'(MD5|SHA1)'/gi)) {
      out.push({ rule: 'cripto-fraca', severity: 'média', line: lineAt(text, m.index), message: `Hash ${m[1]} é considerado fraco.`, fix: "Use 'SHA-256' ou 'SHA-512'; para senha ou assinatura, use Crypto.generateMac / sign." });
    }
    return out;
  },

  function hardcodedIds(text) {
    const out = [];
    for (const m of text.matchAll(/'((?:001|003|005|006|00G|00e|012|00Q|500|a0[0-9A-Za-z])[0-9A-Za-z]{12}(?:[0-9A-Za-z]{3})?)'/g)) {
      out.push({ rule: 'id-fixo', severity: 'baixa', line: lineAt(text, m.index), message: `ID de registro fixo (${m[1]}): muda de uma org para outra.`, fix: 'Busque pelo nome (DeveloperName) ou guarde em Custom Metadata.' });
    }
    return out;
  },
];

function scanApex(text, ctx) {
  const masked = maskComments(text);
  const code = masked.replace(/'(?:\\.|[^'\\])*'/g, (m) => `'${' '.repeat(Math.max(0, m.length - 2))}'`);
  return APEX_RULES.flatMap((rule) => rule(text, code, ctx));
}

function scanLwc(text) {
  const out = [];
  const checks = [
    [/\.innerHTML\s*=/g, 'alta', 'innerHTML recebe conteúdo: risco de XSS se vier do usuário.', 'Use template com {variavel} ou textContent.'],
    [/\beval\s*\(|new\s+Function\s*\(/g, 'alta', 'Código executado a partir de texto (eval/Function).', 'Remova; não há uso seguro em componente.'],
    [/lwc:dom\s*=\s*"manual"/g, 'média', 'lwc:dom="manual" permite inserir HTML fora do controle do LWC.', 'Confira se o conteúdo inserido nunca vem do usuário sem tratamento.'],
    [/document\.write\s*\(/g, 'média', 'document.write.', 'Use o template do componente.'],
  ];
  for (const [re, severity, message, fix] of checks) for (const m of text.matchAll(re)) out.push({ rule: 'lwc-xss', severity, line: lineAt(text, m.index), message, fix });
  return out;
}

function scanVisualforce(text) {
  const out = [];
  for (const m of text.matchAll(/escape\s*=\s*"false"/gi)) out.push({ rule: 'vf-xss', severity: 'alta', line: lineAt(text, m.index), message: 'escape="false" mostra HTML sem tratamento: risco de XSS.', fix: 'Remova escape="false" ou trate com HTMLENCODE.' });
  for (const m of text.matchAll(/<script[\s\S]*?<\/script>/gi)) {
    for (const v of m[0].matchAll(/\{!(?!\s*(?:JSENCODE|JSINHTMLENCODE|URLFOR|\$))([^}]+)\}/gi)) out.push({ rule: 'vf-xss', severity: 'média', line: lineAt(text, m.index + v.index), message: `Merge field {!${v[1].trim()}} dentro de <script> sem JSENCODE.`, fix: 'Use {!JSENCODE(...)}.' });
  }
  return out;
}

function scanFlow(text) {
  const out = [];
  const mode = /<runInMode>(\w+)<\/runInMode>/.exec(text);
  if (mode && mode[1] === 'SystemModeWithoutSharing') {
    const screen = /<processType>Flow<\/processType>/.test(text);
    out.push({ rule: 'flow-sem-sharing', severity: screen ? 'alta' : 'média', line: lineAt(text, mode.index), message: `Flow roda em "System Mode Without Sharing"${screen ? ' e é uma tela (screen flow)' : ''}: ignora permissões e compartilhamento do usuário.`, fix: 'Use "System Mode With Sharing" ou "User Mode", a menos que seja realmente necessário (e documente o porquê).' });
  }
  return out;
}

function scanProfile(text) {
  const out = [];
  if (!/<userLicense>[^<]*Guest[^<]*<\/userLicense>/i.test(text)) return out;
  for (const m of text.matchAll(/<objectPermissions>([\s\S]*?)<\/objectPermissions>/g)) {
    const obj = /<object>([^<]+)<\/object>/.exec(m[1]);
    const risky = ['allowEdit', 'allowDelete', 'viewAllRecords', 'modifyAllRecords'].filter((p) => new RegExp(`<${p}>true</${p}>`).test(m[1]));
    if (risky.length) out.push({ rule: 'convidado-com-acesso', severity: 'alta', line: lineAt(text, m.index), message: `Profile de usuário convidado (site público) com ${risky.join(', ')} em ${obj ? obj[1] : 'um objeto'}.`, fix: 'Usuário convidado deve ter só leitura do mínimo necessário, com sharing rules de convidado.' });
  }
  return out;
}

/** Picks the scanner by file name. Returns findings, each with the file. */
function scanFile(file, text, ctx = {}) {
  const context = { sensitiveTerms: ctx.sensitiveTerms || DEFAULT_SENSITIVE, strictSharing: Boolean(ctx.strictSharing) };
  let findings = [];
  if (/\.(cls|trigger)$/i.test(file)) findings = scanApex(text, context);
  else if (/(^|[\\/])lwc[\\/].+\.(js|html)$/i.test(file) && !/__tests__/.test(file)) findings = scanLwc(text);
  else if (/\.(page|component)$/i.test(file)) findings = scanVisualforce(text);
  else if (/\.flow-meta\.xml$/i.test(file)) findings = scanFlow(text);
  else if (/\.profile-meta\.xml$/i.test(file)) findings = scanProfile(text);
  // "// reldor-ignore: <rule>" (or "reldor-ignore: all") on the line or the line above silences a finding.
  const lines = text.split('\n');
  const ignored = (f) => [lines[f.line - 1], lines[f.line - 2]].some((l) => l && new RegExp(`reldor-ignore:\\s*(all|${f.rule})`).test(l));
  return findings.filter((f) => !ignored(f)).map((f) => ({ ...f, file, source: 'reldor' }));
}

function isScannable(file) {
  return /\.(cls|trigger|page|component)$/i.test(file) || /\.flow-meta\.xml$/i.test(file) || /\.profile-meta\.xml$/i.test(file) || (/(^|[\\/])lwc[\\/].+\.(js|html)$/i.test(file) && !/__tests__/.test(file));
}

module.exports = { scanFile, isScannable, DEFAULT_SENSITIVE, methodsOf };

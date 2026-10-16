'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline/promises');
const snapshotApi = require('../git/snapshot');
const gitApi = require('../git');
const { logAction } = require('../log');
const { print, printJson } = require('../report');
const { run } = require('../util/exec');

async function confirm(question, flags) {
  if (flags.yes || !process.stdin.isTTY) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^s/i.test((await rl.question(`${question} (s/n): `)).trim());
  } finally {
    rl.close();
  }
}

function snapshotCommand(root, flags) {
  if (!gitApi.isRepo(root)) {
    process.stderr.write('⚠️ Esta pasta não é um repositório Git.\n');
    return 1;
  }
  if (flags.clear) {
    snapshotApi.clearSnapshot(root);
    print('🛡️  Foto apagada. O próximo commit volta a ser um commit comum.');
    return 0;
  }
  const info = snapshotApi.takeSnapshot(root, flags.reason || 'manual');
  logAction(root, 'snapshot', { summary: info.reason });
  print([
    '\n🛡️  Foto tirada',
    '',
    'Tudo o que está na pasta agora conta como "veio da org".',
    'Só o que você mudar a partir daqui entra no "reldor commit".',
  ]);
  return 0;
}

function list(title, files, icon) {
  if (!files.length) return [];
  return [`${icon} ${title} (${files.length}):`, ...files.slice(0, 30).map((f) => `   ${f}`), ...(files.length > 30 ? [`   ... e mais ${files.length - 30}`] : [])];
}

async function commitCommand(root, flags, args) {
  if (!gitApi.isRepo(root)) {
    process.stderr.write('⚠️ Esta pasta não é um repositório Git.\n');
    return 1;
  }
  const snapshot = snapshotApi.loadSnapshot(root);
  if (!snapshot) {
    print([
      '\n🛡️  Commit limpo',
      '',
      'Não há foto de retrieve: todos os arquivos alterados são seus.',
      'Use o Git normalmente (git add / git commit), ou rode "reldor snapshot" logo depois do próximo retrieve.',
    ]);
    return 0;
  }
  const message = flags.message || flags.m || args.join(' ');
  const include = typeof flags.include === 'string' ? flags.include.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const plan = snapshotApi.planCleanCommit(root, snapshot, include);
  const out = ['\n🛡️  Commit limpo', '', `Foto de ${snapshot.at.replace('T', ' ').slice(0, 16)} (${snapshot.reason}).`, ''];
  out.push(...list('Seus arquivos', plan.mine, '✅'));
  out.push(...list('Arquivos que a org também mudou: só as suas linhas entram', plan.mixed, '✂️ '));
  out.push(...list('Incluídos inteiros, a seu pedido', plan.whole, '📥'));
  out.push(...list('Vieram da org e ficam de fora', plan.fromOrg, '⬜'));

  const nothing = !plan.mine.length && !plan.mixed.length && !plan.whole.length;
  if (flags.json && (flags['dry-run'] || nothing)) {
    printJson({ snapshot, plan: { mine: plan.mine, mixed: plan.mixed, whole: plan.whole, fromOrg: plan.fromOrg } });
    return 0;
  }
  if (nothing) {
    print([...out, '', 'Nenhuma mudança sua desde a foto. Nada para commitar.']);
    return 0;
  }
  if (flags['dry-run']) {
    print([...out, '', '➡️  Para incluir um arquivo da org inteiro: --include caminho/do/arquivo', '➡️  Para commitar: reldor commit -m "mensagem"']);
    return 0;
  }
  if (!message) {
    print([...out, '', '⚠️ Informe a mensagem: reldor commit -m "mensagem"']);
    return 1;
  }
  if (!flags.json) print(out);
  if (!(await confirm('\n🛡️ Commitar só esses arquivos e linhas?', flags))) {
    print('Cancelado. Nada foi alterado.');
    return 0;
  }
  const { staged, failed } = snapshotApi.stageCleanCommit(root, snapshot, plan);
  if (!staged.length) {
    print(['❌ Não consegui separar as suas linhas. Nada foi commitado.', ...failed.map((f) => `   ${f}`)]);
    return 1;
  }
  const commit = run('git', ['commit', '-m', message], { cwd: root, env: { RELDOR_CLEAN_COMMIT: '1' } });
  if (!commit.ok) {
    run('git', ['read-tree', 'HEAD'], { cwd: root });
    print(['❌ O commit falhou (nada foi alterado):', commit.stdout || commit.stderr]);
    return 1;
  }
  snapshotApi.advanceSnapshot(root, snapshot, plan, failed);
  logAction(root, 'commit', { summary: `${staged.length} arquivo(s) seus; ${plan.fromOrg.length} da org fora` });
  const done = ['', `✅ Commit feito com ${staged.length} arquivo(s).`];
  if (failed.length) done.push('', '⚠️ Nestes arquivos, as suas linhas encostam nas linhas que vieram da org. Ficaram fora do commit para você decidir:', ...failed.map((f) => `   ${f}`), '   Resolva à mão (git add -p) ou inclua o arquivo inteiro com --include.');
  if (plan.fromOrg.length) done.push('', `ℹ️  ${plan.fromOrg.length} arquivo(s) da org continuam alterados na pasta, fora do Git. Se não precisar deles: git restore <arquivo>.`);
  if (flags.json) printJson({ staged, failed, fromOrg: plan.fromOrg });
  else print(done);
  return 0;
}

const HOOK_MARK = '# reldor-guard';
const HOOK = `#!/bin/sh
${HOOK_MARK}
# Gancho do Reldor: barra XML duplicado e arquivos que só vieram da org.
# Para pular uma vez, de propósito: git commit --no-verify
if [ -x "$(dirname "$0")/pre-commit.reldor-prev" ]; then
  "$(dirname "$0")/pre-commit.reldor-prev" "$@" || exit $?
fi
command -v reldor >/dev/null 2>&1 || exit 0
exec reldor precommit
`;

function hookCommand(root, flags, args) {
  const action = args[0] || 'install';
  const hooksPath = run('git', ['config', 'core.hooksPath'], { cwd: root }).stdout;
  if (hooksPath && action === 'install') {
    print([
      '\n🛡️  Este repositório usa core.hooksPath (' + hooksPath + ').',
      'Acrescente esta linha ao seu pre-commit:',
      '   command -v reldor >/dev/null 2>&1 && reldor precommit',
    ]);
    return 0;
  }
  const dir = path.join(root, run('git', ['rev-parse', '--git-dir'], { cwd: root }).stdout || '.git', 'hooks');
  const file = path.join(dir, 'pre-commit');
  if (action === 'uninstall') {
    if (fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes(HOOK_MARK)) {
      fs.rmSync(file);
      if (fs.existsSync(`${file}.reldor-prev`)) fs.renameSync(`${file}.reldor-prev`, file);
    }
    print('🛡️  Gancho do Reldor removido.');
    return 0;
  }
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(file) && !fs.readFileSync(file, 'utf8').includes(HOOK_MARK)) fs.renameSync(file, `${file}.reldor-prev`);
  fs.writeFileSync(file, HOOK, { mode: 0o755 });
  logAction(root, 'hook-install', { summary: 'pre-commit' });
  print([
    '\n🛡️  Gancho instalado (.git/hooks/pre-commit)',
    '',
    'A cada commit, inclusive os feitos na mão, o Reldor confere:',
    '• XML de profile, permission set, labels... com duplicados ou fora de ordem;',
    '• arquivos que só vieram da org no último retrieve.',
    'Ele não muda nada no repositório. Para remover: reldor hook uninstall',
  ]);
  return 0;
}


const MERGE_MARK = '# reldor-merge';
const MERGE_PATTERNS = ['*.profile-meta.xml', '*.permissionset-meta.xml', '*.mutingpermissionset-meta.xml', '*.labels-meta.xml', '*.translation-meta.xml', '*.sharingRules-meta.xml', '*.globalValueSet-meta.xml', '*.standardValueSet-meta.xml', '*.objectTranslation-meta.xml', 'package.xml'];

/** Called by Git during a merge: reldor merge-driver %O %A %B %P. Writes the result into %A. */
function mergeDriverCommand(root, flags, args) {
  const { mergeXml } = require('../../modules/sf/merge/xml-merge');
  const [basePath, oursPath, theirsPath, name] = args;
  const read = (f) => (f && fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
  let result = { supported: false };
  try {
    result = mergeXml(read(basePath), read(oursPath), read(theirsPath), { oursLabel: 'ours', theirsLabel: 'theirs' });
  } catch {
    result = { supported: false };
  }
  if (!result.supported) {
    // Not a type Reldor knows: the normal line-by-line merge.
    const r = run('git', ['merge-file', '-L', 'ours', '-L', 'base', '-L', 'theirs', oursPath, basePath, theirsPath], { cwd: root });
    return r.code === 0 ? 0 : 1;
  }
  fs.writeFileSync(oursPath, result.text);
  const msg = result.conflicts.length
    ? `🛡️  Reldor: ${name || ''} — ${result.merged} item(ns) juntados; ${result.conflicts.length} conflito(s) real(is): ${result.conflicts.map((c) => `${c.section} ${c.key}`).join(', ')}\n`
    : `🛡️  Reldor: ${name || ''} — juntado item a item (${result.merged} item(ns) do outro lado)\n`;
  process.stderr.write(msg);
  try {
    logAction(root, 'merge-driver', { summary: msg.trim() });
  } catch {
    /* log is best effort */
  }
  return result.conflicts.length ? 1 : 0;
}

/** reldor merge install|uninstall|status: registers the merge driver (local only) and rerere. */
function mergeCommand(root, flags, args) {
  const action = args[0] || 'status';
  const gitDir = path.resolve(root, run('git', ['rev-parse', '--git-dir'], { cwd: root }).stdout || '.git');
  const attrFile = path.join(gitDir, 'info', 'attributes');
  const current = fs.existsSync(attrFile) ? fs.readFileSync(attrFile, 'utf8') : '';
  const stripped = current.replace(new RegExp(`${MERGE_MARK} start[\\s\\S]*?${MERGE_MARK} end\\n?`), '');
  const cli = path.join(__dirname, 'index.js').split(path.sep).join('/');
  const node = process.execPath.split(path.sep).join('/');
  if (action === 'uninstall') {
    fs.mkdirSync(path.dirname(attrFile), { recursive: true });
    fs.writeFileSync(attrFile, stripped);
    run('git', ['config', '--unset', 'merge.reldor.driver'], { cwd: root });
    run('git', ['config', '--unset', 'merge.reldor.name'], { cwd: root });
    print('🛡️  Merge inteligente removido. (O rerere continua como estava.)');
    return 0;
  }
  if (action === 'install') {
    fs.mkdirSync(path.dirname(attrFile), { recursive: true });
    const block = [`${MERGE_MARK} start`, ...MERGE_PATTERNS.map((p) => `${p} merge=reldor`), `${MERGE_MARK} end`, ''].join('\n');
    fs.writeFileSync(attrFile, (stripped && !stripped.endsWith('\n') ? `${stripped}\n` : stripped) + block);
    run('git', ['config', 'merge.reldor.name', 'Reldor: metadados Salesforce item a item'], { cwd: root });
    run('git', ['config', 'merge.reldor.driver', `"${node}" "${cli}" merge-driver %O %A %B %P`], { cwd: root });
    const { config } = require('../config').loadConfig(root);
    const rerere = config.git?.rerere !== false && !flags['no-rerere'];
    if (rerere) {
      run('git', ['config', 'rerere.enabled', 'true'], { cwd: root });
      run('git', ['config', 'rerere.autoupdate', 'true'], { cwd: root });
    }
    logAction(root, 'merge-install', { summary: rerere ? 'driver + rerere' : 'driver' });
    print([
      '\n🛡️  Merge inteligente ligado neste repositório (só na sua máquina, nada é versionado)',
      '',
      '• Profiles, permission sets, labels, sharing rules, traduções e package.xml são juntados item a item',
      '  dentro do próprio `git merge`. Só sobra conflito quando os dois lados mudaram o mesmo item.',
      rerere ? '• rerere ligado: o Git lembra como você resolveu um conflito e repete a resolução no próximo ambiente.' : '• rerere não foi ligado.',
      '',
      'Para remover: reldor merge uninstall',
    ]);
    return 0;
  }
  const on = current.includes(MERGE_MARK) && Boolean(run('git', ['config', 'merge.reldor.driver'], { cwd: root }).stdout);
  const rerereOn = run('git', ['config', 'rerere.enabled'], { cwd: root }).stdout === 'true';
  if (flags.json) printJson({ driver: on, rerere: rerereOn });
  else print([`🛡️  Merge inteligente: ${on ? 'ligado' : 'desligado (reldor merge install)'}`, `   rerere: ${rerereOn ? 'ligado' : 'desligado'}`]);
  return 0;
}

module.exports = { snapshotCommand, commitCommand, hookCommand, mergeCommand, mergeDriverCommand, HOOK, MERGE_PATTERNS };

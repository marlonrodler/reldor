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
  const { config } = require('../config').loadConfig(root);
  const actions = require('../config').gitActionsOn(config);
  if (flags['dry-run'] || (!actions && !flags.stage)) {
    const tail = actions
      ? ['', '➡️  Para incluir um arquivo da org inteiro: --include caminho/do/arquivo', '➡️  Para commitar: reldor commit -m "mensagem"']
      : ['', 'ℹ️  As ações de Git estão desligadas: quem commita é a sua ferramenta (ex.: o plugin de fluxo do time).',
        '➡️  Para deixar só as suas linhas prontas no stage, sem commitar: reldor commit --stage',
        '   Atenção: se a sua ferramenta rodar "git add -A", ela junta tudo de novo. Avise antes de commitar.'];
    print([...out, ...tail]);
    return 0;
  }
  if (flags.stage) {
    if (!(await confirm('\n🛡️ Deixar no stage só esses arquivos e linhas (sem commitar)?', flags))) {
      print('Cancelado. Nada foi alterado.');
      return 0;
    }
    const { staged, failed } = snapshotApi.stageCleanCommit(root, snapshot, plan);
    logAction(root, 'stage', { summary: `${staged.length} arquivo(s) seus no stage` });
    if (flags.json) printJson({ staged, failed, fromOrg: plan.fromOrg });
    else print(['', `✅ ${staged.length} arquivo(s) no stage, só com as suas linhas. Agora é só commitar pelo seu fluxo.`, ...(failed.length ? ['⚠️ Ficaram fora (as suas linhas encostam nas da org):', ...failed.map((f) => `   ${f}`)] : [])]);
    return staged.length ? 0 : 1;
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



/**
 * reldor clean: before any tool commits, leave in the folder only what is yours.
 * What came from the org goes into a stash ("reldor clean"), so `git add -A` by any tool takes only your work.
 */
async function cleanCommand(root, flags) {
  if (!gitApi.isRepo(root)) {
    process.stderr.write('⚠️ Esta pasta não é um repositório Git.\n');
    return 1;
  }
  if (flags.undo) {
    const list = run('git', ['stash', 'list', '--format=%gd%x09%s'], { cwd: root }).stdout.split('\n').filter(Boolean);
    const mine = list.find((l) => l.includes('reldor clean'));
    if (!mine) {
      print('⚠️ Não achei nenhuma limpeza do Reldor para desfazer.');
      return 1;
    }
    const ref = mine.split('\t')[0];
    const g = (args) => run('git', args, { cwd: root });
    const W = g(['rev-parse', ref]).stdout;
    const hasUntracked = g(['rev-parse', '-q', '--verify', `${W}^3`]).ok;
    const back = [];
    const skipped = [];
    // Tracked files: put the org version back only where you did not change the file after the cleaning.
    for (const f of g(['diff', '--name-only', `${W}^1`, W]).stdout.split('\n').filter(Boolean)) {
      const full = path.join(root, f);
      const now = fs.existsSync(full) ? g(['hash-object', '--', f]).stdout : null;
      const kept = g(['rev-parse', '-q', '--verify', `${W}^2:${f}`]).stdout || g(['rev-parse', '-q', '--verify', `${W}^1:${f}`]).stdout;
      if (now === kept) {
        g(['checkout', W, '--', f]);
        back.push(f);
      } else {
        skipped.push(f);
      }
    }
    // Files that only existed in the org part.
    if (hasUntracked) {
      for (const f of g(['ls-tree', '-r', '--name-only', `${W}^3`]).stdout.split('\n').filter(Boolean)) {
        if (fs.existsSync(path.join(root, f))) skipped.push(f);
        else {
          g(['checkout', `${W}^3`, '--', f]);
          back.push(f);
        }
      }
    }
    if (back.length) g(['reset', '-q', '--', ...back]);
    if (!skipped.length) g(['stash', 'drop', ref]);
    print([`🛡️  ${back.length} arquivo(s) da org voltaram para a pasta.`, ...(skipped.length ? [`⚠️ Estes você mudou depois da limpeza e ficaram como estão (o backup continua em ${ref}):`, ...skipped.map((f) => `   ${f}`)] : [])]);
    return 0;
  }
  const snapshot = snapshotApi.loadSnapshot(root);
  if (!snapshot) {
    print([
      '\n🛡️  Limpar antes do commit',
      '',
      'Não há foto de retrieve, então tudo que mudou na pasta é seu: não há nada para limpar.',
      'Dica: faça o retrieve pelo Reldor (reldor retrieve) ou rode "reldor snapshot" logo depois de um retrieve.',
    ]);
    return 0;
  }
  const include = typeof flags.include === 'string' ? flags.include.split(',').map((x) => x.trim()).filter(Boolean) : [];
  const plan = snapshotApi.planCleanCommit(root, snapshot, include);
  const out = ['\n🛡️  Limpar antes do commit', ''];
  out.push(...list('Seus arquivos (ficam)', plan.mine, '✅'));
  out.push(...list('A org também mudou: ficam só as suas linhas', plan.mixed, '✂️ '));
  out.push(...list('Incluídos inteiros, a seu pedido', plan.whole, '📥'));
  out.push(...list('Vieram só da org (saem da pasta)', plan.fromOrg, '⬜'));
  if (!plan.mixed.length && !plan.fromOrg.length) {
    snapshotApi.clearSnapshot(root);
    print([...out, '', '✅ Nada da org para tirar: a pasta já só tem o seu.']);
    return 0;
  }
  if (flags['dry-run']) {
    if (flags.json) printJson({ plan });
    else print([...out, '', '➡️  Para limpar: reldor clean']);
    return 0;
  }
  if (!flags.json) print(out);
  if (!(await confirm('\n🛡️ Tirar da pasta o que veio da org (fica guardado num stash, dá para desfazer)?', flags))) {
    print('Cancelado. Nada foi alterado.');
    return 0;
  }
  const { staged, failed } = snapshotApi.stageCleanCommit(root, snapshot, plan);
  if (failed.length) {
    run('git', ['reset', '-q'], { cwd: root });
    print(['❌ Nestes arquivos as suas linhas encostam nas da org, e não dá para separar com segurança. Nada foi alterado:', ...failed.map((f) => `   ${f}`), '   Use --include <arquivo> para manter o arquivo inteiro, ou separe à mão.']);
    return 1;
  }
  const stash = run('git', ['stash', 'push', '--keep-index', '--include-untracked', '-m', 'reldor clean: o que veio da org'], { cwd: root });
  if (!stash.ok) {
    print(['❌ Não consegui guardar o que veio da org:', stash.stderr || stash.stdout]);
    return 1;
  }
  run('git', ['reset', '-q'], { cwd: root }); // back to normal: your work is in the folder, nothing staged
  snapshotApi.clearSnapshot(root);
  logAction(root, 'clean', { summary: `${staged.length} arquivo(s) seus ficaram; ${plan.fromOrg.length + plan.mixed.length} limpo(s)` });
  const done = ['', `✅ Pronto: a pasta tem só o seu (${staged.length} arquivo(s)). Pode commitar pelo seu fluxo (ex.: o plugin de fluxo do time).`, 'ℹ️  O que veio da org ficou guardado num stash. Para trazer de volta: reldor clean --undo'];
  if (flags.json) printJson({ staged, stashed: [...plan.fromOrg, ...plan.mixed] });
  else print(done);
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
const ISSUE_TEXT = {
  conflito: 'ainda tem marcação de conflito (<<<<<<<)',
  'nao-e-seu': 'linhas entraram e não são da sua branch',
  'removido-sem-ser-seu': 'linhas do destino sumiram sem a sua branch ter removido (se foi um conflito que você decidiu pela sua versão, está certo)',
  'faltou-o-seu': 'linhas da sua branch não entraram',
  'nao-removido': 'linhas que você removeu continuam lá',
  'commits-de-outros': 'commits de outras pessoas estão indo junto (vieram para a sua branch)',
};

function renderVerify(v) {
  const out = ['', v.ok ? `✅ Entrou só o seu: ${v.files} arquivo(s) conferido(s) linha a linha.` : '⚠️  Conferência "entrou só o seu?":'];
  for (const i of v.issues) {
    out.push(`   • ${i.file}: ${ISSUE_TEXT[i.kind]}`);
    for (const l of i.lines.slice(0, 5)) out.push(`       ${l.length > 110 ? `${l.slice(0, 110)}…` : l}`);
    if (i.lines.length > 5) out.push(`       … e mais ${i.lines.length - 5}`);
  }
  return out;
}

/** reldor merge <branch> | --check | --continue | --abort: assisted merge into the current (merge) branch. */
async function assistedMergeCommand(root, flags, args) {
  const assisted = require('../../modules/sf/merge/assisted');
  const { config } = require('../config').loadConfig(root);
  if (flags.abort) {
    print(assisted.abortMerge(root) ? '🛡️  Merge desfeito. A branch voltou ao que era.' : '⚠️ Não havia merge para desfazer.');
    return 0;
  }
  if (flags.check) {
    const v = assisted.verifyMerge(root);
    if (flags.json) printJson(v);
    else print(['\n🛡️  Conferência do merge', ...renderVerify(v)]);
    return v.ok ? 0 : 1;
  }
  if (flags.continue) {
    const v = assisted.verifyMerge(root);
    if (!flags.json) print(['\n🛡️  Conferência do merge', ...renderVerify(v)]);
    if (!v.ok && !flags.force) {
      print(['', 'Não commitei. Revise os pontos acima; se estiver certo assim, rode de novo com --force.']);
      return 1;
    }
    if (!(await confirm('\n🛡️ Fazer o commit de merge agora?', flags))) {
      print('Ok, não commitei. O merge continua em andamento.');
      return 0;
    }
    const r = assisted.continueMerge(root);
    if (!r.committed) {
      print(['⚠️ Ainda há marcação de conflito em:', ...r.withMarkers.map((f) => `   ${f}`)]);
      return 1;
    }
    logAction(root, 'merge-commit', { summary: r.commit });
    if (flags.json) printJson({ ...r, verify: v });
    else print(`✅ Commit de merge feito (${r.commit}). Agora é abrir a PR pelo seu fluxo.`);
    return 0;
  }
  const branch = args[0];
  if (!(await confirm(`\n🛡️ Fazer o merge de ${branch} nesta branch (${gitApi.currentBranch(root)}), sem commitar?`, flags))) {
    print('Cancelado. Nada foi alterado.');
    return 0;
  }
  const r = assisted.startMerge(root, branch, { environments: config.environments || [] });
  logAction(root, 'merge', { summary: `${branch} → ${r.target}: ${r.resolved.length} resolvido(s), ${r.hard.length} para revisar` });
  const v = r.upToDate ? null : assisted.verifyMerge(root);
  if (flags.json) {
    printJson({ ...r, verify: v });
    return 0;
  }
  if (r.upToDate) {
    print(`✅ Nada para juntar: ${r.target} já tem tudo de ${branch}.`);
    return 0;
  }
  const out = [`\n🛡️  Merge assistido: ${branch} → ${r.target} (ainda sem commit)`, ''];
  out.push(`• ${r.auto.length} arquivo(s) o Git juntou sem conflito.`);
  if (r.resolved.length) {
    out.push(`• ${r.resolved.length} conflito(s) resolvido(s) pelo Reldor (mantém o destino e aplica a sua mudança):`);
    for (const x of r.resolved) out.push(`   ✅ ${x.file} (${x.how})`);
  }
  if (r.hard.length) {
    out.push(`• ${r.hard.length} arquivo(s) para revisar (você e outra pessoa mudaram as mesmas linhas):`);
    for (const h of r.hard) {
      if (h.whole) out.push(`   ✋ ${h.file}: ${h.why}`);
      else out.push(`   ✋ ${h.file}: ${h.conflicts.map((c) => (c.item ? c.item : `linha ${c.line}`)).join(', ')}`);
    }
  }
  out.push(...renderVerify(v));
  out.push('', r.hard.length ? '➡️  Resolva os ✋ (a IA pode fazer isso), depois: reldor merge --continue' : '➡️  Revise e, se estiver certo: reldor merge --continue (faz o commit de merge)');
  out.push('   Para desistir: reldor merge --abort');
  print(out);
  return 0;
}

function mergeCommand(root, flags, args) {
  if (flags.check || flags.continue || flags.abort || (args[0] && !['install', 'uninstall', 'status'].includes(args[0]))) return assistedMergeCommand(root, flags, args);
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

module.exports = { snapshotCommand, commitCommand, cleanCommand, hookCommand, mergeCommand, mergeDriverCommand, HOOK, MERGE_PATTERNS };

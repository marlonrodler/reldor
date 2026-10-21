'use strict';

const fs = require('node:fs');
const path = require('node:path');
const snapshotApi = require('../git/snapshot');
const gitApi = require('../git');
const { logAction } = require('../log');
const { print, printJson } = require('../report');
const { run } = require('../util/exec');

const { confirm } = require('./confirm');

function snapshotCommand(root, flags) {
  if (!gitApi.isRepo(root)) {
    process.stderr.write('⚠️ Esta pasta não é um repositório Git.\n');
    return 1;
  }
  if (flags.restore) {
    print(restoreCleanSnapshot(root) ? '🛡️  A foto do último retrieve voltou: o reldor clean e o commit limpo funcionam de novo.' : '⚠️ Não há foto guardada pelo reldor clean.');
    return 0;
  }
  if (flags['after-commit']) {
    // The person committed only their lines: the snapshot moves forward, so those lines are not "yours" again.
    const snap = snapshotApi.loadSnapshot(root);
    let saved = {};
    try {
      saved = JSON.parse(fs.readFileSync(path.join(root, '.reldor', 'work', 'commit', 'plano.json'), 'utf8'));
    } catch {
      /* no plan saved */
    }
    const head = run('git', ['rev-parse', 'HEAD'], { cwd: root }).stdout;
    if (!snap || !saved.head || saved.head === head) {
      print('⚠️ Não vi um commit novo desde o plano do reldor commit. A foto ficou como estava.');
      return 1;
    }
    snapshotApi.advanceSnapshot(root, snap, { now: snapshotApi.workingTree(root) }, saved.failed || []);
    logAction(root, 'snapshot', { summary: 'depois do commit' });
    print('🛡️  Foto atualizada: o que você commitou não aparece mais como seu; o que veio da org continua de fora.');
    return 0;
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

/**
 * reldor commit: separates your work from what a retrieve brought, and hands over the Git commands. Reldor never runs
 * them. Default: only your lines go into the stage, then you commit. --stash-org (the old "clean"): the org part goes
 * into a stash, so any tool that runs "git add -A" commits only yours. --undo: brings the stashed org part back.
 */
async function commitCommand(root, flags, args) {
  if (!gitApi.isRepo(root)) {
    process.stderr.write('⚠️ Esta pasta não é um repositório Git.\n');
    return 1;
  }
  if (flags.undo) return undoStash(root, flags);
  const stashOrg = Boolean(flags['stash-org']);
  const tools = require('../tools');
  const { config: cfg } = require('../config').loadConfig(root);
  // Taking the org part out of the folder is the "org-files" capability: when another tool owns it, only --force.
  if (stashOrg && !tools.runs(cfg, 'org-files') && !flags.force && !flags['dry-run']) {
    print([`\n🔎 ${tools.ownerNote(cfg, 'org-files')}`, 'Não mexi em nada. Para ver o plano: reldor commit --stash-org --dry-run. Para o Reldor montar os comandos mesmo assim: --force']);
    return 0;
  }
  const title = stashOrg ? '\n🛡️  Deixar na pasta só o seu' : '\n🛡️  Commit limpo';
  const snapshot = snapshotApi.loadSnapshot(root);
  if (!snapshot) {
    print([title, '', 'Não há foto de retrieve: todos os arquivos alterados são seus.', 'Use o Git normalmente (ou a sua ferramenta). Depois do próximo retrieve, rode "reldor snapshot".']);
    return 0;
  }
  const message = flags.message || flags.m || args.join(' ');
  const include = typeof flags.include === 'string' ? flags.include.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const plan = snapshotApi.planCleanCommit(root, snapshot, include);
  const out = [title, '', `Foto de ${snapshot.at.replace('T', ' ').slice(0, 16)} (${snapshot.reason}).`, ''];
  out.push(...list('Seus arquivos', plan.mine, '✅'));
  out.push(...list('Arquivos que a org também mudou: só as suas linhas', plan.mixed, '✂️ '));
  out.push(...list('Incluídos inteiros, a seu pedido', plan.whole, '📥'));
  out.push(...list(stashOrg ? 'Vieram só da org (saem da pasta, ficam num stash)' : 'Vieram da org e ficam de fora', plan.fromOrg, '⬜'));
  const plainPlan = { mine: plan.mine, mixed: plan.mixed, whole: plan.whole, fromOrg: plan.fromOrg };
  const nothingMine = !plan.mine.length && !plan.mixed.length && !plan.whole.length;
  const nothingOrg = !plan.mixed.length && !plan.fromOrg.length;
  if (flags['dry-run'] || (!stashOrg && nothingMine) || (stashOrg && nothingOrg)) {
    if (stashOrg && nothingOrg && !flags['dry-run']) snapshotApi.clearSnapshot(root);
    if (flags.json) printJson({ snapshot, plan: plainPlan });
    else print([...out, '', flags['dry-run'] ? '➡️  Para incluir um arquivo da org inteiro: --include caminho/do/arquivo' : stashOrg ? '✅ Nada da org para tirar: a pasta já só tem o seu.' : 'Nenhuma mudança sua desde a foto. Nada para commitar.']);
    return 0;
  }
  const { handover, cmdLine } = require('../report');
  const patchFile = path.join(root, '.reldor', 'work', 'commit', 'so-o-seu.patch');
  const p = snapshotApi.writeCleanPatch(root, snapshot, plan, patchFile);
  const rel = path.relative(root, patchFile).split(path.sep).join('/');
  if (stashOrg && p.failed.length) {
    print([...out, '', '❌ Nestes arquivos as suas linhas encostam nas da org, e não dá para separar com segurança:', ...p.failed.map((f) => `   ${f}`), '   Use --include <arquivo> para manter o arquivo inteiro, ou separe à mão.']);
    return 1;
  }
  const cmds = [
    { cmd: 'git restore --staged .', why: 'começa com o stage vazio' },
    { cmd: cmdLine(['git', 'apply', '--cached', '--3way', '--whitespace=nowarn', rel]), why: 'só as suas linhas no stage' },
  ];
  if (stashOrg) {
    // The snapshot is kept aside: "--undo" brings it back, so the same retrieve can be separated again.
    const keep = path.join(root, '.reldor', 'work', 'snapshot-before-clean.json');
    fs.mkdirSync(path.dirname(keep), { recursive: true });
    fs.writeFileSync(keep, JSON.stringify(snapshot, null, 2));
    cmds.push(
      { cmd: cmdLine(['git', 'stash', 'push', '--keep-index', '--include-untracked', '-m', 'reldor clean: o que veio da org']), why: 'guarda o que veio da org' },
      { cmd: 'git restore --staged .', why: 'volta ao normal: o seu trabalho na pasta, nada no stage' },
      { cmd: 'reldor snapshot --clear', why: 'a foto daquele retrieve já foi usada' },
    );
  } else {
    cmds.push({ cmd: message ? cmdLine(['git', 'commit', '-m', message]) : 'commite pela sua ferramenta (ou git commit -m "mensagem")', why: 'sem "git add -A" antes: ele juntaria tudo de novo' });
    cmds.push({ cmd: 'reldor snapshot --after-commit', why: 'a foto anda junto: o que você commitou não aparece de novo' });
    fs.writeFileSync(path.join(root, '.reldor', 'work', 'commit', 'plano.json'), JSON.stringify({ head: plan.head, failed: p.failed }, null, 2));
  }
  logAction(root, stashOrg ? 'clean-plan' : 'commit-plan', { summary: `${plan.mine.length + plan.mixed.length} arquivo(s) seus; ${plan.fromOrg.length} da org` });
  const failedLines = p.failed.length ? ['', '⚠️ Nestes arquivos as suas linhas encostam nas da org e ficaram fora do patch. Decida à mão (git add -p) ou inclua o arquivo inteiro com --include:', ...p.failed.map((f) => `   ${f}`)] : [];
  if (flags.json) {
    printJson({ plan: plainPlan, patch: rel, failed: p.failed, commands: cmds.map((c) => c.cmd) });
    return 0;
  }
  const intro = stashOrg
    ? `▶️  Para deixar na pasta só o seu, rode você (o Reldor separou as suas linhas em ${rel}):`
    : `▶️  Para commitar só o seu, rode você, na pasta do projeto (o Reldor separou as suas linhas em ${rel}):`;
  print([...out, ...failedLines, ...handover(cmds, { intro }), ...(stashOrg ? ['', 'Para trazer de volta depois: reldor commit --undo (ele monta os comandos).'] : [])]);
  return 0;
}

/** reldor commit --undo: the commands that bring back what --stash-org put away (files you changed since are kept). */
function undoStash(root, flags) {
  const g = (a) => run('git', a, { cwd: root });
  const mine = g(['stash', 'list', '--format=%gd%x09%s']).stdout.split('\n').filter(Boolean).find((l) => l.includes('reldor clean'));
  if (!mine) {
    print('⚠️ Não achei nada guardado pelo Reldor para trazer de volta.');
    return 1;
  }
  const ref = mine.split('\t')[0];
  const W = g(['rev-parse', ref]).stdout;
  const hasUntracked = g(['rev-parse', '-q', '--verify', `${W}^3`]).ok;
  const back = [];
  const skipped = [];
  const steps = [];
  // Tracked files: the org version comes back only where you did not change the file afterwards.
  for (const f of g(['diff', '--name-only', `${W}^1`, W]).stdout.split('\n').filter(Boolean)) {
    const now = fs.existsSync(path.join(root, f)) ? g(['hash-object', '--', f]).stdout : null;
    const kept = g(['rev-parse', '-q', '--verify', `${W}^2:${f}`]).stdout || g(['rev-parse', '-q', '--verify', `${W}^1:${f}`]).stdout;
    if (now === kept) {
      steps.push(['checkout', W, '--', f]);
      back.push(f);
    } else skipped.push(f);
  }
  if (hasUntracked) {
    for (const f of g(['ls-tree', '-r', '--name-only', `${W}^3`]).stdout.split('\n').filter(Boolean)) {
      if (fs.existsSync(path.join(root, f))) skipped.push(f);
      else {
        steps.push(['checkout', `${W}^3`, '--', f]);
        back.push(f);
      }
    }
  }
  if (back.length) steps.push(['reset', '-q', '--', ...back]);
  if (!skipped.length) steps.push(['stash', 'drop', ref]);
  const { handover, cmdLine } = require('../report');
  const cmds = steps.map((a) => cmdLine(['git', ...a]));
  if (fs.existsSync(path.join(root, '.reldor', 'work', 'snapshot-before-clean.json'))) cmds.push('reldor snapshot --restore');
  if (flags.json) {
    printJson({ back, skipped, commands: cmds });
    return 0;
  }
  const skippedLines = skipped.length ? [`⚠️ Estes você mudou depois e ficam como estão (o backup continua em ${ref}):`, ...skipped.map((f) => `   ${f}`)] : [];
  print([`\n🛡️  Trazer de volta: ${back.length} arquivo(s) da org voltariam para a pasta.`, ...skippedLines, ...handover(cmds)]);
  return 0;
}

const HOOK_MARK = '# reldor-guard';
/**
 * The pre-commit hook. It calls the same Reldor that installed it (node + this CLI, absolute paths), so an older
 * `reldor` left on the PATH cannot block commits; the PATH is only a fallback if this copy was moved.
 */
function hookScript(node = process.execPath, cli = path.join(__dirname, 'index.js')) {
  const n = node.split(path.sep).join('/');
  const c = cli.split(path.sep).join('/');
  return `#!/bin/sh
${HOOK_MARK}
# Gancho do Reldor: barra XML duplicado e arquivos que só vieram da org.
# Para pular uma vez, de propósito: git commit --no-verify
if [ -x "$(dirname "$0")/pre-commit.reldor-prev" ]; then
  "$(dirname "$0")/pre-commit.reldor-prev" "$@" || exit $?
fi
if [ -f "${c}" ] && [ -x "${n}" ]; then
  exec "${n}" "${c}" precommit
fi
command -v reldor >/dev/null 2>&1 || exit 0
exec reldor precommit
`;
}
const HOOK = hookScript();

async function hookCommand(root, flags, args) {
  const action = args[0] || 'install';
  if (action === 'install' && !flags.force) {
    const tools = require('../tools');
    const { config } = require('../config').loadConfig(root);
    if (!tools.runs(config, 'pre-commit')) {
      print([`\n➖ ${tools.ownerNote(config, 'pre-commit')}`, 'Não instalei nada. Para instalar mesmo assim: reldor hook install --force']);
      return 0;
    }
  }
  const hooksPath = run('git', ['config', 'core.hooksPath'], { cwd: root }).stdout;
  if (hooksPath && action === 'install') {
    print([
      '\n🛡️  Este repositório usa core.hooksPath (' + hooksPath + '): os ganchos são do time.',
      'Não mexi neles. Para o Reldor conferir também, acrescente esta linha ao pre-commit do time:',
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
  if (!(await confirm('\n🛡️ Instalar o gancho pre-commit do Reldor nesta cópia do repositório (.git/hooks, só na sua máquina)?', flags))) {
    print('Cancelado. Nada foi alterado.');
    return 0;
  }
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(file) && !fs.readFileSync(file, 'utf8').includes(HOOK_MARK)) fs.renameSync(file, `${file}.reldor-prev`);
  fs.writeFileSync(file, hookScript(), { mode: 0o755 });
  logAction(root, 'hook-install', { summary: 'pre-commit' });
  print([
    '\n🛡️  Gancho instalado (.git/hooks/pre-commit)',
    '',
    'A cada commit, inclusive os feitos na mão, o Reldor confere:',
    '• XML de profile, permission set, labels... com entradas duplicadas;',
    '• arquivos que só vieram da org no último retrieve.',
    'Um gancho que já existia continua rodando antes. O que outra ferramenta do time cuida segue o reldor tools.',
    'Ele não muda nada no repositório. Para remover: reldor hook uninstall',
  ]);
  return 0;
}

/** Brings back the snapshot kept by "reldor clean", so the same retrieve can be cleaned again. */
function restoreCleanSnapshot(root) {
  const keep = path.join(root, '.reldor', 'work', 'snapshot-before-clean.json');
  if (!fs.existsSync(keep)) return false;
  try {
    const info = JSON.parse(fs.readFileSync(keep, 'utf8'));
    run('git', ['update-ref', snapshotApi.REF, info.commit], { cwd: root });
    fs.writeFileSync(path.join(root, '.reldor', 'work', 'snapshot.json'), JSON.stringify(info, null, 2));
    fs.rmSync(keep, { force: true });
    return true;
  } catch {
    return false;
  }
}

/** reldor clean: kept as a short name for "reldor commit --stash-org" (and --undo). */
function cleanCommand(root, flags, args) {
  return commitCommand(root, flags.undo ? flags : { ...flags, 'stash-org': true }, args);
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
  const foreign = v.issues.some((i) => i.kind === 'nao-e-seu' || i.kind === 'commits-de-outros');
  const out = ['', v.ok ? `✅ Entrou só o seu: ${v.files} arquivo(s) conferido(s) linha a linha.` : foreign ? '🔴 Está vindo coisa a mais que não é sua. Confira antes de abrir a PR:' : '⚠️  Conferência "entrou só o seu?":'];
  for (const i of v.issues) {
    out.push(`   • ${i.file}: ${ISSUE_TEXT[i.kind]}`);
    for (const l of i.lines.slice(0, 5)) out.push(`       ${l.length > 110 ? `${l.slice(0, 110)}…` : l}`);
    if (i.lines.length > 5) out.push(`       … e mais ${i.lines.length - 5}`);
  }
  return out;
}

/** Lines for the result of resolving conflicts. */
function renderResolved(r, staged) {
  const out = [];
  out.push(`• ${r.auto.length} arquivo(s) o Git juntou sem conflito.`);
  if (r.resolved.length) {
    out.push(`• ${r.resolved.length} conflito(s) resolvido(s) pelo Reldor (mantém o destino e aplica a sua mudança)${staged ? '' : ', já gravados na pasta'}:`);
    for (const x of r.resolved) out.push(`   ✅ ${x.file} (${x.how})`);
  }
  if (r.hard.length) {
    out.push(`• ${r.hard.length} arquivo(s) para revisar (você e outra pessoa mudaram as mesmas linhas):`);
    for (const h of r.hard) {
      if (h.whole) out.push(`   ✋ ${h.file}: ${h.why}`);
      else out.push(`   ✋ ${h.file}: ${h.conflicts.map((c) => (c.item ? c.item : `linha ${c.line}`)).join(', ')}`);
    }
  }
  return out;
}

/**
 * reldor merge <branch> | --resolve | --check | --continue | --abort: assisted merge into the current (merge) branch.
 * The Git steps (merge, add, commit, abort) are handed over as commands; Reldor only resolves conflicts in the files
 * (with confirmation) and checks that only yours went in.
 */
async function assistedMergeCommand(root, flags, args) {
  const assisted = require('../../modules/sf/merge/assisted');
  const { config } = require('../config').loadConfig(root);
  const { handover, cmdLine } = require('../report');
  if (flags.abort) {
    print(['\n🛡️  Desfazer o merge', ...handover([{ cmd: 'git merge --abort', why: 'a branch volta ao que era' }])]);
    return 0;
  }
  if (flags.check) {
    const v = assisted.verifyMerge(root);
    if (flags.json) printJson(v);
    else print(['\n🛡️  Conferência do merge', ...renderVerify(v)]);
    return v.ok ? 0 : 1;
  }
  if (flags.resolve) {
    if (!assisted.mergeInProgress(root)) {
      print('⚠️ Não há merge em andamento. Comece com: reldor merge <sua-branch> (ele monta o comando).');
      return 1;
    }
    if (!(await confirm('\n🛡️ Resolver os conflitos nos arquivos (mantém o destino e aplica só a sua mudança)?', flags))) {
      print('Cancelado. Nada foi alterado.');
      return 0;
    }
    const r = assisted.resolveConflicts(root, { stage: false });
    logAction(root, 'merge-resolve', { summary: `${r.resolved.length} resolvido(s), ${r.hard.length} para revisar` });
    const v = assisted.verifyMerge(root);
    if (flags.json) {
      printJson({ ...r, verify: v, commands: r.resolved.length ? [cmdLine(['git', 'add', '--', ...r.resolved.map((x) => x.file)])] : [] });
      return 0;
    }
    const out = ['\n🛡️  Conflitos do merge', '', ...renderResolved(r, false), ...renderVerify(v)];
    if (r.resolved.length) out.push(...handover([{ cmd: cmdLine(['git', 'add', '--', ...r.resolved.map((x) => x.file)]), why: 'marca como resolvidos' }]));
    out.push('', r.hard.length ? '➡️  Resolva os ✋ (a IA pode fazer isso), depois: reldor merge --continue' : '➡️  Depois: reldor merge --continue (confere de novo e mostra o commit)');
    print(out);
    return 0;
  }
  if (flags.continue) {
    const v = assisted.verifyMerge(root);
    if (!flags.json) print(['\n🛡️  Conferência do merge', ...renderVerify(v)]);
    if (!v.ok && !flags.force) {
      print(['', 'Revise os pontos acima antes do commit; se estiver certo assim, rode de novo com --force.']);
      return 1;
    }
    if (flags.json) printJson({ verify: v, commands: ['git commit --no-edit'] });
    else print(handover([{ cmd: 'git commit --no-edit', why: 'o commit de merge (ou pela sua ferramenta)' }, 'abra a PR pelo seu fluxo']));
    return 0;
  }
  const branch = args[0];
  let ref;
  try {
    ({ ref } = assisted.preflight(root, branch, { environments: config.environments || [] }));
  } catch (error) {
    print(`⚠️ ${error.message}`);
    return 1;
  }
  const steps = [
    { cmd: cmdLine(['git', 'merge', '--no-ff', '--no-commit', ref]), why: 'junta a sua branch, sem commitar' },
    { cmd: 'reldor merge --resolve', why: 'se o Git parar com conflito: o Reldor resolve nos arquivos, mantendo o destino' },
    { cmd: 'reldor merge --check', why: 'confere se entrou só o seu' },
    { cmd: 'reldor merge --continue', why: 'confere de novo e mostra o commit de merge' },
  ];
  if (flags.json) printJson({ branch, ref, target: gitApi.currentBranch(root), commands: steps.map((x) => x.cmd) });
  else print([`\n🛡️  Merge assistido: ${branch} → ${gitApi.currentBranch(root)}`, '', '✅ Pronto para o merge: sem pendências, branch encontrada, fora da branch do ambiente.', ...handover(steps)]);
  return 0;
}

async function mergeCommand(root, flags, args) {
  if (flags.check || flags.continue || flags.abort || flags.resolve || (args[0] && !['install', 'uninstall', 'status'].includes(args[0]))) return assistedMergeCommand(root, flags, args);
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
    const tools = require('../tools');
    const { config: cfg } = require('../config').loadConfig(root);
    if (!tools.runs(cfg, 'profile-merge') && !flags.force) {
      print([`\n➖ ${tools.ownerNote(cfg, 'profile-merge')}`, 'Não liguei nada. Para ligar mesmo assim: reldor merge install --force']);
      return 0;
    }
    if (!(await confirm('\n🛡️ Ligar o merge item a item para profiles e afins nesta cópia do repositório (só na sua máquina)?', flags))) {
      print('Cancelado. Nada foi alterado.');
      return 0;
    }
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

module.exports = { snapshotCommand, commitCommand, cleanCommand, hookCommand, mergeCommand, mergeDriverCommand, HOOK, hookScript, MERGE_PATTERNS };

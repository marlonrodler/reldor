'use strict';

const fs = require('node:fs');
const path = require('node:path');
const gitApi = require('../../../core/git');
const { merge3, splitLines } = require('../../../core/git/merge3');
const { mergeXml } = require('./xml-merge');
const { isOrganizable } = require('../xml/rules');

const git = (root, args, o) => gitApi.git(root, args, o);
const lines = (r) => (r.ok && r.stdout ? r.stdout.split('\n').filter(Boolean) : []);
const MARKER = /^(<{7}|>{7}|={7})( |$)/m;

/** Tags well formed? Used as a safety net after a line merge of XML or LWC HTML. */
function wellFormed(text) {
  try {
    const { XMLValidator } = require('fast-xml-parser');
    return XMLValidator.validate(text) === true;
  } catch {
    return true;
  }
}
const isMarkup = (file) => /\.(xml|html)$/i.test(file);

function show(root, spec) {
  const r = git(root, ['show', spec], { raw: true });
  return r.ok ? r.stdout : null;
}

function mergeInProgress(root) {
  return git(root, ['rev-parse', '-q', '--verify', 'MERGE_HEAD']).ok;
}

/**
 * Assisted merge: `git merge --no-ff --no-commit <branch>` on the current branch (the merge branch), then every
 * conflict is resolved with the rule "keep what the target has, apply only our change". What the rule cannot
 * decide (both sides changed the same lines) is left with markers and returned for the AI or a person.
 * Nothing is committed.
 */
/** Checks before a merge: not on an environment branch, nothing pending, the branch exists. Returns the ref. */
function preflight(root, branch, { environments = [] } = {}) {
  if (mergeInProgress(root)) throw new Error('Já existe um merge em andamento. Use --resolve, --check, --continue ou --abort.');
  const current = gitApi.currentBranch(root);
  if (environments.some((e) => e.branch === current)) {
    throw new Error(`Você está na branch do ambiente (${current}). Crie a branch de merge a partir dela e rode de novo lá.`);
  }
  const pending = git(root, ['status', '--porcelain', '--untracked-files=no']).stdout;
  if (pending) throw new Error('Há mudanças não commitadas nesta branch. Commite ou guarde (git stash) antes do merge.');
  const ref = gitApi.resolveBranch(root, branch) || branch;
  if (!git(root, ['rev-parse', '-q', '--verify', `${ref}^{commit}`]).ok) throw new Error(`Branch ${branch} não encontrada.`);
  return { ref, current };
}

/**
 * Resolves the conflicts of a merge in progress with the rule "keep the target, apply only your change", writing the
 * files. With `stage`, the resolved files are also marked as resolved in Git (git add); without it, they are listed
 * for the person to add. Returns { auto, resolved, hard }.
 */
function resolveConflicts(root, { stage = false } = {}) {
  if (!mergeInProgress(root)) throw new Error('Não há merge em andamento. Comece com git merge --no-ff --no-commit <sua-branch>.');
  const conflicted = [...new Set(lines(git(root, ['diff', '--name-only', '--diff-filter=U'])))];
  const report = { auto: [], resolved: [], hard: [] };
  for (const file of conflicted) {
    const base = show(root, `:1:${file}`);
    const target = show(root, `:2:${file}`);
    const ours = show(root, `:3:${file}`);
    if (target === null || ours === null) {
      report.hard.push({ file, whole: true, why: target === null ? 'o arquivo foi apagado no destino e mudado na sua branch' : 'você apagou o arquivo e o destino mudou ele' });
      continue;
    }
    let out = null;
    if (isOrganizable(file)) {
      const x = mergeXml(base || '', target, ours, { oursLabel: 'destino', theirsLabel: 'sua branch' });
      if (x.supported) out = { text: x.text, conflicts: x.conflicts.map((c) => ({ item: `${c.section} ${c.key}` })), how: 'item a item' };
    }
    if (!out) {
      // Line merge. For XML/HTML, the result must keep the tags well formed: similar blocks can make a line diff
      // "slide" and glue tags together. Try a second alignment; if it still breaks, leave the file for review.
      const checkTags = isMarkup(file) && wellFormed(target) && wellFormed(ours);
      for (const algorithm of ['histogram', 'patience', 'minimal']) {
        const r = merge3(root, base || '', target, ours, { algorithm });
        if (!checkTags || r.conflicts.length || wellFormed(r.text)) {
          out = { text: r.text, conflicts: r.conflicts, how: 'linha a linha' };
          break;
        }
      }
      if (!out) {
        report.hard.push({ file, whole: true, why: 'juntar linha a linha deixaria as tags quebradas; resolva olhando os blocos inteiros' });
        continue;
      }
    }
    fs.writeFileSync(path.join(root, file), out.text);
    if (!out.conflicts.length) {
      if (stage) git(root, ['add', '--', file]);
      report.resolved.push({ file, how: out.how });
    } else {
      report.hard.push({ file, conflicts: out.conflicts });
    }
  }
  report.auto = lines(git(root, ['diff', '--cached', '--name-only'])).filter((f) => !conflicted.includes(f));
  return report;
}


/** Count of each meaningful line (trimmed, not blank). */
function counts(text) {
  const m = new Map();
  for (const l of splitLines(text || '')) {
    const k = l.trim();
    if (k) m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

/**
 * "Did only your change go in?" Compares what changed in the merge branch (result vs target) with what your
 * branch changed (feature vs common base), line by line. Works during the merge and after the merge commit.
 */
function verifyMerge(root) {
  let target;
  let feature;
  let readResult;
  let files;
  if (mergeInProgress(root)) {
    target = 'HEAD';
    feature = 'MERGE_HEAD';
    readResult = (f) => {
      const full = path.join(root, f);
      return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
    };
    files = lines(git(root, ['diff', '--name-only', 'HEAD']));
  } else {
    const parents = git(root, ['rev-list', '--parents', '-n', '1', 'HEAD']).stdout.split(' ').slice(1);
    if (parents.length < 2) throw new Error('Não há merge em andamento, e o último commit não é um commit de merge.');
    [target, feature] = parents;
    readResult = (f) => show(root, `HEAD:${f}`);
    files = lines(git(root, ['diff', '--name-only', target, 'HEAD']));
  }
  const base = git(root, ['merge-base', target, feature]).stdout;
  const mine = lines(git(root, ['diff', '--name-only', base, feature]));
  const all = [...new Set([...files, ...mine])];

  const issues = [];
  for (const file of all) {
    const result = readResult(file);
    if (result && MARKER.test(result)) {
      issues.push({ file, kind: 'conflito', lines: [] });
      continue;
    }
    const before = show(root, `${target}:${file}`);
    const b = counts(show(root, `${base}:${file}`));
    const f = counts(show(root, `${feature}:${file}`));
    const t = counts(before);
    const r = counts(result);
    const keys = new Set([...b.keys(), ...f.keys(), ...t.keys(), ...r.keys()]);
    const notYours = [];
    const missing = [];
    const removed = [];
    const notRemoved = [];
    for (const k of keys) {
      const netF = (f.get(k) || 0) - (b.get(k) || 0);
      const netR = (r.get(k) || 0) - (t.get(k) || 0);
      const inTarget = t.get(k) || 0;
      if (netR === netF) continue;
      if (netR > netF) {
        if (netF < 0) {
          // You removed it, but it is still there: fine only if the target did not have it to remove.
          if (inTarget >= -netF) notRemoved.push(k);
        } else {
          notYours.push(k);
        }
      } else if (netF > 0) {
        // You added it but it did not come in: fine if the target already had it.
        if (inTarget < netF - netR) missing.push(k);
      } else {
        removed.push(k);
      }
    }
    if (notYours.length) issues.push({ file, kind: 'nao-e-seu', lines: notYours });
    if (removed.length) issues.push({ file, kind: 'removido-sem-ser-seu', lines: removed });
    if (missing.length) issues.push({ file, kind: 'faltou-o-seu', lines: missing });
    if (notRemoved.length) issues.push({ file, kind: 'nao-removido', lines: notRemoved });
  }
  // Commits by other people inside your branch go in too: "only yours" also means "only your commits".
  const me = (git(root, ['config', 'user.email']).stdout || '').toLowerCase();
  const others = me
    ? lines(git(root, ['log', '--no-merges', '--format=%h%x09%an%x09%ae%x09%s', `${target}..${feature}`]))
        .map((l) => l.split('\t'))
        .filter(([, , email]) => String(email).toLowerCase() !== me)
        .map(([hash, author, , subject]) => `${hash} ${subject} (${author})`)
    : [];
  if (others.length) issues.push({ file: '(commits)', kind: 'commits-de-outros', lines: others });
  // What is not yours comes first: it is the most important thing to look at before the PR.
  const rank = { 'commits-de-outros': 0, 'nao-e-seu': 1, conflito: 2, 'removido-sem-ser-seu': 3, 'faltou-o-seu': 4, 'nao-removido': 5 };
  issues.sort((a, b) => rank[a.kind] - rank[b.kind]);
  return { target, feature, files: all.length, ok: issues.length === 0, issues };
}



module.exports = { preflight, resolveConflicts, verifyMerge, mergeInProgress };

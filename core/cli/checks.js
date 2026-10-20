'use strict';

/**
 * The checks shared by `reldor review` and the separate commands (security, quality, check, test-radar), each run
 * through the run ledger: the same check over the same content runs once, whoever asks first.
 */
const runs = require('../runs');
const gitApi = require('../git');

/** What a project-wide check depends on: the changed files' content, the index and the base commit. */
function fingerprint(root, files, base) {
  const { indexFingerprint } = require('../../modules/sf/indexer');
  return {
    files: runs.filesFingerprint(root, files),
    index: indexFingerprint(root),
    base: base ? gitApi.git(root, ['rev-parse', '--verify', '--quiet', base]).stdout || base : null,
  };
}

/** Reldor's security rules (without the Code Analyzer, which has its own ledger entry). */
function securityRules(root, files, model, config) {
  const security = require('../../modules/sf/security');
  const parts = { ...fingerprint(root, files), terms: config.security?.sensitive_terms || null, strict: Boolean(config.security?.strict_sharing) };
  return runs.once(root, 'security-rules', parts, () => security.securityReview(root, files, {
    model,
    sensitiveTerms: config.security?.sensitive_terms,
    strictSharing: Boolean(config.security?.strict_sharing),
    analyzer: false,
  }));
}

/** Quality review (Reldor rules and/or Code Analyzer rules). */
function qualityRun(root, files, model, config, { packageDirectories, base, all = false, rules = true, analyzer = true, analyzerSelectors }) {
  const quality = require('../../modules/sf/quality');
  const parts = { ...fingerprint(root, files, base), all, rules, analyzer, analyzerSelectors: analyzerSelectors || null, options: config.quality || {} };
  return runs.once(root, 'quality', parts, () => quality.qualityReview(root, files, {
    model,
    packageDirectories,
    base,
    all,
    rules,
    analyzer,
    ...(analyzerSelectors ? { analyzerSelectors } : {}),
    options: config.quality || {},
  }));
}

/** Tests the changes can break (and the classes changed). */
function radarRun(root, changes, model) {
  const { buildRadar } = require('../../modules/sf/test-radar');
  const files = changes.filter((c) => c.status !== 'deleted').map((c) => c.file);
  return runs.once(root, 'affected-tests', { ...fingerprint(root, files), changes: changes.map((c) => `${c.status}:${c.file}`) }, () => buildRadar(model, changes));
}

/** Fields read outside the query, for some classes. */
function queriesRun(root, classes, model) {
  const { checkQueries } = require('../../modules/sf/checks/queries');
  return runs.once(root, 'queries', { index: fingerprint(root, []).index, classes: [...classes].sort() }, () => checkQueries(model, classes));
}

module.exports = { fingerprint, securityRules, qualityRun, radarRun, queriesRun };

'use strict';

const { run } = require('../../../core/util/exec');

/**
 * Runs the Salesforce CLI. RELDOR_SF_BIN can point to another executable (or a .js file run with Node),
 * which the tests use to fake the CLI.
 */
function runSf(args, options = {}) {
  const bin = process.env.RELDOR_SF_BIN;
  if (bin && bin.endsWith('.js')) return run(process.execPath, [bin, ...args], options);
  return run(bin || 'sf', args, options);
}

function parseJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    const start = stdout.indexOf('{');
    try {
      return start >= 0 ? JSON.parse(stdout.slice(start)) : null;
    } catch {
      return null;
    }
  }
}

const list = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

/** Normalizes `sf project deploy start --json` output. */
function fromDeploy(json) {
  const r = json?.result || {};
  const details = r.details || {};
  const t = details.runTestResult || {};
  const coverage = list(t.codeCoverage).map((c) => {
    const total = Number(c.numLocations) || 0;
    const missed = Number(c.numLocationsNotCovered) || 0;
    return { name: c.name, percent: total ? Math.round(((total - missed) / total) * 100) : 100 };
  });
  return {
    success: Boolean(r.success) && list(t.failures).length === 0,
    componentErrors: list(details.componentFailures).map((f) => ({ name: f.fullName, type: f.componentType, problem: f.problem })),
    passed: list(t.successes).map((s) => `${s.name}.${s.methodName}`),
    failed: list(t.failures).map((f) => ({ test: `${f.name}.${f.methodName}`, message: f.message, stack: f.stackTrace || null })),
    coverage,
  };
}

/** Normalizes `sf apex run test --json` output. */
function fromApexRun(json) {
  const r = json?.result || {};
  const tests = list(r.tests);
  return {
    success: tests.every((t) => t.Outcome === 'Pass'),
    componentErrors: [],
    passed: tests.filter((t) => t.Outcome === 'Pass').map((t) => t.FullName),
    failed: tests.filter((t) => t.Outcome !== 'Pass').map((t) => ({ test: t.FullName, message: t.Message, stack: t.StackTrace || null })),
    coverage: list(r.coverage?.coverage).map((c) => ({ name: c.name, percent: Math.round(Number(c.coveredPercent) || 0) })),
  };
}

/**
 * Runs the tests in the org without saving anything:
 * - with local source paths: a check-only deploy (--dry-run) of those files with RunSpecifiedTests,
 *   so the tests see YOUR local changes;
 * - without them: a plain test run against what is already in the org.
 */
/**
 * The sf command that runs the tests without saving anything: a validation deploy (--dry-run) of the changed files
 * with RunSpecifiedTests, or, without files, an Apex test run against what is already in the org.
 */
function testArgs({ org, tests, sourcePaths = [], wait = 60, json = true }) {
  const out = json ? ['--json'] : [];
  return sourcePaths.length
    ? ['project', 'deploy', 'start', '--dry-run', ...out, '--target-org', org, '--wait', String(wait), '--test-level', 'RunSpecifiedTests',
      ...sourcePaths.flatMap((p) => ['--source-dir', p]), ...tests.flatMap((t) => ['--tests', t])]
    : ['apex', 'run', 'test', ...out, '--target-org', org, '--wait', String(wait), '--code-coverage', '--result-format', json ? 'json' : 'human', '--class-names', tests.join(',')];
}

function runTests(root, { org, tests, sourcePaths = [], wait = 60 }) {
  const args = testArgs({ org, tests, sourcePaths, wait });
  const res = runSf(args, { cwd: root, timeout: (wait + 5) * 60000 });
  const json = parseJson(res.stdout);
  if (!json) return { ok: false, mode: sourcePaths.length ? 'validate' : 'run', error: res.stderr || res.stdout || 'sem resposta do sf CLI' };
  if (json.status !== 0 && !json.result) return { ok: false, mode: sourcePaths.length ? 'validate' : 'run', error: json.message || 'falha no sf CLI' };
  return { ok: true, mode: sourcePaths.length ? 'validate' : 'run', ...(sourcePaths.length ? fromDeploy(json) : fromApexRun(json)) };
}

module.exports = { testArgs, runSf, runTests, fromDeploy, fromApexRun, parseJson };

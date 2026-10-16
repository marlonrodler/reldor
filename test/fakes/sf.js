#!/usr/bin/env node
'use strict';
// Fake Salesforce CLI for tests: records the arguments and answers like `sf ... --json`.
const fs = require('node:fs');
const args = process.argv.slice(2);
if (process.env.RELDOR_SF_LOG) fs.writeFileSync(process.env.RELDOR_SF_LOG, JSON.stringify(args));
if (args[0] === 'project' && args.includes('--dry-run')) {
  process.stdout.write(JSON.stringify({
    status: 1,
    result: {
      success: false,
      details: {
        componentFailures: [],
        runTestResult: {
          successes: [{ name: 'AccountsTest', methodName: 'deveCalcularScore' }],
          failures: { name: 'RelatorioContasTest', methodName: 'deveResumir', message: 'FIELD_CUSTOM_VALIDATION_EXCEPTION, Informe o CPF.' },
          codeCoverage: [{ name: 'RelatorioContas', numLocations: 10, numLocationsNotCovered: 4 }],
        },
      },
    },
  }));
} else {
  process.stdout.write(JSON.stringify({ status: 0, result: { tests: [], coverage: { coverage: [] } } }));
}

#!/usr/bin/env node
'use strict';

/**
 * Runs the tests for GitHub Actions: the normal output, plus one "::error" annotation per failed test (name and the
 * first lines of the error), so a failure shows up in the PR itself, without opening the log.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '..', 'test');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.js')).map((f) => path.join('test', f));
const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], { cwd: path.join(__dirname, '..'), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const out = `${r.stdout || ''}${r.stderr || ''}`;
process.stdout.write(out);
const lines = out.split('\n');
const esc = (s) => s.replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A');
for (let i = 0; i < lines.length; i += 1) {
  const m = /^(\s*)not ok \d+ - (.+)$/.exec(lines[i]);
  if (!m || m[1].length > 4) continue;
  const detail = lines.slice(i + 1, i + 40).filter((l) => /error|expected|actual|message|at |Error|\+|-/.test(l)).slice(0, 12).join('\n');
  process.stdout.write(`::error title=${esc(m[2].slice(0, 120))}::${esc(detail.slice(0, 3000))}\n`);
}
process.exit(r.status === 0 ? 0 : 1);

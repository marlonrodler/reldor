'use strict';

/**
 * reldor output [--clear] [--json]
 * The answers saved in .reldor/work/output/ (one file per command, out of Git). They go away on their own when the task
 * or its phase changes; --clear removes them now.
 */
const fs = require('node:fs');
const path = require('node:path');
const { clearOutput, dirOf } = require('../output');
const { print, printJson } = require('../report');

async function outputCommand(root, flags) {
  const dir = dirOf(root);
  if (flags.clear) {
    const removed = clearOutput(root);
    if (flags.json) printJson({ cleared: removed, folder: '.reldor/work/output' });
    else print(`🧹 ${removed} arquivo(s) de resposta apagado(s) de .reldor/work/output.`);
    return 0;
  }
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f !== '.state.json') : [];
  const list = files.map((f) => ({ file: `.reldor/work/output/${f}`, updated: fs.statSync(path.join(dir, f)).mtime.toISOString() }));
  if (flags.json) {
    printJson({ files: list });
    return 0;
  }
  print([
    '\n🛡️  Respostas guardadas (.reldor/work/output, fora do Git)',
    '',
    ...(list.length ? list.map((f) => `• ${f.file}  (${f.updated.slice(0, 16).replace('T', ' ')})`) : ['Nenhuma ainda.']),
    '',
    'Somem sozinhas quando a tarefa ou a fase muda. Para apagar agora: reldor output --clear',
  ]);
  return 0;
}

module.exports = { outputCommand };

'use strict';

/** Output helpers with the guardian tone. Keep messages short and in plain words. */
const ICON = { guard: '🛡️', warn: '⚠️', ok: '✅', no: '⬜', fail: '❌', info: '•' };

function line(icon, text) {
  return `${ICON[icon] || icon} ${text}`;
}

function title(text) {
  return `\n${ICON.guard}  ${text}\n`;
}

let outFile = null;

/**
 * --out <file>: the result goes to a file instead of the terminal, and the terminal gets one short line.
 * For terminals that lose long output (some AI terminals on Windows): the AI reads the file instead.
 */
function setOut(file) {
  outFile = file ? require('node:path').resolve(String(file)) : null;
}

/** Writes the text to the terminal, or to the --out file. */
function emit(text) {
  if (!outFile) {
    process.stdout.write(text);
    return;
  }
  const fs = require('node:fs');
  fs.mkdirSync(require('node:path').dirname(outFile), { recursive: true });
  fs.appendFileSync(outFile, text, 'utf8');
}

function print(lines) {
  emit((Array.isArray(lines) ? lines.join('\n') : lines) + '\n');
}

function printJson(data) {
  emit(JSON.stringify(data, null, 2) + '\n');
}

/** After the command: say where the result is (only with --out). */
function finishOut() {
  if (!outFile) return;
  const fs = require('node:fs');
  const size = fs.existsSync(outFile) ? fs.statSync(outFile).size : 0;
  process.stdout.write(`📄 Resultado salvo em ${outFile} (${Math.max(1, Math.round(size / 1024))} KB)\n`);
}

module.exports = { ICON, line, title, print, printJson, setOut, finishOut };

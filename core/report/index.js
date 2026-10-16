'use strict';

/** Output helpers with the guardian tone. Keep messages short and in plain words. */
const ICON = { guard: '🛡️', warn: '⚠️', ok: '✅', no: '⬜', fail: '❌', info: '•' };

function line(icon, text) {
  return `${ICON[icon] || icon} ${text}`;
}

function title(text) {
  return `\n${ICON.guard}  ${text}\n`;
}

function print(lines) {
  process.stdout.write((Array.isArray(lines) ? lines.join('\n') : lines) + '\n');
}

function printJson(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

module.exports = { ICON, line, title, print, printJson };

'use strict';

const { spawnSync } = require('node:child_process');

const IS_WINDOWS = process.platform === 'win32';

/**
 * Runs a command and returns its result without throwing.
 * On Windows, CLIs such as `sf` are .cmd files, so they need a shell.
 */
function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    encoding: 'utf8',
    shell: IS_WINDOWS,
    timeout: options.timeout || 60000,
    windowsHide: true,
  });

  if (result.error) {
    return { ok: false, code: null, stdout: '', stderr: String(result.error.message || result.error) };
  }
  return {
    ok: result.status === 0,
    code: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

module.exports = { run, IS_WINDOWS };

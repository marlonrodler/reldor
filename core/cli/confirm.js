'use strict';

const readline = require('node:readline/promises');

/**
 * Asks before doing something. --yes answers for the person (the AI passes it only after asking in the chat).
 * Without a terminal to ask (an AI running the command) and without --yes, nothing is done: the answer is no.
 */
async function confirm(question, flags = {}) {
  if (flags.yes) return true;
  if (!process.stdin.isTTY) {
    process.stdout.write(`${question}\n🛡️  Sem confirmação, nada foi feito. Para confirmar, rode de novo com --yes.\n`);
    return false;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^s/i.test((await rl.question(`${question} (s/n): `)).trim());
  } finally {
    rl.close();
  }
}

module.exports = { confirm };

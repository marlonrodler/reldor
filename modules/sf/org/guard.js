'use strict';

/**
 * Org safety. Returns { org, environment, production } for the org Reldor would use,
 * or { error } when there is no org to use.
 */
function resolveOrg(config, flags, defaultOrg) {
  const org = flags.org || config.reference_org || defaultOrg || null;
  if (!org) return { error: 'Qual org? Rode de novo com --org <alias> (o alias do sf CLI). Para não perguntar de novo: reldor env --org <alias>.' };
  const envs = config.environments || [];
  const env = envs.find((e) => e.org && e.org === org) || null;
  const prod = envs.find((e) => e.production === true) || envs[envs.length - 1];
  const production = Boolean(env && (env.deploy === 'blocked' || env.production === true || env === prod)) || /^(prod|production|producao)$/i.test(org);
  return { org, environment: env ? env.name : null, production };
}

module.exports = { resolveOrg };

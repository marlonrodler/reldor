'use strict';

/**
 * Org safety. Returns { org, environment, production } for the org Reldor would use,
 * or { error } when there is no org to use.
 */
function resolveOrg(config, flags, defaultOrg) {
  const org = flags.org || config.reference_org || defaultOrg || null;
  if (!org) return { error: 'Nenhuma org definida. Informe com --org <alias> ou defina reference_org na configuração.' };
  const envs = config.environments || [];
  const env = envs.find((e) => e.org && e.org === org) || null;
  const last = envs[envs.length - 1];
  const production = Boolean(env && (env.deploy === 'blocked' || env === last)) || /^(prod|production|producao)$/i.test(org);
  return { org, environment: env ? env.name : null, production };
}

module.exports = { resolveOrg };

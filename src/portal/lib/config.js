'use strict';

const crypto = require('node:crypto');
const path = require('node:path');

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function csv(value) {
  if (!value) {
    return [];
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function firstValue(env, names) {
  for (const name of names) {
    if (env[name]) {
      return env[name];
    }
  }

  return '';
}

function publicText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function hasAny(values) {
  return Object.values(values).some((value) => value !== undefined && value !== null && value !== '');
}

function missingRequired(values, requiredKeys) {
  return requiredKeys.filter((key) => !values[key]);
}

function ensureProviderRequest(requested) {
  const provider = String(requested || 'auto').trim().toLowerCase();
  if (!['auto', 'local', 'oidc', 'oauth2'].includes(provider)) {
    throw new Error(`Unsupported PORTAL_AUTH_PROVIDER [${requested}]. Expected auto, local, oidc, or oauth2.`);
  }

  return provider;
}

function readOidcConfig(env) {
  const providerSpecific = {
    issuerUrl: env.PORTAL_OIDC_ISSUER_URL || '',
    clientId: env.PORTAL_OIDC_CLIENT_ID || '',
    clientSecret: env.PORTAL_OIDC_CLIENT_SECRET || '',
    redirectUri: env.PORTAL_OIDC_REDIRECT_URI || ''
  };
  const raw = {
    issuerUrl: env.PORTAL_OIDC_ISSUER_URL || '',
    clientId: firstValue(env, ['PORTAL_OIDC_CLIENT_ID', 'PORTAL_IDP_CLIENT_ID']),
    clientSecret: firstValue(env, ['PORTAL_OIDC_CLIENT_SECRET', 'PORTAL_IDP_CLIENT_SECRET']),
    redirectUri: firstValue(env, ['PORTAL_OIDC_REDIRECT_URI', 'PORTAL_IDP_REDIRECT_URI'])
  };
  const values = {
    ...raw,
    scope: env.PORTAL_OIDC_SCOPE || 'openid profile email',
    clientAuth: env.PORTAL_OIDC_CLIENT_AUTH || env.PORTAL_IDP_CLIENT_AUTH || 'body',
    usePkce: parseBoolean(env.PORTAL_OIDC_USE_PKCE || env.PORTAL_IDP_USE_PKCE, true)
  };

  return {
    values,
    any: hasAny(providerSpecific),
    missing: missingRequired(raw, ['issuerUrl', 'clientId', 'clientSecret', 'redirectUri'])
  };
}

function readOauthConfig(env) {
  const providerSpecific = {
    authorizeUrl: env.PORTAL_OAUTH_AUTHORIZE_URL || '',
    tokenUrl: env.PORTAL_OAUTH_TOKEN_URL || '',
    userinfoUrl: env.PORTAL_OAUTH_USERINFO_URL || '',
    clientId: env.PORTAL_OAUTH_CLIENT_ID || '',
    clientSecret: env.PORTAL_OAUTH_CLIENT_SECRET || '',
    redirectUri: env.PORTAL_OAUTH_REDIRECT_URI || ''
  };
  const raw = {
    authorizeUrl: env.PORTAL_OAUTH_AUTHORIZE_URL || '',
    tokenUrl: env.PORTAL_OAUTH_TOKEN_URL || '',
    userinfoUrl: env.PORTAL_OAUTH_USERINFO_URL || '',
    clientId: firstValue(env, ['PORTAL_OAUTH_CLIENT_ID', 'PORTAL_IDP_CLIENT_ID']),
    clientSecret: firstValue(env, ['PORTAL_OAUTH_CLIENT_SECRET', 'PORTAL_IDP_CLIENT_SECRET']),
    redirectUri: firstValue(env, ['PORTAL_OAUTH_REDIRECT_URI', 'PORTAL_IDP_REDIRECT_URI'])
  };
  const values = {
    ...raw,
    scope: env.PORTAL_OAUTH_SCOPE || 'profile email',
    clientAuth: env.PORTAL_OAUTH_CLIENT_AUTH || env.PORTAL_IDP_CLIENT_AUTH || 'body',
    usePkce: parseBoolean(env.PORTAL_OAUTH_USE_PKCE || env.PORTAL_IDP_USE_PKCE, true)
  };

  return {
    values,
    any: hasAny(providerSpecific),
    missing: missingRequired(raw, [
      'authorizeUrl',
      'tokenUrl',
      'userinfoUrl',
      'clientId',
      'clientSecret',
      'redirectUri'
    ])
  };
}

function readAllowedRules(env) {
  return {
    users: csv(env.PORTAL_ALLOWED_USERS),
    emails: csv(env.PORTAL_ALLOWED_EMAILS).map((email) => email.toLowerCase()),
    groups: csv(env.PORTAL_ALLOWED_GROUPS)
  };
}

function readRoleGroups(env) {
  return {
    operator: csv(env.PORTAL_OPERATOR_GROUPS),
    admin: csv(env.PORTAL_ADMIN_GROUPS),
    readOnly: csv(env.PORTAL_READ_ONLY_GROUPS)
  };
}

function ensureExternalAuthorization(provider, allowed) {
  if (provider === 'local') {
    return;
  }

  if (allowed.users.length === 0 && allowed.emails.length === 0 && allowed.groups.length === 0) {
    throw new Error(
      'External IdP auth requires at least one of PORTAL_ALLOWED_USERS, PORTAL_ALLOWED_EMAILS, or PORTAL_ALLOWED_GROUPS.'
    );
  }
}

function readPublicStatusConfig(env) {
  return {
    serverName: publicText(firstValue(env, ['PORTAL_PUBLIC_SERVER_NAME', 'SERVER_NAME'])) || 'Project Zomboid Server',
    description: publicText(env.PORTAL_PUBLIC_DESCRIPTION)
  };
}

function resolveAuthProvider(env) {
  const requested = ensureProviderRequest(env.PORTAL_AUTH_PROVIDER);
  const oidc = readOidcConfig(env);
  const oauth = readOauthConfig(env);

  if (requested === 'local') {
    return { provider: 'local', oidc, oauth };
  }

  if (requested === 'oidc') {
    if (oidc.missing.length > 0) {
      throw new Error(`OIDC auth is missing required settings: ${oidc.missing.join(', ')}.`);
    }

    return { provider: 'oidc', oidc, oauth };
  }

  if (requested === 'oauth2') {
    if (oauth.missing.length > 0) {
      throw new Error(`OAuth2 auth is missing required settings: ${oauth.missing.join(', ')}.`);
    }

    return { provider: 'oauth2', oidc, oauth };
  }

  if (oidc.any && oidc.missing.length > 0) {
    throw new Error(`Partial OIDC auth configuration found; missing: ${oidc.missing.join(', ')}.`);
  }

  if (oauth.any && oauth.missing.length > 0) {
    throw new Error(`Partial OAuth2 auth configuration found; missing: ${oauth.missing.join(', ')}.`);
  }

  if (oidc.missing.length === 0) {
    return { provider: 'oidc', oidc, oauth };
  }

  if (oauth.missing.length === 0) {
    return { provider: 'oauth2', oidc, oauth };
  }

  return { provider: 'local', oidc, oauth };
}

function buildConfig(env = process.env) {
  const resolved = resolveAuthProvider(env);
  const allowed = readAllowedRules(env);
  ensureExternalAuthorization(resolved.provider, allowed);

  const sessionSecret = env.PORTAL_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
  const rconPort = env.RCON_PORT || '';
  const rconPassword = env.RCON_PASSWORD || '';
  const rconEnabled = Boolean(rconPort && rconPort !== '0' && rconPassword);

  return {
    port: parseInteger(env.PORTAL_PORT, 8080),
    host: env.PORTAL_HOST || '0.0.0.0',
    autoStart: parseBoolean(env.PORTAL_AUTO_START, true),
    dbPath: env.PORTAL_DB_PATH || '/home/steam/Zomboid/portal/portal.sqlite',
    sessionSecret,
    sessionCookieName: env.PORTAL_SESSION_COOKIE || 'pz_portal_session',
    sessionTtlMs: parseInteger(env.PORTAL_SESSION_TTL_SECONDS, 12 * 60 * 60) * 1000,
    secureCookies: parseBoolean(env.PORTAL_SECURE_COOKIES, false),
    logLines: parseInteger(env.PORTAL_LOG_LINES, 1000),
    scriptPath: env.PORTAL_SERVER_SCRIPT || '/home/steam/run_server.sh',
    scriptShell: env.PORTAL_SERVER_SHELL || '/bin/bash',
    safeCountdownSeconds: parseInteger(env.PORTAL_SAFE_ACTION_COUNTDOWN_SECONDS, 300),
    publicDir: env.PORTAL_PUBLIC_DIR || path.join(__dirname, '..', 'public'),
    publicStatus: readPublicStatusConfig(env),
    rcon: {
      enabled: rconEnabled,
      host: env.PORTAL_RCON_HOST || '',
      hostFile: env.PORTAL_RCON_HOST_FILE || '/home/steam/Zomboid/ip.txt',
      port: rconPort || '27015',
      password: rconPassword,
      binary: env.PORTAL_RCON_BINARY || 'rcon'
    },
    auth: {
      provider: resolved.provider,
      local: {
        adminUsername: env.PORTAL_ADMIN_USERNAME || 'admin',
        adminPassword: env.PORTAL_ADMIN_PASSWORD || ''
      },
      external: {
        allowed,
        roleGroups: readRoleGroups(env),
        usernameClaim: env.PORTAL_USERNAME_CLAIM || 'preferred_username',
        emailClaim: env.PORTAL_EMAIL_CLAIM || 'email',
        groupsClaim: env.PORTAL_GROUPS_CLAIM || 'groups',
        oidc: resolved.oidc.values,
        oauth2: resolved.oauth.values
      }
    }
  };
}

module.exports = {
  buildConfig,
  csv,
  parseBoolean,
  readPublicStatusConfig,
  resolveAuthProvider
};

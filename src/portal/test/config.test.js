'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildConfig, resolveAuthProvider } = require('../lib/config');

test('auto auth falls back to local when no external IdP is configured', () => {
  const resolved = resolveAuthProvider({});
  assert.equal(resolved.provider, 'local');
});

test('auto auth fails fast on partial OIDC configuration', () => {
  assert.throws(
    () => buildConfig({ PORTAL_OIDC_ISSUER_URL: 'https://idp.example.test' }),
    /Partial OIDC auth configuration/
  );
});

test('external auth requires an allow rule', () => {
  assert.throws(
    () => buildConfig({
      PORTAL_AUTH_PROVIDER: 'oidc',
      PORTAL_OIDC_ISSUER_URL: 'https://idp.example.test',
      PORTAL_OIDC_CLIENT_ID: 'client',
      PORTAL_OIDC_CLIENT_SECRET: 'secret',
      PORTAL_OIDC_REDIRECT_URI: 'https://portal.example.test/auth/callback'
    }),
    /External IdP auth requires/
  );
});

test('auto auth prefers complete OIDC configuration over local auth', () => {
  const config = buildConfig({
    PORTAL_OIDC_ISSUER_URL: 'https://idp.example.test',
    PORTAL_OIDC_CLIENT_ID: 'client',
    PORTAL_OIDC_CLIENT_SECRET: 'secret',
    PORTAL_OIDC_REDIRECT_URI: 'https://portal.example.test/auth/callback',
    PORTAL_ALLOWED_GROUPS: 'pz-users',
    PORTAL_OPERATOR_GROUPS: 'pz-operators',
    PORTAL_ADMIN_GROUPS: 'pz-admins',
    PORTAL_READ_ONLY_GROUPS: 'pz-viewers'
  });

  assert.equal(config.auth.provider, 'oidc');
  assert.deepEqual(config.auth.external.roleGroups, {
    operator: ['pz-operators'],
    admin: ['pz-admins'],
    readOnly: ['pz-viewers']
  });
});

test('RCON capability requires a nonzero port and password', () => {
  assert.equal(buildConfig({ RCON_PORT: '27015' }).rcon.enabled, false);
  assert.equal(buildConfig({ RCON_PORT: '0', RCON_PASSWORD: 'secret' }).rcon.enabled, false);

  const config = buildConfig({
    RCON_PORT: '27015',
    RCON_PASSWORD: 'secret',
    PORTAL_RCON_HOST: '127.0.0.1',
    PORTAL_SAFE_ACTION_COUNTDOWN_SECONDS: '30'
  });

  assert.equal(config.rcon.enabled, true);
  assert.equal(config.rcon.host, '127.0.0.1');
  assert.equal(config.safeCountdownSeconds, 30);
});

test('public status config keeps only public name and description settings', () => {
  const config = buildConfig({
    SERVER_NAME: 'Internal fallback',
    PUBLIC_SERVER: 'true',
    MAX_PLAYERS: '24',
    MAP_NAMES: 'Muldraugh, KY',
    GAME_VERSION: 'public',
    PORTAL_PUBLIC_SERVER_NAME: 'Public Server',
    PORTAL_PUBLIC_DESCRIPTION: 'A safe public blurb.',
    PORTAL_PUBLIC_SERVER_VISIBILITY: 'false',
    PORTAL_PUBLIC_MAX_PLAYERS: '12',
    PORTAL_PUBLIC_MAP: 'Rosewood',
    PORTAL_PUBLIC_GAME_VERSION: 'unstable'
  });

  assert.deepEqual(config.publicStatus, {
    serverName: 'Public Server',
    description: 'A safe public blurb.'
  });
});

test('public status config ignores retired public detail and player settings', () => {
  const config = buildConfig({
    SERVER_NAME: 'Fallback Server',
    PUBLIC_SERVER: 'false',
    MAX_PLAYERS: 'not-a-number',
    MAP_NAMES: 'Muldraugh, KY',
    GAME_VERSION: 'public',
    PORTAL_PUBLIC_SHOW_PLAYER_COUNT: 'true',
    PORTAL_PUBLIC_SHOW_PLAYER_NAMES: 'true'
  });

  assert.deepEqual(config.publicStatus, {
    serverName: 'Fallback Server',
    description: null
  });
});

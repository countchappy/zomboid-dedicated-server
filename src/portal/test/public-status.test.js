'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildConfig } = require('../lib/config');
const { buildPublicStatus, publicStateFromStatus } = require('../lib/public-status');

function status(overrides = {}) {
  return {
    preparation: {
      state: overrides.preparationState || 'complete',
      error: overrides.preparationError || ''
    },
    server: {
      state: overrides.serverState || 'stopped',
      ready: Boolean(overrides.ready),
      pid: 1234,
      lastExitCode: 1,
      lastExitSignal: 'SIGTERM',
      lastExitAt: '2026-05-17T00:00:00.000Z'
    },
    capabilities: {
      rcon: true
    },
    flow: {
      title: 'Startup Failed',
      kind: 'startup',
      phase: 'error',
      detail: 'Internal process detail',
      startedAt: '2026-05-17T00:00:00.000Z'
    },
    activeAction: {
      action: 'restart',
      username: 'admin',
      startedAt: '2026-05-17T00:00:00.000Z'
    }
  };
}

test('public state mapping exposes only high-level states', () => {
  assert.equal(publicStateFromStatus(status({ serverState: 'running' })), 'online');
  assert.equal(publicStateFromStatus(status({ serverState: 'starting' })), 'starting');
  assert.equal(publicStateFromStatus(status({ serverState: 'stopping' })), 'stopping');
  assert.equal(publicStateFromStatus(status({ serverState: 'stopped' })), 'offline');
  assert.equal(publicStateFromStatus(status({ serverState: 'errored' })), 'error');
  assert.equal(publicStateFromStatus(status({ preparationState: 'error', serverState: 'stopped' })), 'error');
  assert.equal(publicStateFromStatus(status({ serverState: 'mystery' })), 'unknown');
});

test('public status response is a whitelist DTO', () => {
  const config = buildConfig({
    PORTAL_PUBLIC_SERVER_NAME: 'Public Server',
    PORTAL_PUBLIC_DESCRIPTION: 'Weekend server.',
    PORTAL_PUBLIC_SERVER_VISIBILITY: 'true',
    PORTAL_PUBLIC_MAX_PLAYERS: '16',
    PORTAL_PUBLIC_MAP: 'Muldraugh, KY',
    PORTAL_PUBLIC_GAME_VERSION: 'unstable'
  });

  const payload = buildPublicStatus({
    config,
    status: status({ serverState: 'running', ready: true }),
    rconStatus: {
      updatedAt: '2026-05-17T09:59:00.000Z',
      stale: false,
      summary: {
        playersOnline: 3,
        players: ['puderug'],
        zombiesTotal: 144,
        zombiesKilledToday: 8
      }
    },
    now: () => new Date('2026-05-17T10:00:00.000Z')
  });

  assert.deepEqual(payload, {
    serverName: 'Public Server',
    description: 'Weekend server.',
    state: 'online',
    ready: true,
    metrics: {
      playersOnline: 3,
      zombiesTotal: 144,
      zombiesKilledToday: 8,
      updatedAt: '2026-05-17T09:59:00.000Z',
      stale: false
    },
    updatedAt: '2026-05-17T10:00:00.000Z'
  });

  assert.deepEqual(Object.keys(payload).sort(), [
    'description',
    'metrics',
    'ready',
    'serverName',
    'state',
    'updatedAt'
  ]);
});

test('public status does not include sensitive internal status fields or values', () => {
  const payload = buildPublicStatus({
    config: buildConfig({
      PORTAL_PUBLIC_SHOW_PLAYER_COUNT: 'true',
      PORTAL_PUBLIC_SHOW_PLAYER_NAMES: 'true',
      PORTAL_PUBLIC_MAX_PLAYERS: '16',
      PORTAL_PUBLIC_MAP: 'Muldraugh, KY',
      PORTAL_PUBLIC_GAME_VERSION: 'unstable'
    }),
    status: status({ preparationState: 'error', preparationError: 'path /home/steam/run_server.sh failed' }),
    rconStatus: {
      updatedAt: '2026-05-17T09:59:00.000Z',
      stale: true,
      error: 'RCON secret failed',
      summary: {
        playersOnline: 2,
        players: ['puderug'],
        zombiesTotal: 12,
        zombiesKilledToday: 5,
        fps: 99,
        memoryUsed: 256
      },
      sections: [
        {
          title: 'Network',
          metrics: [{ key: 'sent-bps', value: 5 }]
        }
      ]
    },
    now: () => new Date('2026-05-17T10:00:00.000Z')
  });
  const text = JSON.stringify(payload);

  for (const forbidden of [
    'preparation',
    'error',
    'pid',
    'lastExitCode',
    'lastExitSignal',
    'lastExitAt',
    'capabilities',
    'rcon',
    'flow',
    'activeAction',
    'username',
    'admin',
    '/home/steam',
    'Internal process detail',
    'maxPlayers',
    'Muldraugh',
    'unstable',
    'sent-bps',
    'Network',
    'RCON secret failed',
    'fps',
    'memoryUsed',
    'puderug'
  ]) {
    if (forbidden === 'error') {
      assert.equal(payload.state, 'error');
    } else {
      assert.equal(text.includes(forbidden), false, `Public payload leaked ${forbidden}`);
    }
  }

  assert.deepEqual(payload.metrics, {
    playersOnline: 2,
    zombiesTotal: 12,
    zombiesKilledToday: 5,
    updatedAt: '2026-05-17T09:59:00.000Z',
    stale: true
  });
});

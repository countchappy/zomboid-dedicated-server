'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  PLAYERS_COMMAND,
  RCON_STATUS_REFRESH_INTERVAL_MS,
  RconStatusCache,
  STATUS_COMMANDS,
  buildRconStatusSnapshot,
  parsePlayers,
  parsePlayersOnline,
  parseStatsOutput
} = require('../lib/rcon-status');

const outputs = {
  network: `
packet-loss-last-second: 0.0
sent-bps: 42.5
received-bps: 24.0
sent-packets: 8.0
`,
  connection: `
zombies-killed-today: 7.0
players-killed-by-fire-today: 0.0
burned-corpses-today: 1.0
`,
  performance: `
memory-total: 7851.0
memory-free: 5182.0
memory-used: 2669.0
memory-max: 8589.0
fps: 103.0
`,
  game: `
zombies-loaded: 3.0
players: 1.0
zombies-total: 120.0
`,
  players: 'Players connected (2):\n- alice\n- casey\n'
};

function stdoutFor(command) {
  const descriptor = STATUS_COMMANDS.find((entry) => entry.command === command);
  if (descriptor) {
    return outputs[descriptor.id];
  }
  if (command === PLAYERS_COMMAND) {
    return outputs.players;
  }
  throw new Error(`Unexpected command ${command}`);
}

test('RCON status parser reads stats and safe summary metrics', () => {
  const snapshot = buildRconStatusSnapshot(outputs, new Date('2026-05-18T12:00:00.000Z'));

  assert.deepEqual(snapshot.summary, {
    playersOnline: 2,
    players: ['alice', 'casey'],
    zombiesTotal: 120,
    zombiesKilledToday: 7,
    fps: 103,
    memoryUsed: 2669,
    memoryMax: 8589,
    sentBps: 42.5,
    receivedBps: 24,
    packetLossLastSecond: 0
  });
  assert.deepEqual(snapshot.sections.map((section) => section.id), ['network', 'connection', 'performance', 'game']);
  assert.equal(snapshot.sections[0].metrics[0].key, 'packet-loss-last-second');
});

test('RCON status parser handles empty players output and falls back to game player count', () => {
  const snapshot = buildRconStatusSnapshot({
    ...outputs,
    game: 'players: 4.0\nzombies-total: 15.0\n',
    players: ''
  });

  assert.equal(parsePlayersOnline('Players connected (0):'), 0);
  assert.equal(parsePlayersOnline('not a players response'), null);
  assert.equal(snapshot.summary.playersOnline, 4);
  assert.deepEqual(snapshot.summary.players, []);
});

test('RCON status parser reads player names from Zomboid RCON output', () => {
  const parsed = parsePlayers(`Zomboid RCON Server Response:
Players connected (1):
-puderug
`);

  assert.deepEqual(parsed, {
    online: 1,
    names: ['puderug']
  });
});

test('stats parser ignores wrapper lines and keeps metric order', () => {
  const parsed = parseStatsOutput('Sent\n\nstdout:\nfps: 60.0\nmemory-used: 512.0\n');

  assert.deepEqual(parsed.metrics.map((metric) => metric.key), ['fps', 'memory-used']);
  assert.equal(parsed.values.fps, 60);
  assert.equal(parsed.values['memory-used'], 512);
});

test('RCON status cache reuses snapshots and refreshes after the 30 second interval', async () => {
  let nowMs = Date.parse('2026-05-18T12:00:00.000Z');
  const calls = [];
  const cache = new RconStatusCache({
    enabled: () => true,
    now: () => new Date(nowMs),
    runCommand: async (command) => {
      calls.push(command);
      return { stdout: stdoutFor(command) };
    }
  });

  const first = await cache.getStatus();
  const second = await cache.getStatus();
  assert.equal(first.summary.playersOnline, 2);
  assert.equal(second.updatedAt, first.updatedAt);
  assert.deepEqual(calls, [...STATUS_COMMANDS.map((entry) => entry.command), PLAYERS_COMMAND]);

  nowMs += RCON_STATUS_REFRESH_INTERVAL_MS + 1;
  await cache.getStatus();
  assert.equal(calls.length, 10);

  await cache.getStatus({ refresh: true });
  assert.equal(calls.length, 15);
});

test('RCON status cache returns last known stale snapshot when refresh fails', async () => {
  let nowMs = Date.parse('2026-05-18T12:00:00.000Z');
  let fail = false;
  const cache = new RconStatusCache({
    enabled: () => true,
    now: () => new Date(nowMs),
    runCommand: async (command) => {
      if (fail) {
        throw new Error('connection refused');
      }
      return { stdout: stdoutFor(command) };
    }
  });

  const first = await cache.getStatus();
  nowMs += RCON_STATUS_REFRESH_INTERVAL_MS + 1;
  fail = true;

  const stale = await cache.getStatus();
  assert.equal(stale.updatedAt, first.updatedAt);
  assert.equal(stale.stale, true);
  assert.equal(stale.error, 'connection refused');
  assert.equal(stale.summary.zombiesKilledToday, 7);
});

test('RCON status cache reports unavailable when RCON is disabled', async () => {
  const cache = new RconStatusCache({ enabled: () => false });
  const status = await cache.getStatus();

  assert.equal(status.available, false);
  assert.equal(status.error, 'RCON is not enabled.');
  assert.equal(status.summary.playersOnline, null);
});

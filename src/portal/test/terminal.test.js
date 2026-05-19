'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const bcrypt = require('bcryptjs');
const { createApp } = require('../server');
const { buildConfig } = require('../lib/config');
const { PortalDatabase } = require('../lib/database');
const { parsePortalCommand, terminalOwnerKey } = require('../lib/terminal');

function tempDbPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pz-portal-')), 'portal.sqlite');
}

function createStubController(options = {}) {
  const actions = [];
  const rconCommands = [];
  const status = {
    preparation: { state: 'complete', error: '' },
    server: { state: 'running', ready: true, pid: 4321 },
    capabilities: { rcon: options.rconEnabled !== false },
    activeAction: null
  };

  return {
    actions,
    rconCommands,
    getStatus() {
      return status;
    },
    getLogs() {
      return [];
    },
    async getRconStatus() {
      return { available: Boolean(status.capabilities.rcon), summary: {}, sections: [] };
    },
    async runAction(action, user, actionOptions = {}) {
      actions.push({
        action,
        username: user?.username,
        checkUpdates: Boolean(actionOptions.checkUpdates),
        countdownSeconds: actionOptions.countdownSeconds ?? null
      });
      return status;
    },
    async runRconCommandLine(commandLine) {
      rconCommands.push(commandLine);
      if (commandLine === 'fail') {
        const error = new Error('RCON command [fail] failed with code 1.');
        error.result = {
          command: 'fail',
          args: [],
          commandLine,
          stdout: '',
          stderr: 'nope\n',
          code: 1,
          signal: null
        };
        throw error;
      }

      return {
        command: commandLine.split(/\s+/)[0],
        args: commandLine.split(/\s+/).slice(1),
        commandLine,
        stdout: `ran ${commandLine}\n`,
        stderr: '',
        code: 0,
        signal: null
      };
    }
  };
}

function getCookie(response) {
  const cookie = response.headers.get('set-cookie');
  assert.ok(cookie);
  return cookie.split(';')[0];
}

async function login(baseUrl, username, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  assert.equal(response.status, 200);
  return getCookie(response);
}

async function postTerminal(baseUrl, cookie, command) {
  const response = await fetch(`${baseUrl}/api/terminal/commands`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ command })
  });
  const body = await response.json();
  return { response, body };
}

test('portal terminal parser maps commands and flags', () => {
  assert.deepEqual(parsePortalCommand('!help'), { type: 'help' });
  assert.deepEqual(parsePortalCommand('!history clear'), { type: 'clearHistory' });
  assert.deepEqual(parsePortalCommand('!start --check-updates'), {
    type: 'action',
    action: 'start',
    checkUpdates: true
  });
  assert.deepEqual(parsePortalCommand('!start -c'), {
    type: 'action',
    action: 'start',
    checkUpdates: true
  });
  assert.deepEqual(parsePortalCommand('!stop'), {
    type: 'action',
    action: 'safe_stop',
    checkUpdates: false,
    countdownSeconds: null
  });
  assert.deepEqual(parsePortalCommand('!stop -u'), {
    type: 'action',
    action: 'stop',
    checkUpdates: false,
    countdownSeconds: null
  });
  assert.deepEqual(parsePortalCommand('!stop --countdown-seconds 300'), {
    type: 'action',
    action: 'safe_stop',
    checkUpdates: false,
    countdownSeconds: 300
  });
  assert.deepEqual(parsePortalCommand('!restart -u --check-updates'), {
    type: 'action',
    action: 'restart',
    checkUpdates: true,
    countdownSeconds: null
  });
  assert.deepEqual(parsePortalCommand('!restart --unsafe -c'), {
    type: 'action',
    action: 'restart',
    checkUpdates: true,
    countdownSeconds: null
  });
  assert.deepEqual(parsePortalCommand('!restart -c -t 600'), {
    type: 'action',
    action: 'safe_restart',
    checkUpdates: true,
    countdownSeconds: 600
  });
  assert.throws(() => parsePortalCommand('!start --unsafe'), /not supported/);
  assert.throws(() => parsePortalCommand('!stop -t 59'), /between 60 and 900/);
  assert.throws(() => parsePortalCommand('!restart --unsafe --countdown-seconds 300'), /only apply to safe restart/);
  assert.throws(() => parsePortalCommand('!wat'), /Unknown portal command/);
});

test('terminal history is per-user, chronological, duplicate-preserving, and capped', async () => {
  const db = new PortalDatabase(tempDbPath());
  test.after(() => db.close());

  for (let index = 0; index < 105; index += 1) {
    db.recordTerminalEntry('local:1', 'operator', {
      input: index % 2 === 0 ? '/players' : `/command-${index}`,
      kind: 'rcon',
      status: 'completed',
      command: 'players',
      stdout: `${index}\n`
    });
  }
  db.recordTerminalEntry('local:2', 'other', {
    input: '/other',
    kind: 'rcon',
    status: 'completed'
  });

  const history = db.listTerminalHistory('local:1', 100);
  assert.equal(history.length, 100);
  assert.equal(history[0].input, '/command-5');
  assert.equal(history.at(-1).stdout, '104\n');
  assert.equal(history.filter((entry) => entry.input === '/players').length, 50);
  assert.equal(db.listTerminalHistory('local:2', 100).length, 1);
});

test('terminal APIs are operator-only and route prefixed RCON commands', async () => {
  const config = buildConfig({
    PORTAL_AUTH_PROVIDER: 'local',
    PORTAL_ADMIN_USERNAME: 'operator',
    PORTAL_ADMIN_PASSWORD: 'secret',
    PORTAL_DB_PATH: tempDbPath()
  });
  const db = new PortalDatabase(config.dbPath);
  db.createUser('admin', await bcrypt.hash('adminpass', 4), 'admin');
  const controller = createStubController();
  const { app, bootstrap } = createApp({ config, db, controller });
  await bootstrap();

  const server = app.listen(0);
  test.after(() => {
    server.close();
    db.close();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const adminCookie = await login(baseUrl, 'admin', 'adminpass');
  const operatorCookie = await login(baseUrl, 'operator', 'secret');

  assert.equal((await fetch(`${baseUrl}/api/terminal/history`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/terminal/history`, { headers: { cookie: adminCookie } })).status, 403);

  let result = await postTerminal(baseUrl, operatorCookie, '/servermsg "hello"');
  assert.equal(result.response.status, 200);
  assert.equal(result.body.entry.kind, 'rcon');
  assert.equal(result.body.entry.command, 'servermsg "hello"');
  assert.equal(result.body.entry.stdout, 'ran servermsg "hello"\n');

  result = await postTerminal(baseUrl, operatorCookie, '\\players');
  assert.equal(result.body.entry.command, 'players');
  assert.deepEqual(controller.rconCommands, ['servermsg "hello"', 'players']);

  result = await postTerminal(baseUrl, operatorCookie, 'players');
  assert.equal(result.body.entry.status, 'failed');
  assert.match(result.body.entry.message, /Prefix RCON commands/);

  const history = await fetch(`${baseUrl}/api/terminal/history`, { headers: { cookie: operatorCookie } });
  assert.equal(history.status, 200);
  assert.deepEqual((await history.json()).entries.map((entry) => entry.input), [
    '/servermsg "hello"',
    '\\players',
    'players'
  ]);
});

test('terminal persists output, failed commands, and clears history without reinserting clear', async () => {
  const config = buildConfig({
    PORTAL_AUTH_PROVIDER: 'local',
    PORTAL_ADMIN_USERNAME: 'operator',
    PORTAL_ADMIN_PASSWORD: 'secret',
    PORTAL_DB_PATH: tempDbPath()
  });
  const db = new PortalDatabase(config.dbPath);
  const controller = createStubController();
  const { app, bootstrap } = createApp({ config, db, controller });
  await bootstrap();

  const server = app.listen(0);
  test.after(() => {
    server.close();
    db.close();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl, 'operator', 'secret');

  let result = await postTerminal(baseUrl, cookie, '/fail');
  assert.equal(result.body.entry.status, 'failed');
  assert.equal(result.body.entry.stderr, 'nope\n');
  assert.equal(result.body.entry.code, 1);

  result = await postTerminal(baseUrl, cookie, '!help');
  assert.equal(result.body.entry.status, 'completed');
  assert.match(result.body.entry.message, /!history clear/);

  result = await postTerminal(baseUrl, cookie, '!history clear');
  assert.equal(result.body.cleared, true);

  const history = await fetch(`${baseUrl}/api/terminal/history`, { headers: { cookie } });
  assert.deepEqual((await history.json()).entries, []);
});

test('terminal portal commands run mapped actions and update audit history', async () => {
  const config = buildConfig({
    PORTAL_AUTH_PROVIDER: 'local',
    PORTAL_ADMIN_USERNAME: 'operator',
    PORTAL_ADMIN_PASSWORD: 'secret',
    PORTAL_DB_PATH: tempDbPath()
  });
  const db = new PortalDatabase(config.dbPath);
  const controller = createStubController();
  const { app, bootstrap } = createApp({ config, db, controller });
  await bootstrap();

  const server = app.listen(0);
  test.after(() => {
    server.close();
    db.close();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl, 'operator', 'secret');

  await postTerminal(baseUrl, cookie, '!start -c');
  await postTerminal(baseUrl, cookie, '!stop --countdown-seconds 300');
  await postTerminal(baseUrl, cookie, '!stop --unsafe');
  await postTerminal(baseUrl, cookie, '!restart -c -t 600');
  await postTerminal(baseUrl, cookie, '!restart -u --check-updates');

  assert.deepEqual(controller.actions, [
    { action: 'start', username: 'operator', checkUpdates: true, countdownSeconds: null },
    { action: 'safe_stop', username: 'operator', checkUpdates: false, countdownSeconds: 300 },
    { action: 'stop', username: 'operator', checkUpdates: false, countdownSeconds: null },
    { action: 'safe_restart', username: 'operator', checkUpdates: true, countdownSeconds: 600 },
    { action: 'restart', username: 'operator', checkUpdates: true, countdownSeconds: null }
  ]);

  const actionAudit = db.listRecentActions(10, 'operator');
  assert.equal(actionAudit.filter((entry) => entry.status === 'completed').length, 5);
});

test('safe terminal actions return guidance when RCON is unavailable', async () => {
  const config = buildConfig({
    PORTAL_AUTH_PROVIDER: 'local',
    PORTAL_ADMIN_USERNAME: 'operator',
    PORTAL_ADMIN_PASSWORD: 'secret',
    PORTAL_DB_PATH: tempDbPath()
  });
  const db = new PortalDatabase(config.dbPath);
  const controller = createStubController({ rconEnabled: false });
  const { app, bootstrap } = createApp({ config, db, controller });
  await bootstrap();

  const server = app.listen(0);
  test.after(() => {
    server.close();
    db.close();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl, 'operator', 'secret');

  const result = await postTerminal(baseUrl, cookie, '!stop');
  assert.equal(result.response.status, 200);
  assert.equal(result.body.entry.status, 'failed');
  assert.match(result.body.entry.message, /Use --unsafe/);
  assert.deepEqual(controller.actions, []);
});

test('terminal owner keys are stable for local and external users', () => {
  assert.equal(terminalOwnerKey({ provider: 'local', userId: 42, username: 'casey' }), 'local:42');
  assert.equal(
    terminalOwnerKey({ provider: 'oidc', subject: 'abc123', username: 'casey' }),
    'oidc:abc123'
  );
});

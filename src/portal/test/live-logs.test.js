'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const bcrypt = require('bcryptjs');
const { WebSocket } = require('ws');
const { attachPzLiveWebSocket, createApp } = require('../server');
const { buildConfig } = require('../lib/config');
const { PortalDatabase } = require('../lib/database');
const { ServerController } = require('../lib/server-control');

function tempDbPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pz-portal-')), 'portal.sqlite');
}

async function createPortalServer(options = {}) {
  const config = buildConfig({
    PORTAL_AUTH_PROVIDER: 'local',
    PORTAL_ADMIN_USERNAME: 'admin',
    PORTAL_ADMIN_PASSWORD: 'secret',
    PORTAL_DB_PATH: tempDbPath()
  });
  const db = new PortalDatabase(config.dbPath);
  const controller = new ServerController({
    scriptPath: 'unused',
    scriptShell: process.execPath,
    autoStart: false,
    logLines: 10,
    env: process.env
  });
  const { app, auth, bootstrap } = createApp({ config, db, controller });
  await bootstrap();
  const server = http.createServer(app);
  const pzLive = attachPzLiveWebSocket(server, {
    auth,
    controller,
    logBatchMs: options.logBatchMs ?? 100
  });
  server.listen(0);
  await once(server, 'listening');

  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    controller,
    db,
    pzLive,
    server
  };
}

async function closePortal(portal) {
  for (const client of portal.pzLive.clients) {
    client.terminate();
  }
  await new Promise((resolve) => portal.pzLive.close(() => resolve()));
  await new Promise((resolve) => {
    portal.server.close(() => resolve());
    portal.server.closeAllConnections?.();
  });
  portal.db.close();
}

function getCookie(response) {
  const cookie = response.headers.get('set-cookie');
  assert.ok(cookie);
  return cookie.split(';')[0];
}

async function authenticatedWebSocket(
  portal,
  pathName = '/api/server/live',
  credentials = { username: 'admin', password: 'secret' }
) {
  const login = await fetch(`${portal.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  const cookie = getCookie(login);
  await login.text();

  return new WebSocket(`${portal.baseUrl.replace('http:', 'ws:')}${pathName}`, {
    headers: { cookie }
  });
}

function createJsonReader(ws) {
  const queue = [];
  const waiters = [];

  ws.on('message', (message) => {
    const payload = JSON.parse(message.toString());
    const waiter = waiters.shift();
    if (waiter) {
      waiter(payload);
    } else {
      queue.push(payload);
    }
  });

  async function readJson() {
    if (queue.length > 0) {
      return queue.shift();
    }

    return Promise.race([
      new Promise((resolve) => waiters.push(resolve)),
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error('Timed out waiting for websocket message.')), 2000))
    ]);
  }

  return async function readUntil(predicate, limit = 6) {
    for (let index = 0; index < limit; index += 1) {
      const payload = await readJson();
      if (predicate(payload)) {
        return payload;
      }
    }

    throw new Error('Expected websocket message was not received.');
  };
}

test('PZ live websocket rejects unauthenticated clients', async (t) => {
  const portal = await createPortalServer();
  t.after(async () => {
    await closePortal(portal);
  });

  await new Promise((resolve, reject) => {
    const request = http.request(`${portal.baseUrl}/api/server/live`, {
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'),
        'Sec-WebSocket-Version': '13'
      }
    });
    request.on('response', (response) => {
      assert.equal(response.statusCode, 401);
      response.resume();
      response.on('end', resolve);
    });
    request.on('upgrade', () => reject(new Error('Unauthenticated websocket unexpectedly upgraded.')));
    request.on('error', reject);
    request.end();
  });
});

test('legacy live log websocket path remains accepted', async (t) => {
  const portal = await createPortalServer();
  t.after(async () => {
    await closePortal(portal);
  });

  const ws = await authenticatedWebSocket(portal, '/api/server/logs/live');
  const readUntil = createJsonReader(ws);

  const connected = await readUntil((payload) => payload.type === 'connected');
  assert.equal(connected.user.username, 'admin');

  const closed = once(ws, 'close');
  ws.close();
  await closed;
});

test('PZ live websocket sends initial status, initial logs, and appended logs', async (t) => {
  const portal = await createPortalServer({ logBatchMs: 10 });
  t.after(async () => {
    await closePortal(portal);
  });

  portal.controller.appendLog('test', 'existing line');

  const ws = await authenticatedWebSocket(portal);
  const readUntil = createJsonReader(ws);

  const connected = await readUntil((payload) => payload.type === 'connected');
  assert.equal(connected.user.username, 'admin');

  const initialStatus = await readUntil((payload) => payload.type === 'status');
  assert.equal(initialStatus.status.server.state, 'stopped');

  const initialLogs = await readUntil((payload) => payload.type === 'logs');
  assert.equal(initialLogs.mode, 'replace');
  assert.equal(initialLogs.replace, true);
  assert.equal(initialLogs.entries.length, 1);
  assert.equal(initialLogs.entries[0].line, 'existing line');

  portal.controller.appendLog('test', 'broadcast line');
  const payload = await readUntil((message) => message.type === 'logs' && message.mode === 'append');

  assert.equal(payload.type, 'logs');
  assert.equal(payload.replace, false);
  assert.equal(payload.entries.length, 1);
  assert.equal(payload.entries[0].source, 'test');
  assert.equal(payload.entries[0].line, 'broadcast line');

  const closed = once(ws, 'close');
  ws.close();
  await closed;
});

test('PZ live websocket hides RCON logs from admin users', async (t) => {
  const portal = await createPortalServer({ logBatchMs: 10 });
  t.after(async () => {
    await closePortal(portal);
  });

  portal.db.createUser('casey', await bcrypt.hash('adminpass', 4), 'admin');
  portal.controller.appendLog('test', 'existing line');
  portal.controller.appendLog('rcon:stdout', 'existing rcon stdout');
  portal.controller.appendLog('stdout:rcon', 'existing legacy rcon source');
  portal.controller.appendLog('rcon:stderr', 'existing rcon stderr');

  const ws = await authenticatedWebSocket(
    portal,
    '/api/server/live',
    { username: 'casey', password: 'adminpass' }
  );
  const readUntil = createJsonReader(ws);

  await readUntil((payload) => payload.type === 'connected');
  await readUntil((payload) => payload.type === 'status');

  const initialLogs = await readUntil((payload) => payload.type === 'logs' && payload.mode === 'replace');
  assert.deepEqual(initialLogs.entries.map((entry) => entry.source), ['test']);

  portal.controller.appendLog('rcon:stdout', 'hidden rcon append');
  portal.controller.appendLog('test', 'visible append');

  const appendLogs = await readUntil((payload) => payload.type === 'logs' && payload.mode === 'append');
  assert.deepEqual(appendLogs.entries.map((entry) => entry.source), ['test']);
  assert.deepEqual(appendLogs.entries.map((entry) => entry.line), ['visible append']);

  const closed = once(ws, 'close');
  ws.close();
  await closed;
});

test('PZ live websocket batches logs while status events remain immediate', async (t) => {
  const portal = await createPortalServer({ logBatchMs: 30 });
  t.after(async () => {
    await closePortal(portal);
  });

  const ws = await authenticatedWebSocket(portal);
  const readUntil = createJsonReader(ws);

  await readUntil((payload) => payload.type === 'connected');
  await readUntil((payload) => payload.type === 'status');
  await readUntil((payload) => payload.type === 'logs' && payload.mode === 'replace');

  portal.controller.appendLog('test', 'line 1');
  portal.controller.appendLog('test', 'line 2');
  portal.controller.emitStatus();

  const status = await readUntil((payload) => payload.type === 'status');
  assert.equal(status.status.server.state, 'stopped');

  const logs = await readUntil((payload) => payload.type === 'logs');
  assert.deepEqual(logs.entries.map((entry) => entry.line), ['line 1', 'line 2']);

  const closed = once(ws, 'close');
  ws.close();
  await closed;
});

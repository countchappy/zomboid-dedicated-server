'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const test = require('node:test');
const bcrypt = require('bcryptjs');
const { createApp } = require('../server');
const { buildConfig } = require('../lib/config');
const { PortalDatabase } = require('../lib/database');

function tempDbPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pz-portal-')), 'portal.sqlite');
}

function createStubController() {
  return {
    getStatus() {
      return {
        preparation: { state: 'complete', error: '' },
        server: {
          state: 'stopped',
          ready: false,
          pid: 4321,
          lastExitCode: 1,
          lastExitSignal: 'SIGTERM',
          lastExitAt: '2026-05-17T00:00:00.000Z'
        },
        capabilities: { rcon: true },
        flow: { detail: 'Internal process detail' },
        activeAction: { action: 'restart', username: 'admin' }
      };
    },
    getLogs() {
      return [{ timestamp: '2026-05-17T00:00:00.000Z', source: 'test', line: 'ready' }];
    },
    async runAction(action) {
      return {
        preparation: { state: 'complete', error: '' },
        server: { state: action === 'start' ? 'starting' : 'stopped', ready: false, pid: 1234 },
        activeAction: null
      };
    },
    async runRconCommandLine(command) {
      return {
        command: command.split(/\s+/)[0],
        args: command.split(/\s+/).slice(1),
        stdout: 'ok\n',
        stderr: '',
        code: 0,
        signal: null
      };
    },
    async getRconStatus() {
      return {
        available: true,
        refreshing: false,
        stale: false,
        updatedAt: '2026-05-17T00:00:00.000Z',
        error: '',
        summary: {
          playersOnline: 2,
          players: ['puderug', 'casey'],
          zombiesTotal: 25,
          zombiesKilledToday: 4,
          fps: 60,
          memoryUsed: 1024,
          memoryMax: 2048,
          sentBps: 5,
          receivedBps: 6,
          packetLossLastSecond: 0
        },
        sections: [
          {
            id: 'game',
            title: 'Game',
            metrics: [{ key: 'zombies-total', label: 'Zombies Total', value: 25, raw: '25.0' }]
          }
        ]
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

test('local auth bootstraps a protected operator and protects server APIs', async () => {
  const config = buildConfig({
    PORTAL_AUTH_PROVIDER: 'local',
    PORTAL_ADMIN_USERNAME: 'admin',
    PORTAL_ADMIN_PASSWORD: 'secret',
    PORTAL_DB_PATH: tempDbPath()
  });
  const db = new PortalDatabase(config.dbPath);
  const { app, bootstrap } = createApp({ config, db, controller: createStubController() });
  await bootstrap();

  const server = app.listen(0);
  test.after(() => {
    server.close();
    db.close();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const landingPage = await fetch(`${baseUrl}/`);
  assert.equal(landingPage.status, 200);
  const landingHtml = await landingPage.text();
  assert.match(landingHtml, /Public server status/);
  assert.match(landingHtml, /landing\.js/);

  const anonymousManagement = await fetch(`${baseUrl}/manage`, { redirect: 'manual' });
  assert.equal(anonymousManagement.status, 302);
  assert.equal(anonymousManagement.headers.get('location'), '/');

  const publicStatus = await fetch(`${baseUrl}/api/public/status`);
  assert.equal(publicStatus.status, 200);
  const publicBody = await publicStatus.json();
  assert.equal(publicBody.serverName, 'Project Zomboid Server');
  assert.deepEqual(publicBody.metrics, {
    playersOnline: 2,
    zombiesTotal: 25,
    zombiesKilledToday: 4,
    updatedAt: '2026-05-17T00:00:00.000Z',
    stale: false
  });
  const publicText = JSON.stringify(publicBody);
  assert.equal(publicText.includes('4321'), false);
  assert.equal(publicText.includes('SIGTERM'), false);
  assert.equal(publicText.includes('rcon'), false);
  assert.equal(publicText.includes('Internal process detail'), false);
  assert.equal(publicText.includes('admin'), false);
  assert.equal(publicText.includes('zombies-total'), false);

  const anonymousStatus = await fetch(`${baseUrl}/api/server/status`);
  assert.equal(anonymousStatus.status, 401);

  const anonymousLogs = await fetch(`${baseUrl}/api/server/logs`);
  assert.equal(anonymousLogs.status, 401);

  const anonymousActions = await fetch(`${baseUrl}/api/server/actions/recent`);
  assert.equal(anonymousActions.status, 401);

  const anonymousActionPost = await fetch(`${baseUrl}/api/server/actions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'start' })
  });
  assert.equal(anonymousActionPost.status, 401);

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'secret' })
  });
  assert.equal(login.status, 200);

  const cookie = getCookie(login);
  const managementPage = await fetch(`${baseUrl}/manage`, {
    headers: { cookie }
  });
  assert.equal(managementPage.status, 200);
  const managementHtml = await managementPage.text();
  assert.match(managementHtml, /Operations Dashboard/);
  assert.match(managementHtml, /app\.js/);
  assert.doesNotMatch(managementHtml, /id="loginForm"/);

  const me = await fetch(`${baseUrl}/api/me`, {
    headers: { cookie }
  });
  assert.equal(me.status, 200);
  const meBody = await me.json();
  assert.equal(meBody.user.role, 'operator');
  assert.equal(meBody.user.protectedOperator, true);
  assert.equal(meBody.user.mustChangePassword, false);

  const status = await fetch(`${baseUrl}/api/server/status`, {
    headers: { cookie }
  });
  assert.equal(status.status, 200);
  assert.equal((await status.json()).preparation.state, 'complete');
});

test('recent action audit is authenticated, capped, and newest first', async () => {
  const config = buildConfig({
    PORTAL_AUTH_PROVIDER: 'local',
    PORTAL_ADMIN_USERNAME: 'admin',
    PORTAL_ADMIN_PASSWORD: 'secret',
    PORTAL_DB_PATH: tempDbPath()
  });
  const db = new PortalDatabase(config.dbPath);
  db.recordAction('admin', 'start', 'started');
  db.recordAction('admin', 'start', 'completed');
  db.recordAction('casey', 'restart', 'failed', 'Already running');
  const { app, bootstrap } = createApp({ config, db, controller: createStubController() });
  await bootstrap();

  const server = app.listen(0);
  test.after(() => {
    server.close();
    db.close();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const anonymous = await fetch(`${baseUrl}/api/server/actions/recent`);
  assert.equal(anonymous.status, 401);

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'secret' })
  });
  const cookie = getCookie(login);
  const response = await fetch(`${baseUrl}/api/server/actions/recent?limit=2`, {
    headers: { cookie }
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.actions.length, 2);
  assert.deepEqual(
    body.actions.map((entry) => [entry.username, entry.action, entry.status, entry.message]),
    [
      ['casey', 'restart', 'failed', 'Already running'],
      ['admin', 'start', 'completed', '']
    ]
  );
  assert.equal(typeof body.actions[0].createdAt, 'number');
});

test('recent action audit filters entries by viewer role requirement', async () => {
  const config = buildConfig({
    PORTAL_AUTH_PROVIDER: 'local',
    PORTAL_ADMIN_USERNAME: 'operator',
    PORTAL_ADMIN_PASSWORD: 'secret',
    PORTAL_DB_PATH: tempDbPath()
  });
  const db = new PortalDatabase(config.dbPath);
  db.createUser('admin', await bcrypt.hash('adminpass', 4), 'admin');
  db.recordAction('admin', 'start', 'completed', '', 'admin');
  db.recordAction('operator', 'rcon_command', 'completed', 'command: servermsg', 'operator');
  db.recordAction('operator', 'restart', 'completed', '', 'admin');
  const { app, bootstrap } = createApp({ config, db, controller: createStubController() });
  await bootstrap();

  const server = app.listen(0);
  test.after(() => {
    server.close();
    db.close();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const adminCookie = await login(baseUrl, 'admin', 'adminpass');
  const operatorCookie = await login(baseUrl, 'operator', 'secret');

  const adminResponse = await fetch(`${baseUrl}/api/server/actions/recent`, {
    headers: { cookie: adminCookie }
  });
  assert.equal(adminResponse.status, 200);
  const adminBody = await adminResponse.json();
  assert.deepEqual(
    adminBody.actions.map((entry) => [entry.username, entry.action, entry.status]),
    [
      ['operator', 'restart', 'completed'],
      ['admin', 'start', 'completed']
    ]
  );

  const operatorResponse = await fetch(`${baseUrl}/api/server/actions/recent`, {
    headers: { cookie: operatorCookie }
  });
  assert.equal(operatorResponse.status, 200);
  const operatorBody = await operatorResponse.json();
  assert.deepEqual(
    operatorBody.actions.map((entry) => [entry.username, entry.action, entry.status]),
    [
      ['operator', 'restart', 'completed'],
      ['operator', 'rcon_command', 'completed'],
      ['admin', 'start', 'completed']
    ]
  );
});

test('server logs hide RCON output from admin and read-only users', async () => {
  const config = buildConfig({
    PORTAL_AUTH_PROVIDER: 'local',
    PORTAL_ADMIN_USERNAME: 'operator',
    PORTAL_ADMIN_PASSWORD: 'secret',
    PORTAL_DB_PATH: tempDbPath()
  });
  const db = new PortalDatabase(config.dbPath);
  db.createUser('admin', await bcrypt.hash('adminpass', 4), 'admin');
  db.createUser('reader', await bcrypt.hash('readerpass', 4), 'read_only');
  const controller = createStubController();
  controller.getLogs = () => [
    { timestamp: '2026-05-17T00:00:00.000Z', source: 'start:stdout', line: 'server line' },
    { timestamp: '2026-05-17T00:00:01.000Z', source: 'rcon:stdout', line: 'rcon stdout' },
    { timestamp: '2026-05-17T00:00:02.000Z', source: 'stdout:rcon', line: 'legacy rcon source' },
    { timestamp: '2026-05-17T00:00:03.000Z', source: 'rcon:stderr', line: 'rcon stderr' }
  ];
  const { app, bootstrap } = createApp({ config, db, controller });
  await bootstrap();

  const server = app.listen(0);
  test.after(() => {
    server.close();
    db.close();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const adminCookie = await login(baseUrl, 'admin', 'adminpass');
  const readerCookie = await login(baseUrl, 'reader', 'readerpass');
  const operatorCookie = await login(baseUrl, 'operator', 'secret');

  for (const cookie of [adminCookie, readerCookie]) {
    const response = await fetch(`${baseUrl}/api/server/logs`, { headers: { cookie } });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.logs.map((entry) => entry.source), ['start:stdout']);
  }

  const operatorResponse = await fetch(`${baseUrl}/api/server/logs`, { headers: { cookie: operatorCookie } });
  assert.equal(operatorResponse.status, 200);
  const operatorBody = await operatorResponse.json();
  assert.deepEqual(
    operatorBody.logs.map((entry) => entry.source),
    ['start:stdout', 'rcon:stdout', 'stdout:rcon', 'rcon:stderr']
  );
});

test('local auth user can change their password without losing the current session', async () => {
  const config = buildConfig({
    PORTAL_AUTH_PROVIDER: 'local',
    PORTAL_ADMIN_USERNAME: 'admin',
    PORTAL_ADMIN_PASSWORD: 'secret',
    PORTAL_DB_PATH: tempDbPath()
  });
  const db = new PortalDatabase(config.dbPath);
  const { app, bootstrap } = createApp({ config, db, controller: createStubController() });
  await bootstrap();

  const server = app.listen(0);
  test.after(() => {
    server.close();
    db.close();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'secret' })
  });
  const cookie = getCookie(login);

  const wrongCurrent = await fetch(`${baseUrl}/api/auth/password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ currentPassword: 'wrong', newPassword: 'newsecret' })
  });
  assert.equal(wrongCurrent.status, 401);

  const changed = await fetch(`${baseUrl}/api/auth/password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ currentPassword: 'secret', newPassword: 'newsecret' })
  });
  assert.equal(changed.status, 200);

  const currentSessionStatus = await fetch(`${baseUrl}/api/server/status`, {
    headers: { cookie }
  });
  assert.equal(currentSessionStatus.status, 200);

  const oldPassword = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'secret' })
  });
  assert.equal(oldPassword.status, 401);

  const newPassword = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'newsecret' })
  });
  assert.equal(newPassword.status, 200);
});

test('SQLite migration upgrades existing users and keeps local sessions role-aware', async () => {
  const dbPath = tempDbPath();
  const oldDb = new DatabaseSync(dbPath);
  const now = Date.now();
  oldDb.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER,
      provider TEXT NOT NULL,
      subject TEXT,
      username TEXT NOT NULL,
      email TEXT,
      groups_json TEXT NOT NULL DEFAULT '[]',
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE oauth_states (
      state TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      code_verifier TEXT,
      redirect_after TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE action_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  oldDb.prepare('INSERT INTO users (username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
    'bootstrap',
    'hash',
    now,
    now
  );
  oldDb.prepare('INSERT INTO users (username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
    'casey',
    'hash',
    now,
    now
  );
  oldDb.prepare(`
    INSERT INTO sessions (id, user_id, provider, subject, username, email, groups_json, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('legacy-session', 2, 'local', 'local:casey', 'casey', '', '[]', now + 60_000, now);
  oldDb.close();

  const config = buildConfig({
    PORTAL_AUTH_PROVIDER: 'local',
    PORTAL_ADMIN_USERNAME: 'bootstrap',
    PORTAL_DB_PATH: dbPath,
    PORTAL_SESSION_SECRET: 'test-secret'
  });
  const db = new PortalDatabase(dbPath);
  const portal = createApp({ config, db, controller: createStubController() });
  await portal.bootstrap();
  await portal.bootstrap();

  const server = portal.app.listen(0);
  test.after(() => {
    server.close();
    db.close();
  });

  const users = db.listUsers();
  assert.equal(users.length, 2);
  const bootstrap = users.find((user) => user.username === 'bootstrap');
  const casey = users.find((user) => user.username === 'casey');
  assert.equal(bootstrap.role, 'operator');
  assert.equal(bootstrap.protectedOperator, true);
  assert.equal(casey.role, 'admin');
  assert.equal(casey.mustChangePassword, false);
  assert.deepEqual(
    db.db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map((row) => row.version),
    [1]
  );

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = `${config.sessionCookieName}=${portal.auth.encodeSessionCookie('legacy-session')}`;
  const me = await fetch(`${baseUrl}/api/me`, { headers: { cookie } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.role, 'admin');

  db.updateUserRole(casey.id, 'read_only');
  const refreshed = await fetch(`${baseUrl}/api/me`, { headers: { cookie } });
  assert.equal(refreshed.status, 200);
  assert.equal((await refreshed.json()).user.role, 'read_only');
});

test('role gates allow read-only, admin, and operator capabilities', async () => {
  const config = buildConfig({
    PORTAL_AUTH_PROVIDER: 'local',
    PORTAL_ADMIN_USERNAME: 'operator',
    PORTAL_ADMIN_PASSWORD: 'secret',
    PORTAL_DB_PATH: tempDbPath()
  });
  const db = new PortalDatabase(config.dbPath);
  const { app, bootstrap } = createApp({ config, db, controller: createStubController() });
  await bootstrap();
  db.createUser('reader', await bcrypt.hash('readerpass', 4), 'read_only');
  db.createUser('admin', await bcrypt.hash('adminpass', 4), 'admin');

  const server = app.listen(0);
  test.after(() => {
    server.close();
    db.close();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const readerCookie = await login(baseUrl, 'reader', 'readerpass');
  const adminCookie = await login(baseUrl, 'admin', 'adminpass');
  const operatorCookie = await login(baseUrl, 'operator', 'secret');

  for (const pathName of ['/api/server/status', '/api/server/logs', '/api/server/actions/recent']) {
    const response = await fetch(`${baseUrl}${pathName}`, { headers: { cookie: readerCookie } });
    assert.equal(response.status, 200);
  }

  const readerAction = await fetch(`${baseUrl}/api/server/actions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: readerCookie },
    body: JSON.stringify({ action: 'start' })
  });
  assert.equal(readerAction.status, 403);

  const readerRconStatus = await fetch(`${baseUrl}/api/server/rcon-status`, {
    headers: { cookie: readerCookie }
  });
  assert.equal(readerRconStatus.status, 403);

  const adminRconStatus = await fetch(`${baseUrl}/api/server/rcon-status?refresh=true`, {
    headers: { cookie: adminCookie }
  });
  assert.equal(adminRconStatus.status, 200);
  const adminRconStatusBody = await adminRconStatus.json();
  assert.equal(adminRconStatusBody.summary.zombiesTotal, 25);
  assert.deepEqual(adminRconStatusBody.summary.players, ['puderug', 'casey']);

  const adminAction = await fetch(`${baseUrl}/api/server/actions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: JSON.stringify({ action: 'start' })
  });
  assert.equal(adminAction.status, 200);

  const adminUsers = await fetch(`${baseUrl}/api/users`, { headers: { cookie: adminCookie } });
  assert.equal(adminUsers.status, 403);

  const adminRcon = await fetch(`${baseUrl}/api/rcon/commands`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: JSON.stringify({ command: 'servermsg "hello"' })
  });
  assert.equal(adminRcon.status, 403);

  const operatorUsers = await fetch(`${baseUrl}/api/users`, { headers: { cookie: operatorCookie } });
  assert.equal(operatorUsers.status, 200);

  const operatorRconStatus = await fetch(`${baseUrl}/api/server/rcon-status`, {
    headers: { cookie: operatorCookie }
  });
  assert.equal(operatorRconStatus.status, 200);

  const operatorRcon = await fetch(`${baseUrl}/api/rcon/commands`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: operatorCookie },
    body: JSON.stringify({ command: 'servermsg "hello"' })
  });
  assert.equal(operatorRcon.status, 200);
  assert.equal((await operatorRcon.json()).stdout, 'ok\n');
});

test('operator user management creates forced-password users and protects the bootstrap operator', async () => {
  const config = buildConfig({
    PORTAL_AUTH_PROVIDER: 'local',
    PORTAL_ADMIN_USERNAME: 'operator',
    PORTAL_ADMIN_PASSWORD: 'secret',
    PORTAL_DB_PATH: tempDbPath()
  });
  const db = new PortalDatabase(config.dbPath);
  const { app, bootstrap } = createApp({ config, db, controller: createStubController() });
  await bootstrap();

  const server = app.listen(0);
  test.after(() => {
    server.close();
    db.close();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const operatorCookie = await login(baseUrl, 'operator', 'secret');

  const created = await fetch(`${baseUrl}/api/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: operatorCookie },
    body: JSON.stringify({ username: 'newuser', role: 'read_only' })
  });
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  assert.equal(createdBody.user.role, 'read_only');
  assert.equal(createdBody.user.mustChangePassword, true);
  assert.match(createdBody.initialPassword, /^[A-Za-z0-9_-]{20,}$/);

  const newUserCookie = await login(baseUrl, 'newuser', createdBody.initialPassword);
  const mustChange = await fetch(`${baseUrl}/api/me`, { headers: { cookie: newUserCookie } });
  assert.equal(mustChange.status, 200);
  assert.equal((await mustChange.json()).user.mustChangePassword, true);

  const blockedStatus = await fetch(`${baseUrl}/api/server/status`, { headers: { cookie: newUserCookie } });
  assert.equal(blockedStatus.status, 403);
  assert.equal((await blockedStatus.json()).error, 'password_change_required');

  const changed = await fetch(`${baseUrl}/api/auth/password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: newUserCookie },
    body: JSON.stringify({ currentPassword: createdBody.initialPassword, newPassword: 'permanent-secret' })
  });
  assert.equal(changed.status, 200);

  const readyStatus = await fetch(`${baseUrl}/api/server/status`, { headers: { cookie: newUserCookie } });
  assert.equal(readyStatus.status, 200);

  const readOnlyAction = await fetch(`${baseUrl}/api/server/actions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: newUserCookie },
    body: JSON.stringify({ action: 'start' })
  });
  assert.equal(readOnlyAction.status, 403);

  const users = await fetch(`${baseUrl}/api/users`, { headers: { cookie: operatorCookie } });
  const usersBody = await users.json();
  const protectedOperator = usersBody.users.find((user) => user.protectedOperator);
  assert.equal(protectedOperator.username, 'operator');

  const protectedUpdate = await fetch(`${baseUrl}/api/users/${protectedOperator.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: operatorCookie },
    body: JSON.stringify({ role: 'admin' })
  });
  assert.equal(protectedUpdate.status, 409);

  const protectedDelete = await fetch(`${baseUrl}/api/users/${protectedOperator.id}`, {
    method: 'DELETE',
    headers: { cookie: operatorCookie }
  });
  assert.equal(protectedDelete.status, 409);

  const promoted = await fetch(`${baseUrl}/api/users/${createdBody.user.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: operatorCookie },
    body: JSON.stringify({ role: 'admin' })
  });
  assert.equal(promoted.status, 200);
  assert.equal((await promoted.json()).user.role, 'admin');

  const promotedAction = await fetch(`${baseUrl}/api/server/actions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: newUserCookie },
    body: JSON.stringify({ action: 'start' })
  });
  assert.equal(promotedAction.status, 200);

  const deleted = await fetch(`${baseUrl}/api/users/${createdBody.user.id}`, {
    method: 'DELETE',
    headers: { cookie: operatorCookie }
  });
  assert.equal(deleted.status, 200);

  const deletedSession = await fetch(`${baseUrl}/api/me`, { headers: { cookie: newUserCookie } });
  assert.equal(deletedSession.status, 200);
  assert.equal((await deletedSession.json()).authenticated, false);
});

test('external callback validates state and allow rules', async () => {
  const config = buildConfig({
    PORTAL_AUTH_PROVIDER: 'oauth2',
    PORTAL_OAUTH_AUTHORIZE_URL: 'https://idp.example.test/authorize',
    PORTAL_OAUTH_TOKEN_URL: 'https://idp.example.test/token',
    PORTAL_OAUTH_USERINFO_URL: 'https://idp.example.test/userinfo',
    PORTAL_OAUTH_CLIENT_ID: 'client',
    PORTAL_OAUTH_CLIENT_SECRET: 'secret',
    PORTAL_OAUTH_REDIRECT_URI: 'http://127.0.0.1/auth/callback',
    PORTAL_ALLOWED_GROUPS: 'admins',
    PORTAL_DB_PATH: tempDbPath()
  });
  const db = new PortalDatabase(config.dbPath);
  const fetchImpl = async (url) => {
    if (url === 'https://idp.example.test/token') {
      return Response.json({ access_token: 'token' });
    }

    if (url === 'https://idp.example.test/userinfo') {
      return Response.json({
        sub: 'user-1',
        preferred_username: 'casey',
        email: 'casey@example.test',
        groups: ['admins']
      });
    }

    throw new Error(`Unexpected fetch URL ${url}`);
  };
  const { app, bootstrap } = createApp({
    config,
    db,
    controller: createStubController(),
    fetchImpl
  });
  await bootstrap();

  const server = app.listen(0);
  test.after(() => {
    server.close();
    db.close();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const invalid = await fetch(`${baseUrl}/auth/callback?code=abc&state=missing`, {
    redirect: 'manual'
  });
  assert.equal(invalid.status, 400);

  const start = await fetch(`${baseUrl}/auth/login?redirect=%2Fmanage`, { redirect: 'manual' });
  assert.equal(start.status, 302);
  const redirectUrl = new URL(start.headers.get('location'));
  const state = redirectUrl.searchParams.get('state');
  assert.ok(state);

  const callback = await fetch(`${baseUrl}/auth/callback?code=abc&state=${state}`, {
    redirect: 'manual'
  });
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get('location'), '/manage');
  assert.ok(callback.headers.get('set-cookie'));
  const externalCookie = getCookie(callback);

  const me = await fetch(`${baseUrl}/api/me`, {
    headers: { cookie: externalCookie }
  });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.role, 'admin');

  const passwordChange = await fetch(`${baseUrl}/api/auth/password`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: externalCookie
    },
    body: JSON.stringify({ currentPassword: 'secret', newPassword: 'newsecret' })
  });
  assert.equal(passwordChange.status, 403);
});

test('external role mapping uses group precedence after allow-list authorization', async () => {
  const config = buildConfig({
    PORTAL_AUTH_PROVIDER: 'oauth2',
    PORTAL_OAUTH_AUTHORIZE_URL: 'https://idp.example.test/authorize',
    PORTAL_OAUTH_TOKEN_URL: 'https://idp.example.test/token',
    PORTAL_OAUTH_USERINFO_URL: 'https://idp.example.test/userinfo',
    PORTAL_OAUTH_CLIENT_ID: 'client',
    PORTAL_OAUTH_CLIENT_SECRET: 'secret',
    PORTAL_OAUTH_REDIRECT_URI: 'http://127.0.0.1/auth/callback',
    PORTAL_ALLOWED_GROUPS: 'portal-users',
    PORTAL_READ_ONLY_GROUPS: 'viewers',
    PORTAL_ADMIN_GROUPS: 'admins',
    PORTAL_OPERATOR_GROUPS: 'operators',
    PORTAL_DB_PATH: tempDbPath()
  });
  const db = new PortalDatabase(config.dbPath);
  const fetchImpl = async (url) => {
    if (url === 'https://idp.example.test/token') {
      return Response.json({ access_token: 'token' });
    }

    if (url === 'https://idp.example.test/userinfo') {
      return Response.json({
        sub: 'user-2',
        preferred_username: 'riley',
        email: 'riley@example.test',
        groups: ['portal-users', 'viewers', 'admins', 'operators']
      });
    }

    throw new Error(`Unexpected fetch URL ${url}`);
  };
  const { app, bootstrap } = createApp({
    config,
    db,
    controller: createStubController(),
    fetchImpl
  });
  await bootstrap();

  const server = app.listen(0);
  test.after(() => {
    server.close();
    db.close();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const start = await fetch(`${baseUrl}/auth/login`, { redirect: 'manual' });
  const redirectUrl = new URL(start.headers.get('location'));
  const state = redirectUrl.searchParams.get('state');

  const callback = await fetch(`${baseUrl}/auth/callback?code=abc&state=${state}`, {
    redirect: 'manual'
  });
  assert.equal(callback.status, 302);

  const me = await fetch(`${baseUrl}/api/me`, {
    headers: { cookie: getCookie(callback) }
  });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.role, 'operator');
});

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { ROLE_RANK, ROLES, normalizeRole } = require('./roles');

function nowMs() {
  return Date.now();
}

const ACTION_REQUIRED_ROLES = new Map([
  ['start', 'admin'],
  ['stop', 'admin'],
  ['restart', 'admin'],
  ['safe_stop', 'admin'],
  ['safe_restart', 'admin'],
  ['rcon_command', 'operator']
]);

function requiredRoleForAction(action) {
  return ACTION_REQUIRED_ROLES.get(String(action || '')) || 'operator';
}

class PortalDatabase {
  constructor(dbPath) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath, { timeout: 5000 });
    this.migrate();
  }

  migrate() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        protected_operator INTEGER NOT NULL DEFAULT 0,
        must_change_password INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        provider TEXT NOT NULL,
        subject TEXT,
        username TEXT NOT NULL,
        email TEXT,
        groups_json TEXT NOT NULL DEFAULT '[]',
        role TEXT NOT NULL DEFAULT 'admin',
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      ) STRICT;

      CREATE TABLE IF NOT EXISTS oauth_states (
        state TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        code_verifier TEXT,
        redirect_after TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS action_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        action TEXT NOT NULL,
        required_role TEXT NOT NULL DEFAULT 'admin',
        status TEXT NOT NULL,
        message TEXT,
        created_at INTEGER NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS terminal_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_key TEXT NOT NULL,
        username TEXT NOT NULL,
        input TEXT NOT NULL,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        command TEXT,
        stdout TEXT NOT NULL DEFAULT '',
        stderr TEXT NOT NULL DEFAULT '',
        message TEXT NOT NULL DEFAULT '',
        code INTEGER,
        signal TEXT,
        created_at INTEGER NOT NULL
      ) STRICT;

      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_terminal_history_owner_id ON terminal_history(owner_key, id);
    `);

    this.ensureColumn('users', 'role', "TEXT NOT NULL DEFAULT 'admin'");
    this.ensureColumn('users', 'protected_operator', 'INTEGER NOT NULL DEFAULT 0');
    this.ensureColumn('users', 'must_change_password', 'INTEGER NOT NULL DEFAULT 0');
    this.ensureColumn('sessions', 'role', "TEXT NOT NULL DEFAULT 'admin'");
    this.ensureColumn('action_audit', 'required_role', "TEXT NOT NULL DEFAULT 'admin'");
    this.db.prepare(`
      UPDATE action_audit
      SET required_role = 'operator'
      WHERE action = 'rcon_command'
    `).run();
    this.db.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(1, nowMs());
  }

  tableColumns(table) {
    return this.db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
  }

  ensureColumn(table, column, definition) {
    if (!['users', 'sessions', 'action_audit'].includes(table)) {
      throw new Error(`Unsupported migration table ${table}.`);
    }

    if (this.tableColumns(table).includes(column)) {
      return;
    }

    this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }

  close() {
    this.db.close();
  }

  countUsers() {
    return this.db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  }

  getUserByUsername(username) {
    return normalizeUser(this.db.prepare('SELECT * FROM users WHERE username = ?').get(username));
  }

  getUserById(id) {
    return normalizeUser(this.db.prepare('SELECT * FROM users WHERE id = ?').get(id));
  }

  listUsers() {
    return this.db.prepare(`
      SELECT id, username, role, protected_operator, must_change_password, created_at, updated_at
      FROM users
      ORDER BY protected_operator DESC, username COLLATE NOCASE ASC
    `).all().map(normalizeUser);
  }

  createUser(username, passwordHash, role, options = {}) {
    const timestamp = nowMs();
    const result = this.db.prepare(`
      INSERT INTO users (
        username, password_hash, role, protected_operator, must_change_password, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      username,
      passwordHash,
      normalizeRole(role, 'read_only'),
      options.protectedOperator ? 1 : 0,
      options.mustChangePassword ? 1 : 0,
      timestamp,
      timestamp
    );
    return this.getUserById(result.lastInsertRowid);
  }

  upsertUser(username, passwordHash, options = {}) {
    const timestamp = nowMs();
    const role = normalizeRole(options.role, 'admin');
    this.db.prepare(`
      INSERT INTO users (
        username, password_hash, role, protected_operator, must_change_password, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(username) DO UPDATE SET
        password_hash = excluded.password_hash,
        role = excluded.role,
        protected_operator = excluded.protected_operator,
        must_change_password = excluded.must_change_password,
        updated_at = excluded.updated_at
    `).run(
      username,
      passwordHash,
      role,
      options.protectedOperator ? 1 : 0,
      options.mustChangePassword ? 1 : 0,
      timestamp,
      timestamp
    );
    return this.getUserByUsername(username);
  }

  markBootstrapOperator(username) {
    const result = this.db.prepare(`
      UPDATE users
      SET role = 'operator', protected_operator = 1, updated_at = ?
      WHERE username = ?
    `).run(nowMs(), username);
    return result.changes > 0;
  }

  updateUserPassword(userId, passwordHash, options = {}) {
    const result = this.db.prepare(`
      UPDATE users
      SET password_hash = ?, must_change_password = ?, updated_at = ?
      WHERE id = ?
    `).run(passwordHash, options.mustChangePassword ? 1 : 0, nowMs(), userId);
    return result.changes > 0;
  }

  updateUserRole(userId, role) {
    const result = this.db.prepare(`
      UPDATE users
      SET role = ?, updated_at = ?
      WHERE id = ? AND protected_operator = 0
    `).run(normalizeRole(role, 'read_only'), nowMs(), userId);
    return result.changes > 0;
  }

  deleteUser(userId) {
    const user = this.getUserById(userId);
    const result = this.db.prepare('DELETE FROM users WHERE id = ? AND protected_operator = 0').run(userId);
    if (result.changes > 0 && user) {
      this.clearTerminalHistory(`local:${user.id}`);
    }
    return result.changes > 0;
  }

  createSession(session) {
    this.db.prepare(`
      INSERT INTO sessions (
        id, user_id, provider, subject, username, email, groups_json, role, expires_at, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      session.id,
      session.userId || null,
      session.provider,
      session.subject || null,
      session.username,
      session.email || null,
      JSON.stringify(session.groups || []),
      normalizeRole(session.role, 'admin'),
      session.expiresAt,
      nowMs()
    );
  }

  getSession(id) {
    const row = this.db.prepare(`
      SELECT
        sessions.*,
        users.username AS local_username,
        users.role AS local_role,
        users.protected_operator AS local_protected_operator,
        users.must_change_password AS local_must_change_password
      FROM sessions
      LEFT JOIN users ON users.id = sessions.user_id
      WHERE sessions.id = ? AND sessions.expires_at > ?
    `).get(id, nowMs());
    if (!row) {
      return null;
    }

    if (row.provider === 'local' && !row.local_username) {
      this.deleteSession(id);
      return null;
    }

    const local = row.provider === 'local';
    return {
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      subject: row.subject,
      username: local ? row.local_username : row.username,
      email: row.email,
      groups: JSON.parse(row.groups_json || '[]'),
      role: normalizeRole(local ? row.local_role : row.role, 'admin'),
      protectedOperator: local ? Boolean(row.local_protected_operator) : false,
      mustChangePassword: local ? Boolean(row.local_must_change_password) : false,
      expiresAt: row.expires_at,
      createdAt: row.created_at
    };
  }

  deleteSession(id) {
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  deleteExpiredSessions() {
    this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowMs());
    this.db.prepare('DELETE FROM oauth_states WHERE expires_at <= ?').run(nowMs());
  }

  createOAuthState(state) {
    this.db.prepare(`
      INSERT INTO oauth_states (
        state, provider, code_verifier, redirect_after, expires_at, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      state.state,
      state.provider,
      state.codeVerifier || null,
      state.redirectAfter || '/',
      state.expiresAt,
      nowMs()
    );
  }

  consumeOAuthState(state) {
    const row = this.db.prepare('SELECT * FROM oauth_states WHERE state = ? AND expires_at > ?').get(state, nowMs());
    this.db.prepare('DELETE FROM oauth_states WHERE state = ?').run(state);

    if (!row) {
      return null;
    }

    return {
      state: row.state,
      provider: row.provider,
      codeVerifier: row.code_verifier,
      redirectAfter: row.redirect_after,
      expiresAt: row.expires_at
    };
  }

  recordAction(username, action, status, message = '', requiredRole = requiredRoleForAction(action)) {
    const normalizedRequiredRole = normalizeRole(requiredRole, requiredRoleForAction(action));
    this.db.prepare(`
      INSERT INTO action_audit (username, action, required_role, status, message, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(username, action, normalizedRequiredRole, status, message, nowMs());
  }

  listRecentActions(limit = 20, viewerRole = 'operator') {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.trunc(limit), 100) : 20;
    const normalizedViewerRole = normalizeRole(viewerRole, 'read_only');
    const visibleRoles = ROLES.filter((role) => ROLE_RANK[role] <= ROLE_RANK[normalizedViewerRole]);
    if (visibleRoles.length === 0) {
      return [];
    }

    const placeholders = visibleRoles.map(() => '?').join(', ');
    return this.db.prepare(`
      SELECT id, username, action, required_role, status, message, created_at
      FROM action_audit
      WHERE required_role IN (${placeholders})
      ORDER BY id DESC
      LIMIT ?
    `).all(...visibleRoles, safeLimit).map((row) => ({
      id: row.id,
      username: row.username,
      action: row.action,
      requiredRole: normalizeRole(row.required_role, 'admin'),
      status: row.status,
      message: row.message || '',
      createdAt: row.created_at
    }));
  }

  listTerminalHistory(ownerKey, limit = 100) {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.trunc(limit), 100) : 100;
    return this.db.prepare(`
      SELECT *
      FROM (
        SELECT id, owner_key, username, input, kind, status, command, stdout, stderr, message, code, signal, created_at
        FROM terminal_history
        WHERE owner_key = ?
        ORDER BY id DESC
        LIMIT ?
      )
      ORDER BY id ASC
    `).all(ownerKey, safeLimit).map(normalizeTerminalEntry);
  }

  recordTerminalEntry(ownerKey, username, entry, limit = 100) {
    const timestamp = nowMs();
    const result = this.db.prepare(`
      INSERT INTO terminal_history (
        owner_key, username, input, kind, status, command, stdout, stderr, message, code, signal, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ownerKey,
      username,
      String(entry.input || ''),
      String(entry.kind || 'unknown'),
      String(entry.status || 'completed'),
      entry.command ? String(entry.command) : null,
      String(entry.stdout || ''),
      String(entry.stderr || ''),
      String(entry.message || ''),
      Number.isInteger(entry.code) ? entry.code : null,
      entry.signal ? String(entry.signal) : null,
      timestamp
    );

    this.pruneTerminalHistory(ownerKey, limit);
    return normalizeTerminalEntry({
      id: result.lastInsertRowid,
      owner_key: ownerKey,
      username,
      input: String(entry.input || ''),
      kind: String(entry.kind || 'unknown'),
      status: String(entry.status || 'completed'),
      command: entry.command ? String(entry.command) : null,
      stdout: String(entry.stdout || ''),
      stderr: String(entry.stderr || ''),
      message: String(entry.message || ''),
      code: Number.isInteger(entry.code) ? entry.code : null,
      signal: entry.signal ? String(entry.signal) : null,
      created_at: timestamp
    });
  }

  pruneTerminalHistory(ownerKey, limit = 100) {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.trunc(limit), 100) : 100;
    this.db.prepare(`
      DELETE FROM terminal_history
      WHERE owner_key = ?
        AND id NOT IN (
          SELECT id
          FROM terminal_history
          WHERE owner_key = ?
          ORDER BY id DESC
          LIMIT ?
        )
    `).run(ownerKey, ownerKey, safeLimit);
  }

  clearTerminalHistory(ownerKey) {
    this.db.prepare('DELETE FROM terminal_history WHERE owner_key = ?').run(ownerKey);
  }
}

function normalizeUser(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    role: normalizeRole(row.role, 'admin'),
    protectedOperator: Boolean(row.protected_operator),
    mustChangePassword: Boolean(row.must_change_password),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeTerminalEntry(row) {
  return {
    id: row.id,
    ownerKey: row.owner_key,
    username: row.username,
    input: row.input,
    kind: row.kind,
    status: row.status,
    command: row.command || '',
    stdout: row.stdout || '',
    stderr: row.stderr || '',
    message: row.message || '',
    code: Number.isInteger(row.code) ? row.code : null,
    signal: row.signal || null,
    createdAt: row.created_at
  };
}

module.exports = {
  PortalDatabase
};

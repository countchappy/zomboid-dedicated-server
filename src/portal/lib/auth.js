'use strict';

const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { parseCookies, serializeCookie } = require('./cookies');
const { firstMatchingRole, normalizeRole, roleAtLeast } = require('./roles');

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function generateInitialPassword() {
  return randomToken(18);
}

function base64Url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest();
}

function timingSafeEqualString(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getClaim(claims, path) {
  if (!path) {
    return undefined;
  }

  return path.split('.').reduce((current, segment) => {
    if (current && Object.prototype.hasOwnProperty.call(current, segment)) {
      return current[segment];
    }

    return undefined;
  }, claims);
}

function normalizeGroups(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function isAllowedExternalUser(config, claims) {
  const external = config.auth.external;
  const username = String(getClaim(claims, external.usernameClaim) || claims.sub || '');
  const email = String(getClaim(claims, external.emailClaim) || '').toLowerCase();
  const groups = normalizeGroups(getClaim(claims, external.groupsClaim));
  const allowed = external.allowed;

  const userAllowed = username && allowed.users.includes(username);
  const emailAllowed = email && allowed.emails.includes(email);
  const groupAllowed = groups.some((group) => allowed.groups.includes(group));
  const role = firstMatchingRole(groups, external.roleGroups || {}, 'admin');

  return {
    allowed: Boolean(userAllowed || emailAllowed || groupAllowed),
    username,
    email,
    groups,
    role
  };
}

function userDto(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    protectedOperator: Boolean(user.protectedOperator),
    mustChangePassword: Boolean(user.mustChangePassword),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function validateUsername(username) {
  if (username.length < 3 || username.length > 64) {
    return 'Username must be between 3 and 64 characters.';
  }

  if (/[\x00-\x1F\x7F]/.test(username)) {
    return 'Username cannot contain control characters.';
  }

  return '';
}

class AuthService {
  constructor({ config, db, fetchImpl = globalThis.fetch }) {
    this.config = config;
    this.db = db;
    this.fetch = fetchImpl;
    this.discovery = null;
  }

  async bootstrap() {
    this.db.deleteExpiredSessions();

    if (this.config.auth.provider !== 'local') {
      return;
    }

    const existingUsers = this.db.countUsers();
    const { adminUsername, adminPassword } = this.config.auth.local;

    if (!adminPassword && existingUsers === 0) {
      throw new Error('PORTAL_ADMIN_PASSWORD is required when bootstrapping the first local portal user.');
    }

    if (adminPassword) {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      this.db.upsertUser(adminUsername, passwordHash, {
        role: 'operator',
        protectedOperator: true,
        mustChangePassword: false
      });
    } else {
      this.db.markBootstrapOperator(adminUsername);
    }
  }

  sessionCookieOptions(maxAgeSeconds) {
    return {
      maxAge: maxAgeSeconds,
      httpOnly: true,
      secure: this.config.secureCookies,
      sameSite: 'Lax',
      path: '/'
    };
  }

  getSessionFromRequest(req) {
    const cookies = parseCookies(req.headers.cookie || '');
    const sessionId = this.decodeSessionCookie(cookies[this.config.sessionCookieName]);
    if (!sessionId) {
      return null;
    }

    return this.db.getSession(sessionId);
  }

  attachSession(req, _res, next) {
    req.user = this.getSessionFromRequest(req);
    next();
  }

  requireAuth(req, res, next) {
    if (!req.user) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    next();
  }

  requirePasswordReady(req, res, next) {
    if (req.user?.mustChangePassword) {
      res.status(403).json({
        error: 'password_change_required',
        message: 'Change your password before continuing.'
      });
      return;
    }

    next();
  }

  requireRole(minimumRole) {
    return (req, res, next) => {
      if (!req.user) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }

      if (req.user.mustChangePassword) {
        res.status(403).json({
          error: 'password_change_required',
          message: 'Change your password before continuing.'
        });
        return;
      }

      if (!roleAtLeast(req.user.role, minimumRole)) {
        res.status(403).json({
          error: 'forbidden',
          message: 'Your account does not have permission to perform this action.'
        });
        return;
      }

      next();
    };
  }

  createSession(res, session) {
    const sessionId = randomToken();
    const expiresAt = Date.now() + this.config.sessionTtlMs;
    this.db.createSession({
      ...session,
      id: sessionId,
      expiresAt
    });

    res.setHeader(
      'Set-Cookie',
      serializeCookie(
        this.config.sessionCookieName,
        this.encodeSessionCookie(sessionId),
        this.sessionCookieOptions(Math.floor(this.config.sessionTtlMs / 1000))
      )
    );
  }

  logout(req, res) {
    const cookies = parseCookies(req.headers.cookie || '');
    const sessionId = this.decodeSessionCookie(cookies[this.config.sessionCookieName]);
    if (sessionId) {
      this.db.deleteSession(sessionId);
    }

    res.setHeader(
      'Set-Cookie',
      serializeCookie(this.config.sessionCookieName, '', {
        maxAge: 0,
        expires: new Date(0),
        httpOnly: true,
        secure: this.config.secureCookies,
        sameSite: 'Lax',
        path: '/'
      })
    );
  }

  sign(value) {
    return crypto.createHmac('sha256', this.config.sessionSecret).update(value).digest('base64url');
  }

  encodeSessionCookie(sessionId) {
    return `${sessionId}.${this.sign(sessionId)}`;
  }

  decodeSessionCookie(value) {
    if (!value) {
      return null;
    }

    const index = value.lastIndexOf('.');
    if (index === -1) {
      return null;
    }

    const sessionId = value.slice(0, index);
    const signature = value.slice(index + 1);
    if (!sessionId || !signature || !timingSafeEqualString(signature, this.sign(sessionId))) {
      return null;
    }

    return sessionId;
  }

  async loginLocal(req, res) {
    if (this.config.auth.provider !== 'local') {
      res.status(400).json({ error: 'external_auth_required', loginUrl: '/auth/login' });
      return;
    }

    const username = String(req.body?.username || '');
    const password = String(req.body?.password || '');
    const user = this.db.getUserByUsername(username);

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }

    this.createSession(res, {
      userId: user.id,
      provider: 'local',
      subject: `local:${user.username}`,
      username: user.username,
      email: '',
      groups: [`local-${user.role}`],
      role: user.role
    });

    res.json({ ok: true });
  }

  async changeLocalPassword(req, res) {
    if (this.config.auth.provider !== 'local' || req.user?.provider !== 'local' || !req.user.userId) {
      res.status(403).json({ error: 'local_auth_required' });
      return;
    }

    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'password_required' });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ error: 'password_too_short', message: 'New password must be at least 8 characters.' });
      return;
    }

    const user = this.db.getUserById(req.user.userId);
    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      res.status(401).json({ error: 'invalid_current_password' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    if (!this.db.updateUserPassword(user.id, passwordHash)) {
      res.status(404).json({ error: 'user_not_found' });
      return;
    }

    res.json({ ok: true });
  }

  requireLocalUserManagement(res) {
    if (this.config.auth.provider !== 'local') {
      res.status(400).json({
        error: 'local_user_management_unavailable',
        message: 'Local user management is only available when local auth is active.'
      });
      return false;
    }

    return true;
  }

  listLocalUsers(req, res) {
    if (!this.requireLocalUserManagement(res)) {
      return;
    }

    res.json({ users: this.db.listUsers().map(userDto) });
  }

  async createLocalUser(req, res, next) {
    try {
      if (!this.requireLocalUserManagement(res)) {
        return;
      }

      const username = String(req.body?.username || '').trim();
      const role = normalizeRole(req.body?.role, '');
      const usernameError = validateUsername(username);
      if (usernameError) {
        res.status(400).json({ error: 'invalid_username', message: usernameError });
        return;
      }

      if (!role) {
        res.status(400).json({ error: 'invalid_role', message: 'Role must be read_only, admin, or operator.' });
        return;
      }

      const password = generateInitialPassword();
      const passwordHash = await bcrypt.hash(password, 12);
      const user = this.db.createUser(username, passwordHash, role, { mustChangePassword: true });
      res.status(201).json({ user: userDto(user), initialPassword: password });
    } catch (error) {
      if (/UNIQUE constraint failed: users\.username/.test(error.message)) {
        res.status(409).json({ error: 'username_taken', message: 'A user with that username already exists.' });
        return;
      }

      next(error);
    }
  }

  updateLocalUser(req, res) {
    if (!this.requireLocalUserManagement(res)) {
      return;
    }

    const userId = Number.parseInt(req.params.id, 10);
    const role = normalizeRole(req.body?.role, '');
    if (!Number.isFinite(userId) || userId <= 0) {
      res.status(400).json({ error: 'invalid_user_id' });
      return;
    }

    if (!role) {
      res.status(400).json({ error: 'invalid_role', message: 'Role must be read_only, admin, or operator.' });
      return;
    }

    const user = this.db.getUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'user_not_found' });
      return;
    }

    if (user.protectedOperator) {
      res.status(409).json({
        error: 'protected_operator',
        message: 'The bootstrap operator cannot be modified.'
      });
      return;
    }

    this.db.updateUserRole(userId, role);
    res.json({ user: userDto(this.db.getUserById(userId)) });
  }

  deleteLocalUser(req, res) {
    if (!this.requireLocalUserManagement(res)) {
      return;
    }

    const userId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(userId) || userId <= 0) {
      res.status(400).json({ error: 'invalid_user_id' });
      return;
    }

    const user = this.db.getUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'user_not_found' });
      return;
    }

    if (user.protectedOperator) {
      res.status(409).json({
        error: 'protected_operator',
        message: 'The bootstrap operator cannot be deleted.'
      });
      return;
    }

    this.db.deleteUser(userId);
    res.json({ ok: true });
  }

  async discoverOidc() {
    if (this.discovery) {
      return this.discovery;
    }

    const issuerUrl = this.config.auth.external.oidc.issuerUrl.replace(/\/+$/, '');
    const response = await this.fetch(`${issuerUrl}/.well-known/openid-configuration`, {
      headers: { accept: 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`OIDC discovery failed with status ${response.status}.`);
    }

    const discovery = await response.json();
    for (const key of ['authorization_endpoint', 'token_endpoint', 'userinfo_endpoint']) {
      if (!discovery[key]) {
        throw new Error(`OIDC discovery document is missing ${key}.`);
      }
    }

    this.discovery = {
      authorizeUrl: discovery.authorization_endpoint,
      tokenUrl: discovery.token_endpoint,
      userinfoUrl: discovery.userinfo_endpoint
    };

    return this.discovery;
  }

  async externalProviderConfig() {
    if (this.config.auth.provider === 'oidc') {
      return {
        ...(await this.discoverOidc()),
        ...this.config.auth.external.oidc,
        provider: 'oidc'
      };
    }

    if (this.config.auth.provider === 'oauth2') {
      return {
        ...this.config.auth.external.oauth2,
        provider: 'oauth2'
      };
    }

    return null;
  }

  async startExternalLogin(req, res) {
    const provider = await this.externalProviderConfig();
    if (!provider) {
      res.redirect('/');
      return;
    }

    const state = randomToken();
    const codeVerifier = provider.usePkce ? randomToken(48) : '';
    const redirectAfter = typeof req.query.redirect === 'string' ? req.query.redirect : '/';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: provider.clientId,
      redirect_uri: provider.redirectUri,
      scope: provider.scope,
      state
    });

    if (provider.usePkce) {
      params.set('code_challenge_method', 'S256');
      params.set('code_challenge', base64Url(sha256(codeVerifier)));
    }

    this.db.createOAuthState({
      state,
      provider: provider.provider,
      codeVerifier,
      redirectAfter,
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    res.redirect(`${provider.authorizeUrl}?${params.toString()}`);
  }

  async exchangeCode(provider, code, stateRow) {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: provider.redirectUri
    });

    const headers = {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded'
    };

    if (provider.clientAuth === 'basic') {
      const credentials = Buffer.from(`${provider.clientId}:${provider.clientSecret}`).toString('base64');
      headers.authorization = `Basic ${credentials}`;
    } else {
      body.set('client_id', provider.clientId);
      body.set('client_secret', provider.clientSecret);
    }

    if (provider.usePkce && stateRow.codeVerifier) {
      body.set('code_verifier', stateRow.codeVerifier);
    }

    const response = await this.fetch(provider.tokenUrl, {
      method: 'POST',
      headers,
      body
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed with status ${response.status}.`);
    }

    return response.json();
  }

  async fetchUserInfo(provider, accessToken) {
    const response = await this.fetch(provider.userinfoUrl, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Userinfo request failed with status ${response.status}.`);
    }

    return response.json();
  }

  async handleExternalCallback(req, res, next) {
    try {
      if (req.query.error) {
        res.status(401).send(`External login failed: ${req.query.error}`);
        return;
      }

      const code = String(req.query.code || '');
      const state = String(req.query.state || '');
      const stateRow = state ? this.db.consumeOAuthState(state) : null;
      if (!code || !stateRow) {
        res.status(400).send('Invalid or expired external login state.');
        return;
      }

      const provider = await this.externalProviderConfig();
      if (!provider || provider.provider !== stateRow.provider) {
        res.status(400).send('External login provider mismatch.');
        return;
      }

      const token = await this.exchangeCode(provider, code, stateRow);
      if (!token.access_token) {
        res.status(401).send('External login did not return an access token.');
        return;
      }

      const claims = await this.fetchUserInfo(provider, token.access_token);
      const authorization = isAllowedExternalUser(this.config, claims);

      if (!authorization.allowed) {
        res.status(403).send('External IdP user is not allowed to access this portal.');
        return;
      }

      this.createSession(res, {
        provider: provider.provider,
        subject: claims.sub || authorization.username,
        username: authorization.username,
        email: authorization.email,
        groups: authorization.groups,
        role: authorization.role
      });

      res.redirect(stateRow.redirectAfter || '/');
    } catch (error) {
      next(error);
    }
  }

  publicAuthConfig() {
    return {
      provider: this.config.auth.provider,
      local: this.config.auth.provider === 'local',
      externalLoginUrl: this.config.auth.provider === 'local' ? null : '/auth/login'
    };
  }
}

module.exports = {
  AuthService,
  generateInitialPassword,
  getClaim,
  isAllowedExternalUser,
  normalizeGroups
};

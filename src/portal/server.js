'use strict';

const http = require('node:http');
const path = require('node:path');
const express = require('express');
const { AuthService } = require('./lib/auth');
const { buildConfig } = require('./lib/config');
const { PortalDatabase } = require('./lib/database');
const { attachPzLiveWebSocket } = require('./lib/live-logs');
const { filterLogEntriesForRole } = require('./lib/log-visibility');
const { buildPublicStatus } = require('./lib/public-status');
const { BusyError, ServerController } = require('./lib/server-control');
const {
  HISTORY_LIMIT,
  publicTerminalEntry,
  runTerminalCommand,
  terminalOwnerKey
} = require('./lib/terminal');

function createApp({ config, db, controller, fetchImpl } = {}) {
  const resolvedConfig = config || buildConfig();
  const resolvedDb = db || new PortalDatabase(resolvedConfig.dbPath);
  const resolvedController = controller || new ServerController(resolvedConfig);
  const auth = new AuthService({
    config: resolvedConfig,
    db: resolvedDb,
    fetchImpl
  });
  const indexPage = path.join(resolvedConfig.publicDir, 'index.html');
  const managePage = path.join(resolvedConfig.publicDir, 'manage.html');

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use(auth.attachSession.bind(auth));
  app.use('/vendor/bootstrap', express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist')));

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/auth/config', (_req, res) => {
    res.json(auth.publicAuthConfig());
  });

  app.get('/api/me', (req, res) => {
    if (!req.user) {
      res.json({
        authenticated: false,
        auth: auth.publicAuthConfig()
      });
      return;
    }

    res.json({
      authenticated: true,
      user: {
        username: req.user.username,
        email: req.user.email,
        groups: req.user.groups,
        provider: req.user.provider,
        role: req.user.role,
        protectedOperator: req.user.protectedOperator,
        mustChangePassword: req.user.mustChangePassword
      },
      auth: auth.publicAuthConfig()
    });
  });

  app.post('/api/auth/login', auth.loginLocal.bind(auth));

  app.post(
    '/api/auth/password',
    auth.requireAuth.bind(auth),
    auth.changeLocalPassword.bind(auth)
  );

  app.get(
    '/api/users',
    auth.requireRole('operator'),
    auth.listLocalUsers.bind(auth)
  );

  app.post(
    '/api/users',
    auth.requireRole('operator'),
    auth.createLocalUser.bind(auth)
  );

  app.patch(
    '/api/users/:id',
    auth.requireRole('operator'),
    auth.updateLocalUser.bind(auth)
  );

  app.delete(
    '/api/users/:id',
    auth.requireRole('operator'),
    auth.deleteLocalUser.bind(auth)
  );

  app.post('/api/auth/logout', (req, res) => {
    auth.logout(req, res);
    res.json({ ok: true });
  });

  app.get('/auth/login', auth.startExternalLogin.bind(auth));
  app.get('/auth/callback', auth.handleExternalCallback.bind(auth));

  app.get('/api/public/status', async (_req, res) => {
    try {
      let rconStatus = null;
      if (typeof resolvedController.getRconStatus === 'function') {
        try {
          rconStatus = await resolvedController.getRconStatus();
        } catch (_error) {
          rconStatus = null;
        }
      }

      res.json(buildPublicStatus({
        config: resolvedConfig,
        status: resolvedController.getStatus(),
        rconStatus
      }));
    } catch (_error) {
      res.status(500).json({
        error: 'public_status_unavailable',
        message: 'Public status is temporarily unavailable.'
      });
    }
  });

  app.get('/api/server/status', auth.requireAuth.bind(auth), auth.requirePasswordReady.bind(auth), (_req, res) => {
    res.json(resolvedController.getStatus());
  });

  app.get('/api/server/rcon-status', auth.requireRole('admin'), async (req, res, next) => {
    try {
      const refresh = req.query.refresh === 'true';
      res.json(await resolvedController.getRconStatus({ refresh }));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/server/logs', auth.requireAuth.bind(auth), auth.requirePasswordReady.bind(auth), (req, res) => {
    const limit = Number.parseInt(req.query.limit || '200', 10);
    res.json({ logs: filterLogEntriesForRole(resolvedController.getLogs(limit), req.user.role) });
  });

  app.get('/api/server/actions/recent', auth.requireAuth.bind(auth), auth.requirePasswordReady.bind(auth), (req, res) => {
    const limit = Number.parseInt(req.query.limit || '20', 10);
    res.json({ actions: resolvedDb.listRecentActions(limit, req.user.role) });
  });

  app.get('/api/terminal/history', auth.requireRole('operator'), (req, res) => {
    const limit = Number.parseInt(req.query.limit || String(HISTORY_LIMIT), 10);
    const ownerKey = terminalOwnerKey(req.user);
    res.json({
      entries: resolvedDb.listTerminalHistory(ownerKey, limit).map(publicTerminalEntry)
    });
  });

  app.post('/api/terminal/commands', auth.requireRole('operator'), async (req, res, next) => {
    try {
      res.json(await runTerminalCommand({
        input: req.body?.command,
        user: req.user,
        controller: resolvedController,
        db: resolvedDb
      }));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/server/actions', auth.requireRole('admin'), async (req, res, next) => {
    const action = String(req.body?.action || '');
    const checkUpdates = req.body?.checkUpdates === true && ['start', 'restart', 'safe_restart'].includes(action);
    const actionOptions = { checkUpdates };
    if (['safe_stop', 'safe_restart'].includes(action) && req.body?.countdownSeconds !== undefined) {
      actionOptions.countdownSeconds = req.body.countdownSeconds;
    }

    try {
      resolvedDb.recordAction(req.user.username, action, 'started', '', 'admin');
      const status = await resolvedController.runAction(action, req.user, actionOptions);
      resolvedDb.recordAction(req.user.username, action, 'completed', '', 'admin');
      res.json(status);
    } catch (error) {
      resolvedDb.recordAction(req.user.username, action || 'unknown', 'failed', error.message, 'admin');
      next(error);
    }
  });

  app.post('/api/rcon/commands', auth.requireRole('operator'), async (req, res, next) => {
    const commandLine = String(req.body?.command || '').trim();
    const commandName = commandLine.replace(/^\//, '').split(/\s+/)[0] || 'unknown';
    if (!commandLine) {
      res.status(400).json({ error: 'command_required', message: 'Enter an RCON command.' });
      return;
    }

    try {
      resolvedDb.recordAction(req.user.username, 'rcon_command', 'started', `command: ${commandName}`, 'operator');
      const result = await resolvedController.runRconCommandLine(commandLine);
      resolvedDb.recordAction(req.user.username, 'rcon_command', 'completed', `command: ${commandName}`, 'operator');
      res.json(result);
    } catch (error) {
      resolvedDb.recordAction(req.user.username, 'rcon_command', 'failed', `command: ${commandName}`, 'operator');
      if (error.result) {
        res.status(502).json({
          error: 'rcon_command_failed',
          message: error.message,
          ...error.result
        });
        return;
      }
      next(error);
    }
  });

  app.get('/', (_req, res) => {
    res.sendFile(indexPage);
  });

  app.get('/manage', (req, res) => {
    if (!req.user) {
      res.redirect('/');
      return;
    }

    res.sendFile(managePage);
  });

  app.get('/manage/', (_req, res) => {
    res.redirect('/manage');
  });

  app.use(express.static(resolvedConfig.publicDir));
  app.get('*', (_req, res) => {
    res.sendFile(indexPage);
  });

  app.use((error, _req, res, _next) => {
    if (error instanceof BusyError) {
      res.status(409).json({
        error: 'busy',
        message: error.message,
        activeAction: error.activeAction
      });
      return;
    }

    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      error: statusCode >= 500 ? 'internal_error' : 'request_error',
      message: error.message
    });
  });

  async function bootstrap() {
    await auth.bootstrap();
  }

  return {
    app,
    auth,
    bootstrap,
    config: resolvedConfig,
    controller: resolvedController,
    db: resolvedDb
  };
}

async function main() {
  const config = buildConfig();
  const db = new PortalDatabase(config.dbPath);
  const controller = new ServerController(config);
  const { app, auth, bootstrap } = createApp({ config, db, controller });

  await bootstrap();

  const server = http.createServer(app);
  const pzLive = attachPzLiveWebSocket(server, { auth, controller });
  server.listen(config.port, config.host, () => {
    console.log(`### Portal listening on http://${config.host}:${config.port}`);
  });

  controller.boot().catch((error) => {
    console.error(`### Portal startup failed: ${error.message}`);
  });

  const shutdown = async () => {
    console.log('\n### Portal shutting down...');
    pzLive.close();
    server.close();
    await controller.shutdown();
    db.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  attachPzLiveWebSocket,
  attachLiveLogWebSocket: attachPzLiveWebSocket,
  createApp
};

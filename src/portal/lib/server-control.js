'use strict';

const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { RconStatusCache } = require('./rcon-status');

const DEFAULT_SAFE_COUNTDOWN_SECONDS = 300;
const MIN_SAFE_COUNTDOWN_SECONDS = 60;
const MAX_SAFE_COUNTDOWN_SECONDS = 900;

class BusyError extends Error {
  constructor(activeAction) {
    super(`Server action [${activeAction.action}] is already running.`);
    this.name = 'BusyError';
    this.statusCode = 409;
    this.activeAction = activeAction;
  }
}

class ActionError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'ActionError';
    this.statusCode = statusCode;
  }
}

function timestamp() {
  return new Date().toISOString();
}

function statusFromClose(code, signal) {
  if (code === 0 || signal === 'SIGTERM' || signal === 'SIGINT') {
    return 'stopped';
  }

  return 'errored';
}

function titleForAction(action) {
  return {
    start: 'Startup',
    stop: 'Shutdown',
    restart: 'Restart',
    safe_stop: 'Safe Shutdown',
    safe_restart: 'Safe Restart'
  }[action] || 'Server Status';
}

function kindForAction(action) {
  return {
    start: 'startup',
    stop: 'shutdown',
    restart: 'restart',
    safe_stop: 'safe_shutdown',
    safe_restart: 'safe_restart'
  }[action] || 'status';
}

function isActionKind(kind) {
  return ['startup', 'shutdown', 'restart', 'safe_shutdown', 'safe_restart'].includes(kind);
}

function failedStepForAction(action) {
  return {
    start: 'startServer',
    stop: 'stopServer',
    restart: 'stopServer',
    safe_stop: 'alertPlayers',
    safe_restart: 'alertPlayers'
  }[action] || '';
}

function actionSupportsUpdateCheck(action) {
  return ['start', 'restart', 'safe_restart'].includes(action);
}

function formatSeconds(seconds) {
  if (seconds >= 60 && seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  return `${seconds} second${seconds === 1 ? '' : 's'}`;
}

function validateSafeCountdownSeconds(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed !== Number(value)) {
    throw new ActionError('Safe countdown must be a whole number of seconds.');
  }
  if (parsed < MIN_SAFE_COUNTDOWN_SECONDS || parsed > MAX_SAFE_COUNTDOWN_SECONDS) {
    throw new ActionError(
      `Safe countdown must be between ${MIN_SAFE_COUNTDOWN_SECONDS} and ${MAX_SAFE_COUNTDOWN_SECONDS} seconds.`
    );
  }
  return parsed;
}

function countdownSecondsFromOption(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return validateSafeCountdownSeconds(value);
}

function rconQuoted(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function serverMessageCommand(message) {
  return `servermsg "${rconQuoted(message)}"`;
}

function normalizeRconCommandLine(input) {
  const text = String(input || '').trim();
  if (text.startsWith('/')) {
    return text.slice(1).trimStart();
  }
  return text;
}

function rconArgument(value) {
  const text = String(value ?? '');
  if (text === '' || /[\s"'\\]/.test(text)) {
    return `"${rconQuoted(text)}"`;
  }
  return text;
}

function rconCommandLine(command, args = []) {
  const text = normalizeRconCommandLine(command);
  if (!text) {
    throw new ActionError('RCON command is required.');
  }
  if (!args || args.length === 0) {
    return text;
  }
  return [text, ...args.map(rconArgument)].join(' ');
}

function rconCliArgs({ address, password, command, args = [] }) {
  return [
    '--address',
    address,
    '--password',
    password,
    rconCommandLine(command, args)
  ];
}

function parseRconCommandLine(input) {
  const text = normalizeRconCommandLine(input);
  const args = [];
  let current = '';
  let quote = '';

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quote) {
      if (char === quote) {
        quote = '';
      } else if (char === '\\' && index + 1 < text.length) {
        index += 1;
        current += text[index];
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        args.push(current);
        current = '';
      }
      continue;
    }

    if (char === '\\' && index + 1 < text.length) {
      index += 1;
      current += text[index];
      continue;
    }

    current += char;
  }

  if (quote) {
    throw new ActionError('RCON command has an unterminated quote.');
  }

  if (current) {
    args.push(current);
  }

  if (args.length === 0) {
    throw new ActionError('RCON command is required.');
  }

  return {
    command: args[0],
    args: args.slice(1),
    commandLine: text
  };
}

class ServerController {
  constructor(options) {
    this.scriptPath = options.scriptPath;
    this.scriptShell = options.scriptShell || '/bin/bash';
    this.autoStart = options.autoStart;
    this.logLimit = options.logLines;
    this.env = options.env || process.env;
    this.rcon = options.rcon || { enabled: false };
    this.rconRunner = options.rconRunner || this.runRconCommand.bind(this);
    this.rconStatus = options.rconStatus || new RconStatusCache({
      enabled: () => this.rcon.enabled,
      runCommand: (command) => this.runRconCommand(command, [], { suppressLogs: true })
    });
    this.sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.safeCountdownSeconds = options.safeCountdownSeconds || DEFAULT_SAFE_COUNTDOWN_SECONDS;
    this.prepareState = 'idle';
    this.prepareError = '';
    this.serverState = 'stopped';
    this.ready = false;
    this.lastExitCode = null;
    this.lastExitSignal = null;
    this.lastExitAt = null;
    this.activeAction = null;
    this.serverProcess = null;
    this.serverClosePromise = null;
    this.logs = [];
    this.logSubscribers = new Set();
    this.eventSubscribers = new Set();
    this.flow = this.createFlow('Server Status', 'status', 'idle', 'Server is stopped.');
  }

  createFlow(title, kind, phase, detail, extra = {}) {
    return {
      title,
      kind,
      phase,
      detail,
      startedAt: extra.startedAt || timestamp(),
      countdownRemainingSeconds: extra.countdownRemainingSeconds ?? null,
      countdownTotalSeconds: extra.countdownTotalSeconds ?? null,
      checkUpdates: Boolean(extra.checkUpdates),
      failedStep: extra.failedStep || ''
    };
  }

  setFlow(title, kind, phase, detail, extra = {}) {
    const sameKind = this.flow?.kind === kind;
    this.flow = this.createFlow(title, kind, phase, detail, {
      startedAt: sameKind ? this.flow.startedAt : undefined,
      checkUpdates: extra.checkUpdates ?? (sameKind ? this.flow.checkUpdates : false),
      failedStep: extra.failedStep ?? (sameKind ? this.flow.failedStep : ''),
      ...extra
    });
    this.emitStatus();
  }

  completeCurrentActionFlow(detail) {
    if (!isActionKind(this.flow?.kind)) {
      return false;
    }

    this.setFlow(this.flow.title, this.flow.kind, 'complete', detail, {
      checkUpdates: this.flow.checkUpdates,
      failedStep: ''
    });
    return true;
  }

  setServerState(state, options = {}) {
    this.serverState = state;
    if (Object.prototype.hasOwnProperty.call(options, 'ready')) {
      this.ready = options.ready;
    }
    this.emitStatus();
  }

  emitEvent(type, payload) {
    const event = { type, ...payload };
    for (const subscriber of this.eventSubscribers) {
      try {
        subscriber(event);
      } catch (_error) {
        this.eventSubscribers.delete(subscriber);
      }
    }
  }

  emitStatus() {
    this.emitEvent('status', { status: this.getStatus() });
  }

  emitToast(title, message, variant = 'primary', options = {}) {
    this.emitEvent('toast', {
      toast: {
        title,
        message,
        variant,
        timestamp: timestamp(),
        ...(options.id ? { id: options.id } : {}),
        ...(options.delayMs ? { delayMs: options.delayMs } : {})
      }
    });
  }

  subscribeEvents(subscriber) {
    this.eventSubscribers.add(subscriber);
    return () => {
      this.eventSubscribers.delete(subscriber);
    };
  }

  appendLog(source, line) {
    const entry = {
      timestamp: timestamp(),
      source,
      line: String(line).replace(/\r$/, '')
    };

    if (entry.line.includes('LuaNet: Initialization [DONE]')) {
      this.ready = true;
      this.serverState = 'running';
      if (!this.completeCurrentActionFlow('Server is ready for players.')) {
        this.setFlow('Server Ready', 'status', 'ready', 'Server is ready for players.');
      }
    }

    this.logs.push(entry);
    if (this.logs.length > this.logLimit) {
      this.logs.splice(0, this.logs.length - this.logLimit);
    }

    for (const subscriber of this.logSubscribers) {
      try {
        subscriber(entry);
      } catch (_error) {
        this.logSubscribers.delete(subscriber);
      }
    }
    this.emitEvent('log', { entry });
  }

  subscribeLogs(subscriber) {
    this.logSubscribers.add(subscriber);
    return () => {
      this.logSubscribers.delete(subscriber);
    };
  }

  attachStream(stream, source) {
    let buffer = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        this.appendLog(source, line);
      }
    });
    stream.on('end', () => {
      if (buffer) {
        this.appendLog(source, buffer);
        buffer = '';
      }
    });
  }

  spawnScript(mode) {
    const child = spawn(this.scriptShell, [this.scriptPath, mode], {
      env: this.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.attachStream(child.stdout, `${mode}:stdout`);
    this.attachStream(child.stderr, `${mode}:stderr`);
    return child;
  }

  async prepare(options = {}) {
    const force = Boolean(options.force);
    if (this.prepareState === 'complete' && !force) {
      return;
    }

    if (this.prepareState === 'running') {
      throw new ActionError('Server preparation is already running.', 409);
    }

    this.prepareState = 'running';
    this.prepareError = '';
    const title = options.title || 'Preparation';
    const kind = options.kind || 'preparation';
    const phase = options.phase || 'running';
    this.setFlow(title, kind, phase, options.detail || 'Preparing server files.', {
      checkUpdates: options.checkUpdates,
      failedStep: options.failedStep || (force ? 'updateSteam' : '')
    });
    const child = this.spawnScript('prepare');

    const [code, signal] = await once(child, 'close');
    if (code !== 0) {
      this.prepareState = 'error';
      this.prepareError = `Preparation exited with code ${code}${signal ? ` and signal ${signal}` : ''}.`;
      this.setFlow(options.errorTitle || 'Preparation Failed', kind, 'error', this.prepareError, {
        checkUpdates: options.checkUpdates,
        failedStep: options.failedStep || (force ? 'updateSteam' : '')
      });
      throw new Error(this.prepareError);
    }

    this.prepareState = 'complete';
    this.setFlow(
      options.completeTitle || 'Preparation Complete',
      kind,
      options.completePhase || 'complete',
      options.completeDetail || 'Server files are prepared.',
      {
        checkUpdates: options.checkUpdates,
        failedStep: ''
      }
    );
  }

  async boot() {
    await this.prepare();
    if (this.autoStart) {
      await this.runAction('start', { username: 'system' });
    }
  }

  getStatus() {
    return {
      preparation: {
        state: this.prepareState,
        error: this.prepareError
      },
      server: {
        state: this.serverState,
        ready: this.ready,
        pid: this.serverProcess?.pid || null,
        lastExitCode: this.lastExitCode,
        lastExitSignal: this.lastExitSignal,
        lastExitAt: this.lastExitAt
      },
      capabilities: {
        rcon: Boolean(this.rcon.enabled)
      },
      flow: this.flow,
      activeAction: this.activeAction
    };
  }

  getLogs(limit = 200) {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, this.logLimit) : 200;
    return this.logs.slice(-safeLimit);
  }

  async startServer(flowOptions = {}) {
    if (this.prepareState !== 'complete') {
      throw new ActionError('Project Zomboid server cannot start until preparation completes.', 409);
    }

    if (this.serverProcess) {
      return;
    }

    const title = flowOptions.title || 'Startup';
    const kind = flowOptions.kind || 'startup';
    const flowMeta = {
      checkUpdates: flowOptions.checkUpdates,
      failedStep: 'startServer'
    };
    this.ready = false;
    this.lastExitCode = null;
    this.lastExitSignal = null;
    this.lastExitAt = null;
    this.serverState = 'starting';
    this.setFlow(title, kind, 'starting', 'Starting Project Zomboid server.', flowMeta);

    const child = this.spawnScript('start');
    this.serverProcess = child;
    this.serverClosePromise = once(child, 'close').then(([code, signal]) => {
      if (this.serverProcess === child) {
        const wasStopping = this.serverState === 'stopping';
        this.serverProcess = null;
        this.serverClosePromise = null;
        this.lastExitCode = this.lastExitCode ?? code;
        this.lastExitSignal = this.lastExitSignal ?? signal;
        this.lastExitAt = timestamp();
        this.ready = false;
        const finalState = statusFromClose(code, signal);
        this.serverState = finalState;
        if (finalState === 'stopped') {
          if (wasStopping && isActionKind(this.flow?.kind)) {
            this.setFlow(this.flow.title, this.flow.kind, finalState, 'Server process has fully stopped.', {
              checkUpdates: this.flow.checkUpdates,
              failedStep: ''
            });
          } else {
            this.setFlow('Server Stopped', 'status', finalState, 'Server process has fully stopped.');
          }
        } else {
          this.setFlow(`${title} Failed`, kind, 'error', 'Server process exited unexpectedly.', flowMeta);
        }
      }

      return { code, signal };
    });

    child.once('exit', (code, signal) => {
      if (this.serverProcess === child) {
        this.lastExitCode = code;
        this.lastExitSignal = signal;
        const drainingFlow = this.serverState === 'stopping' && isActionKind(this.flow?.kind)
          ? {
              title: this.flow.title,
              kind: this.flow.kind,
              meta: {
                checkUpdates: this.flow.checkUpdates,
                failedStep: this.flow.failedStep
              }
            }
          : { title, kind, meta: flowMeta };
        this.setFlow(
          drainingFlow.title,
          drainingFlow.kind,
          'draining',
          'Process exited; waiting for shutdown logs to finish.',
          drainingFlow.meta
        );
      }
    });

    child.once('error', (error) => {
      if (this.serverProcess === child) {
        this.serverProcess = null;
        this.serverClosePromise = null;
        this.ready = false;
        this.serverState = 'errored';
        this.lastExitAt = timestamp();
        this.setFlow(`${title} Failed`, kind, 'error', error.message, flowMeta);
      }

      this.appendLog('start:stderr', error.message);
    });
  }

  async stopServer(flowOptions = {}) {
    const title = flowOptions.title || 'Shutdown';
    const kind = flowOptions.kind || 'shutdown';
    const flowMeta = {
      checkUpdates: flowOptions.checkUpdates,
      failedStep: 'stopServer'
    };
    if (!this.serverProcess) {
      this.ready = false;
      this.serverState = 'stopped';
      this.setFlow('Server Stopped', 'status', 'stopped', 'Server is already stopped.');
      return;
    }

    const child = this.serverProcess;
    const closePromise = this.serverClosePromise;
    this.serverState = 'stopping';
    this.ready = false;
    this.setFlow(title, kind, 'shutdown_pending', 'Shutdown pending; waiting for the server process to fully stop.', flowMeta);
    child.kill('SIGTERM');

    if (closePromise) {
      await closePromise;
    }
  }

  async restartServer(flowOptions = {}) {
    const title = flowOptions.title || 'Restart';
    const kind = flowOptions.kind || 'restart';
    await this.stopServer({ title, kind, checkUpdates: flowOptions.checkUpdates });
    if (this.serverState === 'errored') {
      throw new ActionError('Server stopped with an error; restart was not attempted.', 500);
    }
    await this.startServer({ title, kind, checkUpdates: flowOptions.checkUpdates });
  }

  async prepareForUpdates(flowOptions = {}) {
    const title = flowOptions.title || 'Update Check';
    const kind = flowOptions.kind || 'updates';
    await this.prepare({
      force: true,
      title,
      kind,
      phase: 'preparing_updates',
      detail: 'Checking for Project Zomboid updates.',
      completeTitle: title,
      completePhase: 'updates_complete',
      completeDetail: 'Project Zomboid update check complete.',
      errorTitle: `${title} Failed`,
      checkUpdates: true,
      failedStep: 'updateSteam'
    });
  }

  getRconHost() {
    if (this.rcon.host) {
      return this.rcon.host;
    }

    if (this.rcon.hostFile && fs.existsSync(this.rcon.hostFile)) {
      const fileHost = fs.readFileSync(this.rcon.hostFile, 'utf8').trim();
      if (fileHost) {
        return fileHost;
      }
    }

    if (this.env.BIND_IP && this.env.BIND_IP !== '0.0.0.0') {
      return this.env.BIND_IP;
    }

    return '127.0.0.1';
  }

  async runRconCommand(command, args = [], options = {}) {
    if (!this.rcon.enabled) {
      throw new ActionError('RCON is not enabled.', 409);
    }

    const stdout = [];
    const stderr = [];
    const address = `${this.getRconHost()}:${this.rcon.port}`;
    const commandLine = rconCommandLine(command, args);
    const child = spawn(this.rcon.binary || 'rcon', rconCliArgs({
      address,
      password: this.rcon.password,
      command,
      args
    }), {
      env: this.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    if (!options.suppressLogs) {
      this.attachStream(child.stdout, 'rcon:stdout');
      this.attachStream(child.stderr, 'rcon:stderr');
    }

    const [code, signal] = await once(child, 'close');
    const result = {
      command,
      args,
      commandLine,
      stdout: stdout.join(''),
      stderr: stderr.join(''),
      code,
      signal: signal || null
    };

    if (code !== 0) {
      const error = new Error(`RCON command [${commandLine}] failed with code ${code}${signal ? ` and signal ${signal}` : ''}.`);
      error.result = result;
      throw error;
    }

    return result;
  }

  async runRconCommandLine(commandLine) {
    const parsed = parseRconCommandLine(commandLine);
    return this.runRconCommand(parsed.commandLine);
  }

  async getRconStatus(options = {}) {
    return this.rconStatus.getStatus(options);
  }

  async sendRcon(command, args = []) {
    await this.rconRunner(command, args);
  }

  countdownCheckpoints(total = this.safeCountdownSeconds) {
    const checkpoints = new Set(
      [60, 30, 15, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].filter((seconds) => seconds <= total)
    );
    for (let seconds = Math.floor(total / 60) * 60; seconds > 60; seconds -= 60) {
      checkpoints.add(seconds);
    }
    return Array.from(checkpoints).sort((left, right) => right - left);
  }

  async runSafeCountdown(action, options = {}) {
    const title = titleForAction(action);
    const kind = kindForAction(action);
    const target = action === 'safe_restart' ? 'restart' : 'stop';
    const total = countdownSecondsFromOption(options.countdownSeconds, this.safeCountdownSeconds);
    const notificationSeconds = new Set(this.countdownCheckpoints(total));

    for (let seconds = total; seconds > 0; seconds -= 1) {
      const message = `Server will ${target} in ${formatSeconds(seconds)}.`;
      this.setFlow(title, kind, 'countdown', message, {
        countdownRemainingSeconds: seconds,
        countdownTotalSeconds: total,
        checkUpdates: options.checkUpdates,
        failedStep: 'alertPlayers'
      });

      if (notificationSeconds.has(seconds)) {
        this.emitToast(title, message, 'warning');
        await this.sendRcon(serverMessageCommand(message));
      }

      await this.sleep(1000);
    }

    this.setFlow(title, kind, 'saving', 'Saving server before shutdown.', {
      countdownRemainingSeconds: 0,
      countdownTotalSeconds: total,
      checkUpdates: options.checkUpdates,
      failedStep: 'alertPlayers'
    });
    this.emitToast(title, 'Saving server before shutdown.', 'info');
    await this.sendRcon('save');
  }

  async runSafeAction(action, options = {}) {
    if (!this.rcon.enabled) {
      throw new ActionError('Safe stop and restart require RCON to be enabled.', 409);
    }

    const title = titleForAction(action);
    const kind = kindForAction(action);
    const checkUpdates = action === 'safe_restart' && Boolean(options.checkUpdates);
    await this.runSafeCountdown(action, { ...options, checkUpdates });
    if (action === 'safe_stop') {
      await this.stopServer({ title, kind, checkUpdates: false });
    } else {
      await this.stopServer({ title, kind, checkUpdates });
      if (this.serverState === 'errored') {
        throw new ActionError('Server stopped with an error; restart was not attempted.', 500);
      }
      if (checkUpdates) {
        await this.prepareForUpdates({ title, kind, checkUpdates: true });
      }
      await this.startServer({ title, kind, checkUpdates });
    }
  }

  async runAction(action, user, options = {}) {
    if (!['start', 'stop', 'restart', 'safe_stop', 'safe_restart'].includes(action)) {
      throw new ActionError(`Unsupported server action [${action}].`, 400);
    }

    if (this.activeAction) {
      throw new BusyError(this.activeAction);
    }

    const checkUpdates = actionSupportsUpdateCheck(action) && Boolean(options.checkUpdates);
    this.activeAction = {
      action,
      username: user?.username || 'unknown',
      startedAt: timestamp(),
      checkUpdates
    };
    this.emitEvent('action', { action: this.activeAction, status: 'started' });
    this.emitToast(titleForAction(action), 'Action started.', action.startsWith('safe_') ? 'warning' : 'primary');
    this.setFlow(titleForAction(action), kindForAction(action), 'started', 'Action started.', {
      checkUpdates,
      failedStep: failedStepForAction(action)
    });

    try {
      if (action === 'start') {
        const title = titleForAction(action);
        const kind = kindForAction(action);
        if (checkUpdates) {
          await this.prepareForUpdates({ title, kind, checkUpdates: true });
        }
        await this.startServer({ title, kind, checkUpdates });
      } else if (action === 'stop') {
        await this.stopServer({ title: titleForAction(action), kind: kindForAction(action), checkUpdates: false });
      } else if (action === 'restart') {
        const title = titleForAction(action);
        const kind = kindForAction(action);
        await this.stopServer({ title, kind, checkUpdates });
        if (this.serverState === 'errored') {
          throw new ActionError('Server stopped with an error; restart was not attempted.', 500);
        }
        if (checkUpdates) {
          await this.prepareForUpdates({ title, kind, checkUpdates: true });
        }
        await this.startServer({ title, kind, checkUpdates });
      } else {
        await this.runSafeAction(action, { ...options, checkUpdates });
      }

      if ((action === 'stop' || action === 'safe_stop') && this.serverState === 'stopped') {
        this.setFlow(
          titleForAction(action),
          kindForAction(action),
          'complete',
          'Server process has fully stopped.',
          { checkUpdates: false, failedStep: '' }
        );
      }
      this.emitEvent('action', { action: this.activeAction, status: 'completed' });
      this.emitToast(titleForAction(action), 'Action completed.', 'success');
      return this.getStatus();
    } catch (error) {
      this.setFlow(`${titleForAction(action)} Failed`, kindForAction(action), 'error', error.message, {
        checkUpdates: checkUpdates || this.flow?.checkUpdates,
        failedStep: this.flow?.failedStep || failedStepForAction(action)
      });
      this.emitEvent('action', { action: this.activeAction, status: 'failed', message: error.message });
      this.emitToast(`${titleForAction(action)} failed`, error.message, 'danger');
      throw error;
    } finally {
      this.activeAction = null;
      this.emitStatus();
    }
  }

  async shutdown() {
    if (!this.serverProcess) {
      return;
    }

    await this.stopServer();
  }
}

module.exports = {
  ActionError,
  BusyError,
  ServerController,
  parseRconCommandLine,
  rconCliArgs,
  rconCommandLine,
  serverMessageCommand,
  titleForAction
};

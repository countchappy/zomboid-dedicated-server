'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  BusyError,
  ServerController,
  parseRconCommandLine,
  rconCliArgs,
  rconCommandLine,
  serverMessageCommand
} = require('../lib/server-control');
const { PLAYERS_COMMAND, STATUS_COMMANDS } = require('../lib/rcon-status');

function writeScript(contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pz-control-'));
  const scriptPath = path.join(dir, 'run_server.js');
  fs.writeFileSync(scriptPath, contents, { mode: 0o755 });
  return scriptPath;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, message, timeoutMs = 1000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return;
    }
    await delay(10);
  }

  throw new Error(message);
}

function formatSecondsForTest(seconds) {
  if (seconds >= 60 && seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  return `${seconds} second${seconds === 1 ? '' : 's'}`;
}

function expectedWarningMessages(target, secondsList) {
  return secondsList.map((seconds) => `Server will ${target} in ${formatSecondsForTest(seconds)}.`);
}

test('controller records timestamped logs and readiness', async () => {
  const scriptPath = writeScript(`
if (process.argv[2] === 'prepare') {
  console.log('prepared');
  process.exit(0);
}
console.log('LuaNet: Initialization [DONE]');
setTimeout(() => process.exit(0), 200);
`);

  const controller = new ServerController({
    scriptPath,
    scriptShell: process.execPath,
    autoStart: false,
    logLines: 10,
    env: process.env
  });

  await controller.prepare();
  await controller.runAction('start', { username: 'tester' });
  await new Promise((resolve) => setTimeout(resolve, 100));

  assert.equal(controller.getStatus().server.ready, true);
  assert.equal(controller.getStatus().flow.kind, 'startup');
  assert.equal(controller.getStatus().flow.phase, 'complete');
  assert.ok(controller.getLogs(10).some((entry) => entry.timestamp && entry.line.includes('LuaNet')));

  await controller.shutdown();
});

test('controller rejects overlapping actions with a busy response', async () => {
  const scriptPath = writeScript(`
if (process.argv[2] === 'prepare') {
  process.exit(0);
}
process.on('SIGTERM', () => process.exit(0));
setInterval(() => {}, 1000);
`);

  const controller = new ServerController({
    scriptPath,
    scriptShell: process.execPath,
    autoStart: false,
    logLines: 10,
    env: process.env
  });

  await controller.prepare();
  controller.activeAction = { action: 'restart', username: 'tester', startedAt: new Date().toISOString() };

  await assert.rejects(
    controller.runAction('start', { username: 'other' }),
    (error) => error instanceof BusyError && error.statusCode === 409
  );
});

test('controller keeps shutdown pending until child close drains stdio', async () => {
  const controller = new ServerController({
    scriptPath: 'unused',
    scriptShell: process.execPath,
    autoStart: false,
    logLines: 20,
    env: process.env
  });
  const child = new EventEmitter();
  child.kill = (signal) => {
    child.signal = signal;
    return true;
  };

  controller.prepareState = 'complete';
  controller.spawnScript = () => child;
  await controller.startServer();
  assert.equal(controller.getStatus().server.state, 'starting');

  const stop = controller.stopServer();
  assert.equal(child.signal, 'SIGTERM');
  assert.equal(controller.getStatus().server.state, 'stopping');

  child.emit('exit', 0, null);
  await delay(0);

  let status = controller.getStatus();
  assert.equal(status.server.state, 'stopping');
  assert.equal(status.flow.detail, 'Process exited; waiting for shutdown logs to finish.');
  assert.equal(status.flow.phase, 'draining');

  child.emit('close', 0, null);
  await stop;
  status = controller.getStatus();
  assert.equal(status.server.state, 'stopped');
  assert.equal(status.flow.phase, 'stopped');
});

test('RCON broadcast command uses pure RCON syntax without an in-game slash', () => {
  assert.equal(
    serverMessageCommand('Server will stop in 30 seconds.'),
    'servermsg "Server will stop in 30 seconds."'
  );
  assert.equal(
    serverMessageCommand('Say "goodbye" before \\ save.'),
    'servermsg "Say \\"goodbye\\" before \\\\ save."'
  );
});

test('RCON terminal command lines preserve quoted arguments', () => {
  assert.deepEqual(parseRconCommandLine('servermsg "Hello survivors"'), {
    command: 'servermsg',
    args: ['Hello survivors'],
    commandLine: 'servermsg "Hello survivors"'
  });
  assert.deepEqual(parseRconCommandLine('teleport "Count Chappy" 10600 9400 0'), {
    command: 'teleport',
    args: ['Count Chappy', '10600', '9400', '0'],
    commandLine: 'teleport "Count Chappy" 10600 9400 0'
  });
  assert.deepEqual(parseRconCommandLine('/servermsg "Hello survivors"'), {
    command: 'servermsg',
    args: ['Hello survivors'],
    commandLine: 'servermsg "Hello survivors"'
  });
  assert.throws(() => parseRconCommandLine('"unterminated'), /unterminated quote/);
});

test('RCON CLI receives one complete command argument', () => {
  assert.deepEqual(
    rconCliArgs({
      address: '127.0.0.1:27015',
      password: 'secret',
      command: 'servermsg "Hello survivors"'
    }),
    [
      '--address',
      '127.0.0.1:27015',
      '--password',
      'secret',
      'servermsg "Hello survivors"'
    ]
  );
  assert.equal(rconCommandLine('teleport', ['Count Chappy', '10600', '9400', '0']), 'teleport "Count Chappy" 10600 9400 0');
  assert.equal(rconCommandLine('/servermsg "Hello survivors"'), 'servermsg "Hello survivors"');
});

test('RCON status commands use the quiet RCON runner', async () => {
  const controller = new ServerController({
    scriptPath: 'unused',
    scriptShell: process.execPath,
    autoStart: false,
    logLines: 20,
    env: process.env,
    rcon: { enabled: true, port: '27015', password: 'secret' }
  });
  const calls = [];
  controller.runRconCommand = async (command, args = [], options = {}) => {
    calls.push({ command, args, options });
    if (command === 'stats game all') {
      return { stdout: 'players: 1.0\nzombies-total: 12.0\n' };
    }
    if (command === 'stats connection all') {
      return { stdout: 'zombies-killed-today: 3.0\n' };
    }
    if (command === PLAYERS_COMMAND) {
      return { stdout: 'Players connected (2):\n' };
    }
    return { stdout: '' };
  };

  const status = await controller.getRconStatus({ refresh: true });

  assert.deepEqual(calls.map((entry) => entry.command), [
    ...STATUS_COMMANDS.map((entry) => entry.command),
    PLAYERS_COMMAND
  ]);
  assert.equal(calls.every((entry) => entry.options.suppressLogs === true), true);
  assert.deepEqual(calls.map((entry) => entry.args), [[], [], [], [], []]);
  assert.equal(status.summary.playersOnline, 2);
  assert.equal(status.summary.zombiesTotal, 12);
  assert.equal(controller.getLogs(20).length, 0);
});

test('safe countdown emits status every second and restores final 10-second player alerts', async () => {
  const controller = new ServerController({
    scriptPath: 'unused',
    scriptShell: process.execPath,
    autoStart: false,
    logLines: 20,
    env: process.env,
    rcon: { enabled: true, port: '27015', password: 'secret' },
    rconRunner: async () => {},
    safeCountdownSeconds: 60,
    sleep: async () => {}
  });
  const toasts = [];
  const statuses = [];
  const commands = [];
  controller.rconRunner = async (command, args = []) => {
    commands.push({ command, args });
  };
  controller.activeAction = {
    action: 'safe_restart',
    username: 'tester',
    startedAt: '2026-05-17T00:00:00.000Z'
  };
  controller.subscribeEvents((event) => {
    if (event.type === 'toast') {
      toasts.push(event.toast);
    }
    if (event.type === 'status') {
      statuses.push(event.status);
    }
  });

  await controller.runSafeCountdown('safe_restart');

  const countdownStatuses = statuses.filter((status) => status.flow.phase === 'countdown');
  assert.equal(countdownStatuses.length, 60);
  assert.deepEqual(
    countdownStatuses.map((status) => status.flow.countdownRemainingSeconds),
    Array.from({ length: 60 }, (_value, index) => 60 - index)
  );
  assert.deepEqual(
    countdownStatuses.map((status) => status.flow.countdownTotalSeconds),
    Array(60).fill(60)
  );
  const alertSeconds = [60, 30, 15, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  const messages = expectedWarningMessages('restart', alertSeconds);
  assert.deepEqual(
    toasts.filter((toast) => toast.message.startsWith('Server will')).map((toast) => toast.message),
    messages
  );
  assert.deepEqual(commands.map((entry) => entry.command), [
    ...messages.map(serverMessageCommand),
    'save'
  ]);
});

test('safe countdown accepts per-action duration and alerts every minute above one minute', async () => {
  const controller = new ServerController({
    scriptPath: 'unused',
    scriptShell: process.execPath,
    autoStart: false,
    logLines: 20,
    env: process.env,
    rcon: { enabled: true, port: '27015', password: 'secret' },
    rconRunner: async () => {},
    safeCountdownSeconds: 60,
    sleep: async () => {}
  });
  const commands = [];
  controller.rconRunner = async (command, args = []) => {
    commands.push({ command, args });
  };

  await controller.runSafeCountdown('safe_stop', { countdownSeconds: 180 });

  const alertSeconds = [180, 120, 60, 30, 15, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  const messages = expectedWarningMessages('stop', alertSeconds);
  assert.deepEqual(commands.map((entry) => entry.command), [
    ...messages.map(serverMessageCommand),
    'save'
  ]);
});

test('safe countdown option is bounded to one through fifteen minutes', async () => {
  const controller = new ServerController({
    scriptPath: 'unused',
    scriptShell: process.execPath,
    autoStart: false,
    logLines: 20,
    env: process.env,
    rcon: { enabled: true, port: '27015', password: 'secret' },
    rconRunner: async () => {},
    safeCountdownSeconds: 60,
    sleep: async () => {}
  });

  await assert.rejects(
    () => controller.runSafeCountdown('safe_stop', { countdownSeconds: 59 }),
    /between 60 and 900 seconds/
  );
  await assert.rejects(
    () => controller.runSafeCountdown('safe_restart', { countdownSeconds: 901 }),
    /between 60 and 900 seconds/
  );
});

test('safe restart counts down, saves, and restarts under the action lock', async () => {
  const prepareLog = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pz-prepare-')), 'count.txt');
  const scriptPath = writeScript(`
const fs = require('node:fs');
if (process.argv[2] === 'prepare') {
  fs.appendFileSync(process.env.PREPARE_LOG, '1');
  process.exit(0);
}
console.log('LuaNet: Initialization [DONE]');
process.on('SIGTERM', () => setTimeout(() => process.exit(0), 5));
setInterval(() => {}, 1000);
`);
  const commands = [];

  const controller = new ServerController({
    scriptPath,
    scriptShell: process.execPath,
    autoStart: false,
    logLines: 20,
    env: { ...process.env, PREPARE_LOG: prepareLog },
    rcon: { enabled: true, port: '27015', password: 'secret' },
    rconRunner: async (command, args = []) => {
      commands.push({ command, args });
    },
    safeCountdownSeconds: 3,
    sleep: async () => {}
  });

  await controller.prepare();
  await controller.runAction('start', { username: 'tester' });
  await waitFor(() => controller.getStatus().server.ready, 'Server did not become ready.');

  await controller.runAction('safe_restart', { username: 'tester' }, { checkUpdates: true });
  await waitFor(() => controller.getStatus().server.ready, 'Server did not restart.');

  assert.deepEqual(commands.map((entry) => entry.command), [
    ...expectedWarningMessages('restart', [3, 2, 1]).map(serverMessageCommand),
    'save'
  ]);
  assert.deepEqual(commands.map((entry) => entry.args), [[], [], [], []]);
  assert.equal(fs.readFileSync(prepareLog, 'utf8'), '11');
  assert.equal(controller.getStatus().server.state, 'running');

  await controller.shutdown();
});

test('start with update check force-runs prepare before launching', async () => {
  const prepareLog = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pz-prepare-')), 'count.txt');
  const scriptPath = writeScript(`
const fs = require('node:fs');
if (process.argv[2] === 'prepare') {
  fs.appendFileSync(process.env.PREPARE_LOG, '1');
  process.exit(0);
}
console.log('LuaNet: Initialization [DONE]');
process.on('SIGTERM', () => setTimeout(() => process.exit(0), 5));
setInterval(() => {}, 1000);
`);

  const controller = new ServerController({
    scriptPath,
    scriptShell: process.execPath,
    autoStart: false,
    logLines: 20,
    env: { ...process.env, PREPARE_LOG: prepareLog }
  });

  await controller.prepare();
  await controller.runAction('start', { username: 'tester' }, { checkUpdates: true });
  await waitFor(() => controller.getStatus().server.ready, 'Server did not become ready.');

  assert.equal(fs.readFileSync(prepareLog, 'utf8'), '11');
  assert.equal(controller.getStatus().server.state, 'running');

  await controller.shutdown();
});

test('start without update check keeps existing prepare behavior', async () => {
  const prepareLog = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pz-prepare-')), 'count.txt');
  const scriptPath = writeScript(`
const fs = require('node:fs');
if (process.argv[2] === 'prepare') {
  fs.appendFileSync(process.env.PREPARE_LOG, '1');
  process.exit(0);
}
console.log('LuaNet: Initialization [DONE]');
process.on('SIGTERM', () => setTimeout(() => process.exit(0), 5));
setInterval(() => {}, 1000);
`);

  const controller = new ServerController({
    scriptPath,
    scriptShell: process.execPath,
    autoStart: false,
    logLines: 20,
    env: { ...process.env, PREPARE_LOG: prepareLog }
  });

  await controller.prepare();
  await controller.runAction('start', { username: 'tester' }, { checkUpdates: false });
  await waitFor(() => controller.getStatus().server.ready, 'Server did not become ready.');

  assert.equal(fs.readFileSync(prepareLog, 'utf8'), '1');
  assert.equal(controller.getStatus().server.state, 'running');

  await controller.shutdown();
});

test('restart with update check force-runs prepare before starting again', async () => {
  const prepareLog = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pz-prepare-')), 'count.txt');
  const scriptPath = writeScript(`
const fs = require('node:fs');
if (process.argv[2] === 'prepare') {
  fs.appendFileSync(process.env.PREPARE_LOG, '1');
  process.exit(0);
}
console.log('LuaNet: Initialization [DONE]');
process.on('SIGTERM', () => setTimeout(() => process.exit(0), 5));
setInterval(() => {}, 1000);
`);

  const controller = new ServerController({
    scriptPath,
    scriptShell: process.execPath,
    autoStart: false,
    logLines: 20,
    env: { ...process.env, PREPARE_LOG: prepareLog }
  });

  await controller.prepare();
  await controller.runAction('start', { username: 'tester' });
  await waitFor(() => controller.getStatus().server.ready, 'Server did not become ready.');

  await controller.runAction('restart', { username: 'tester' }, { checkUpdates: true });
  await waitFor(() => controller.getStatus().server.ready, 'Server did not restart.');

  assert.equal(fs.readFileSync(prepareLog, 'utf8'), '11');
  assert.equal(controller.getStatus().server.state, 'running');

  await controller.shutdown();
});

test('stop ignores update check requests and remains stopped', async () => {
  const prepareLog = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pz-prepare-')), 'count.txt');
  const scriptPath = writeScript(`
const fs = require('node:fs');
if (process.argv[2] === 'prepare') {
  fs.appendFileSync(process.env.PREPARE_LOG, '1');
  process.exit(0);
}
console.log('LuaNet: Initialization [DONE]');
process.on('SIGTERM', () => setTimeout(() => process.exit(0), 5));
setInterval(() => {}, 1000);
`);

  const controller = new ServerController({
    scriptPath,
    scriptShell: process.execPath,
    autoStart: false,
    logLines: 20,
    env: { ...process.env, PREPARE_LOG: prepareLog }
  });

  await controller.prepare();
  await controller.runAction('start', { username: 'tester' });
  await waitFor(() => controller.getStatus().server.ready, 'Server did not become ready.');

  await controller.runAction('stop', { username: 'tester' }, { checkUpdates: true });

  assert.equal(fs.readFileSync(prepareLog, 'utf8'), '1');
  assert.equal(controller.getStatus().server.state, 'stopped');
  assert.equal(controller.getStatus().flow.kind, 'shutdown');
  assert.equal(controller.getStatus().flow.phase, 'complete');
  assert.equal(controller.getStatus().flow.checkUpdates, false);
});

test('safe stop ignores update check requests and completes without preparing again', async () => {
  const prepareLog = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pz-prepare-')), 'count.txt');
  const scriptPath = writeScript(`
const fs = require('node:fs');
if (process.argv[2] === 'prepare') {
  fs.appendFileSync(process.env.PREPARE_LOG, '1');
  process.exit(0);
}
console.log('LuaNet: Initialization [DONE]');
process.on('SIGTERM', () => setTimeout(() => process.exit(0), 5));
setInterval(() => {}, 1000);
`);
  const commands = [];

  const controller = new ServerController({
    scriptPath,
    scriptShell: process.execPath,
    autoStart: false,
    logLines: 20,
    env: { ...process.env, PREPARE_LOG: prepareLog },
    rcon: { enabled: true, port: '27015', password: 'secret' },
    rconRunner: async (command, args = []) => {
      commands.push({ command, args });
    },
    safeCountdownSeconds: 1,
    sleep: async () => {}
  });

  await controller.prepare();
  await controller.runAction('start', { username: 'tester' });
  await waitFor(() => controller.getStatus().server.ready, 'Server did not become ready.');

  await controller.runAction('safe_stop', { username: 'tester' }, { checkUpdates: true });

  assert.deepEqual(commands.map((entry) => entry.command), [
    serverMessageCommand('Server will stop in 1 second.'),
    'save'
  ]);
  assert.equal(fs.readFileSync(prepareLog, 'utf8'), '1');
  assert.equal(controller.getStatus().server.state, 'stopped');
  assert.equal(controller.getStatus().flow.kind, 'safe_shutdown');
  assert.equal(controller.getStatus().flow.phase, 'complete');
  assert.equal(controller.getStatus().flow.checkUpdates, false);
});

test('safe stop completion keeps shutdown flow even if process close restores stale startup flow', async () => {
  const controller = new ServerController({
    scriptPath: 'unused',
    scriptShell: process.execPath,
    autoStart: false,
    logLines: 10,
    env: process.env,
    rcon: { enabled: true, port: '27015', password: 'secret' },
    rconRunner: async () => {},
    sleep: async () => {}
  });

  controller.prepareState = 'complete';
  controller.serverState = 'running';
  controller.ready = true;
  controller.runSafeCountdown = async () => {};
  controller.stopServer = async () => {
    controller.serverState = 'stopped';
    controller.ready = false;
    controller.setFlow('Startup', 'startup', 'stopped', 'Server process has fully stopped.');
  };

  await controller.runAction('safe_stop', { username: 'tester' }, { checkUpdates: true });

  const status = controller.getStatus();
  assert.equal(status.server.state, 'stopped');
  assert.equal(status.flow.title, 'Safe Shutdown');
  assert.equal(status.flow.kind, 'safe_shutdown');
  assert.equal(status.flow.phase, 'complete');
  assert.equal(status.flow.detail, 'Server process has fully stopped.');
  assert.equal(status.flow.checkUpdates, false);
});

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  actionRequiresConfirmation,
  disabledActionReason,
  getButtonState,
  getFlowSteps,
  getFlowTitle,
  normalizeThemeChoice,
  resolveTheme
} = require('../public/ui-state');

function status({
  preparation = 'complete',
  server = 'stopped',
  ready = false,
  activeAction = null,
  rcon = false,
  flow = null
} = {}) {
  return {
    preparation: { state: preparation, error: '' },
    server: { state: server, ready },
    capabilities: { rcon },
    flow,
    activeAction
  };
}

function ids(steps) {
  return steps.map((step) => step.id);
}

test('theme selection defaults to system and resolves from media query', () => {
  assert.equal(normalizeThemeChoice('purple'), 'system');
  assert.equal(resolveTheme('light'), 'light');
  assert.equal(resolveTheme('dark'), 'dark');
  assert.equal(resolveTheme('system', () => ({ matches: true })), 'dark');
  assert.equal(resolveTheme('system', () => ({ matches: false })), 'light');
});

test('button rules follow server lifecycle readiness', () => {
  assert.deepEqual(getButtonState(status({ preparation: 'running', server: 'stopped' })), {
    rconEnabled: false,
    start: false,
    stop: false,
    restart: false,
    safeStop: false,
    safeRestart: false,
    immediateStop: false,
    immediateRestart: false
  });
  assert.deepEqual(getButtonState(status({ server: 'starting' })), {
    rconEnabled: false,
    start: false,
    stop: false,
    restart: false,
    safeStop: false,
    safeRestart: false,
    immediateStop: false,
    immediateRestart: false
  });
  assert.deepEqual(getButtonState(status({ server: 'stopped' })), {
    rconEnabled: false,
    start: true,
    stop: false,
    restart: false,
    safeStop: false,
    safeRestart: false,
    immediateStop: false,
    immediateRestart: false
  });
  assert.deepEqual(getButtonState(status({ server: 'running', ready: true })), {
    rconEnabled: false,
    start: false,
    stop: true,
    restart: true,
    safeStop: false,
    safeRestart: false,
    immediateStop: false,
    immediateRestart: false
  });
  assert.deepEqual(getButtonState(status({ server: 'running', activeAction: { action: 'restart' } })), {
    rconEnabled: false,
    start: false,
    stop: false,
    restart: false,
    safeStop: false,
    safeRestart: false,
    immediateStop: false,
    immediateRestart: false
  });
});

test('RCON changes visible action affordances without weakening lifecycle rules', () => {
  assert.deepEqual(getButtonState(status({ server: 'running', ready: true, rcon: true })), {
    rconEnabled: true,
    start: false,
    stop: false,
    restart: false,
    safeStop: true,
    safeRestart: true,
    immediateStop: true,
    immediateRestart: true
  });
  assert.deepEqual(getButtonState(status({ server: 'stopping', rcon: true })), {
    rconEnabled: true,
    start: false,
    stop: false,
    restart: false,
    safeStop: false,
    safeRestart: false,
    immediateStop: false,
    immediateRestart: false
  });
});

test('disabled action reasons explain lifecycle blockers', () => {
  assert.equal(
    disabledActionReason(status({ preparation: 'running', server: 'stopped' }), 'start'),
    'Waiting for server preparation to complete.'
  );
  assert.equal(
    disabledActionReason(status({ server: 'running', activeAction: { action: 'restart' } }), 'start'),
    'Action restart is already running.'
  );
  assert.equal(
    disabledActionReason(status({ server: 'stopped' }), 'safe_restart'),
    'RCON is not enabled, so safe player-warning actions are unavailable.'
  );
  assert.equal(
    disabledActionReason(status({ server: 'running', ready: true }), 'stop'),
    ''
  );
});

test('server actions require confirmation before running', () => {
  assert.equal(actionRequiresConfirmation('stop'), true);
  assert.equal(actionRequiresConfirmation('restart'), true);
  assert.equal(actionRequiresConfirmation('safe_stop'), true);
  assert.equal(actionRequiresConfirmation('safe_restart'), true);
  assert.equal(actionRequiresConfirmation('start'), true);
});

test('normal status overview is a single current server status step', () => {
  const steps = getFlowSteps(status({ preparation: 'complete', server: 'starting', ready: false }));

  assert.equal(steps.length, 1);
  assert.equal(steps[0].id, 'serverStatus');
  assert.equal(steps[0].title, 'Server status');
  assert.equal(steps[0].detail, 'starting');
  assert.equal(steps[0].status, 'running');
});

test('start flow renders the start-only layout', () => {
  const current = status({
    server: 'starting',
    activeAction: { action: 'start', checkUpdates: false },
    flow: {
      title: 'Startup',
      kind: 'startup',
      phase: 'starting',
      detail: 'Starting Project Zomboid server.',
      countdownRemainingSeconds: null
    }
  });
  const steps = getFlowSteps(current);

  assert.equal(getFlowTitle(current), 'Starting Server');
  assert.deepEqual(ids(steps), ['startServer', 'serverStarted']);
  assert.equal(steps[0].status, 'running');
  assert.equal(steps[1].status, 'pending');
});

test('start with update includes SteamCMD before starting', () => {
  const current = status({
    server: 'stopped',
    activeAction: { action: 'start', checkUpdates: true },
    flow: {
      title: 'Startup',
      kind: 'startup',
      phase: 'preparing_updates',
      detail: 'Checking for Project Zomboid updates.',
      countdownRemainingSeconds: null,
      checkUpdates: true
    }
  });
  const steps = getFlowSteps(current);

  assert.equal(getFlowTitle(current), 'Starting Server with Update');
  assert.deepEqual(ids(steps), ['updateSteam', 'startServer', 'serverStarted']);
  assert.equal(steps[0].status, 'running');
});

test('safe stop starts with player alerting before shutdown', () => {
  const steps = getFlowSteps(status({
    server: 'running',
    ready: true,
    rcon: true,
    activeAction: { action: 'safe_stop', checkUpdates: false },
    flow: {
      title: 'Safe Shutdown',
      kind: 'safe_shutdown',
      phase: 'countdown',
      detail: 'Server will stop in 10 seconds.',
      countdownRemainingSeconds: 10
    }
  }));

  assert.deepEqual(ids(steps), ['alertPlayers', 'stopServer', 'serverStopped']);
  assert.equal(steps[0].status, 'running');
  assert.equal(steps[0].detail, '10 seconds remaining');
  assert.equal(steps[1].status, 'pending');
  assert.equal(steps[2].status, 'pending');
});

test('stop layouts ignore stale update-check flags', () => {
  const safeSteps = getFlowSteps(status({
    server: 'stopping',
    rcon: true,
    activeAction: { action: 'safe_stop', checkUpdates: true },
    flow: {
      title: 'Safe Shutdown',
      kind: 'safe_shutdown',
      phase: 'shutdown_pending',
      detail: 'Shutdown pending; waiting for the server process to fully stop.',
      countdownRemainingSeconds: null,
      checkUpdates: true
    }
  }));
  assert.deepEqual(ids(safeSteps), ['alertPlayers', 'stopServer', 'serverStopped']);

  const directSteps = getFlowSteps(status({
    server: 'stopping',
    activeAction: { action: 'stop', checkUpdates: true },
    flow: {
      title: 'Shutdown',
      kind: 'shutdown',
      phase: 'shutdown_pending',
      detail: 'Shutdown pending; waiting for the server process to fully stop.',
      countdownRemainingSeconds: null,
      checkUpdates: true
    }
  }));
  assert.deepEqual(ids(directSteps), ['stopServer', 'serverStopped']);
});

test('safe restart countdown is not completed just because the server is still ready', () => {
  const steps = getFlowSteps(status({
    server: 'running',
    ready: true,
    rcon: true,
    activeAction: { action: 'safe_restart', checkUpdates: false },
    flow: {
      title: 'Safe Restart',
      kind: 'safe_restart',
      phase: 'countdown',
      detail: 'Server will restart in 1 minute.',
      countdownRemainingSeconds: 60
    }
  }));

  assert.deepEqual(ids(steps), ['alertPlayers', 'stopServer', 'startServer', 'serverStarted']);
  assert.equal(steps[0].status, 'running');
  assert.equal(steps[0].detail, '60 seconds remaining');
  assert.deepEqual(steps.slice(1).map((step) => step.status), ['pending', 'pending', 'pending']);
});

test('safe restart uses the restart layout with player alerting', () => {
  const current = status({
    server: 'stopping',
    rcon: true,
    activeAction: { action: 'safe_restart', checkUpdates: false },
    flow: {
      title: 'Safe Restart',
      kind: 'safe_restart',
      phase: 'shutdown_pending',
      detail: 'Shutdown pending; waiting for the server process to fully stop.',
      countdownRemainingSeconds: null
    }
  });
  const steps = getFlowSteps(current);

  assert.equal(getFlowTitle(current), 'Restarting Server');
  assert.deepEqual(ids(steps), ['alertPlayers', 'stopServer', 'startServer', 'serverStarted']);
  assert.equal(steps[0].status, 'completed');
  assert.equal(steps[1].status, 'running');
});

test('safe restart with update places SteamCMD after stopping and before starting', () => {
  const current = status({
    server: 'stopped',
    rcon: true,
    activeAction: { action: 'safe_restart', checkUpdates: true },
    flow: {
      title: 'Safe Restart',
      kind: 'safe_restart',
      phase: 'preparing_updates',
      detail: 'Checking for Project Zomboid updates.',
      countdownRemainingSeconds: null,
      checkUpdates: true
    }
  });
  const steps = getFlowSteps(current);

  assert.equal(getFlowTitle(current), 'Restarting Server with Update');
  assert.deepEqual(ids(steps), ['alertPlayers', 'stopServer', 'updateSteam', 'startServer', 'serverStarted']);
  assert.equal(steps[0].status, 'completed');
  assert.equal(steps[1].status, 'completed');
  assert.equal(steps[2].status, 'running');
});

test('completed restart steps stay completed while later steps run', () => {
  const steps = getFlowSteps(status({
    server: 'starting',
    activeAction: { action: 'restart', checkUpdates: true },
    flow: {
      title: 'Restart',
      kind: 'restart',
      phase: 'starting',
      detail: 'Starting Project Zomboid server.',
      countdownRemainingSeconds: null,
      checkUpdates: true
    }
  }));

  assert.deepEqual(ids(steps), ['stopServer', 'updateSteam', 'startServer', 'serverStarted']);
  assert.equal(steps[0].status, 'completed');
  assert.equal(steps[0].detail, 'completed');
  assert.equal(steps[1].status, 'completed');
  assert.equal(steps[1].detail, 'completed');
  assert.equal(steps[2].status, 'running');
  assert.equal(steps[2].detail, 'starting');
});

test('immediate restart compatibility layout does not claim players were alerted', () => {
  const steps = getFlowSteps(status({
    server: 'stopping',
    activeAction: { action: 'restart', checkUpdates: false },
    flow: {
      title: 'Restart',
      kind: 'restart',
      phase: 'shutdown_pending',
      detail: 'Shutdown pending; waiting for the server process to fully stop.',
      countdownRemainingSeconds: null
    }
  }));

  assert.deepEqual(ids(steps), ['stopServer', 'startServer', 'serverStarted']);
  assert.equal(steps[0].status, 'running');
});

test('failed action layout remains visible with the failed step detail', () => {
  const current = status({
    server: 'errored',
    flow: {
      title: 'Startup Failed',
      kind: 'startup',
      phase: 'error',
      detail: 'SteamCMD failed.',
      countdownRemainingSeconds: null,
      checkUpdates: true,
      failedStep: 'updateSteam'
    }
  });
  const steps = getFlowSteps(current);

  assert.equal(getFlowTitle(current), 'Starting Server with Update');
  assert.deepEqual(ids(steps), ['updateSteam', 'startServer', 'serverStarted']);
  assert.equal(steps[0].status, 'failed');
  assert.equal(steps[0].detail, 'SteamCMD failed.');
});

test('completed action layout remains visible after success', () => {
  const current = status({
    server: 'running',
    ready: true,
    flow: {
      title: 'Restart',
      kind: 'restart',
      phase: 'complete',
      detail: 'Server is ready for players.',
      countdownRemainingSeconds: null
    }
  });
  const steps = getFlowSteps(current);

  assert.equal(getFlowTitle(current), 'Restarting Server');
  assert.deepEqual(ids(steps), ['stopServer', 'startServer', 'serverStarted']);
  assert.deepEqual(steps.map((step) => step.status), ['completed', 'completed', 'completed']);
});

test('ready overview uses one normal status step when no action flow is active', () => {
  const current = status({
    server: 'running',
    ready: true,
    flow: {
      title: 'Server Ready',
      kind: 'status',
      phase: 'ready',
      detail: 'Server is ready for players.',
      countdownRemainingSeconds: null
    }
  });

  assert.equal(getFlowTitle(current), 'Server Ready');
  assert.deepEqual(ids(getFlowSteps(current)), ['serverStatus']);
});

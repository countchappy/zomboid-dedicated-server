(function initPortalUiState(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PortalUiState = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildPortalUiState() {
  'use strict';

  const TRANSITIONAL_SERVER_STATES = new Set(['starting', 'stopping']);
  const STARTABLE_SERVER_STATES = new Set(['stopped', 'errored']);

  const STEP_LABELS = {
    alertPlayers: 'Alerting players',
    stopServer: 'Stopping server',
    updateSteam: 'Updating Project Zomboid through SteamCMD',
    startServer: 'Starting server',
    serverStarted: 'Started',
    serverStopped: 'Stopped'
  };

  const ACTION_LAYOUTS = {
    start: {
      title: 'Starting Server',
      steps: ['startServer', 'serverStarted']
    },
    startWithSteamUpdate: {
      title: 'Starting Server with Update',
      steps: ['updateSteam', 'startServer', 'serverStarted']
    },
    safeStop: {
      title: 'Stopping Server',
      steps: ['alertPlayers', 'stopServer', 'serverStopped']
    },
    restart: {
      title: 'Restarting Server',
      steps: ['alertPlayers', 'stopServer', 'startServer', 'serverStarted']
    },
    restartWithSteamUpdate: {
      title: 'Restarting Server with Update',
      steps: ['alertPlayers', 'stopServer', 'updateSteam', 'startServer', 'serverStarted']
    },
    directStop: {
      title: 'Stopping Server',
      steps: ['stopServer', 'serverStopped']
    },
    directRestart: {
      title: 'Restarting Server',
      steps: ['stopServer', 'startServer', 'serverStarted']
    },
    directRestartWithSteamUpdate: {
      title: 'Restarting Server with Update',
      steps: ['stopServer', 'updateSteam', 'startServer', 'serverStarted']
    }
  };

  function normalizeThemeChoice(value) {
    return ['system', 'light', 'dark'].includes(value) ? value : 'system';
  }

  function resolveTheme(choice, matchMediaFn) {
    const normalized = normalizeThemeChoice(choice);
    if (normalized !== 'system') {
      return normalized;
    }

    const query = typeof matchMediaFn === 'function'
      ? matchMediaFn('(prefers-color-scheme: dark)')
      : null;
    return query && query.matches ? 'dark' : 'light';
  }

  function getButtonState(status) {
    const preparationComplete = status?.preparation?.state === 'complete';
    const serverState = status?.server?.state || 'stopped';
    const actionActive = Boolean(status?.activeAction);
    const transitioning = TRANSITIONAL_SERVER_STATES.has(serverState);
    const canAct = preparationComplete && !actionActive && !transitioning;
    const canStop = canAct && serverState === 'running';
    const rconEnabled = Boolean(status?.capabilities?.rcon);

    return {
      rconEnabled,
      start: canAct && STARTABLE_SERVER_STATES.has(serverState),
      stop: !rconEnabled && canStop,
      restart: !rconEnabled && canStop,
      safeStop: rconEnabled && canStop,
      safeRestart: rconEnabled && canStop,
      immediateStop: rconEnabled && canStop,
      immediateRestart: rconEnabled && canStop
    };
  }

  function disabledActionReason(status, action) {
    const buttonState = getButtonState(status);
    const actionKey = {
      safe_stop: 'safeStop',
      safe_restart: 'safeRestart',
      stop: 'stop',
      restart: 'restart',
      start: 'start',
      immediate_stop: 'immediateStop',
      immediate_restart: 'immediateRestart'
    }[action] || action;

    if (buttonState[actionKey]) {
      return '';
    }

    const preparationState = status?.preparation?.state || 'idle';
    const serverState = status?.server?.state || 'stopped';
    const activeAction = status?.activeAction;
    const rconEnabled = Boolean(status?.capabilities?.rcon);

    if (preparationState === 'error') {
      return status?.preparation?.error || 'Preparation failed; resolve it before running server actions.';
    }

    if (preparationState !== 'complete') {
      return 'Waiting for server preparation to complete.';
    }

    if (activeAction) {
      return `Action ${activeAction.action || 'unknown'} is already running.`;
    }

    if (TRANSITIONAL_SERVER_STATES.has(serverState)) {
      return `Server is currently ${serverState}.`;
    }

    if ((actionKey === 'safeStop' || actionKey === 'safeRestart') && !rconEnabled) {
      return 'RCON is not enabled, so safe player-warning actions are unavailable.';
    }

    if (actionKey === 'start') {
      return 'Server must be stopped or errored before it can be started.';
    }

    if (['stop', 'restart', 'safeStop', 'safeRestart', 'immediateStop', 'immediateRestart'].includes(actionKey)) {
      return 'Server must be running before this action is available.';
    }

    return 'This action is not available right now.';
  }

  function actionRequiresConfirmation(action) {
    return ['start', 'stop', 'restart', 'safe_stop', 'safe_restart'].includes(action);
  }

  function getFlow(status) {
    return status?.flow || {
      title: 'Server Status',
      kind: 'status',
      phase: 'idle',
      detail: 'Server is stopped.',
      countdownRemainingSeconds: null,
      checkUpdates: false,
      failedStep: ''
    };
  }

  function actionFromFlowKind(kind) {
    return {
      startup: 'start',
      shutdown: 'stop',
      restart: 'restart',
      safe_shutdown: 'safe_stop',
      safe_restart: 'safe_restart'
    }[kind] || '';
  }

  function isActionFlow(flow) {
    return Boolean(actionFromFlowKind(flow.kind)) || flow.kind === 'error';
  }

  function hasSteamUpdate(status, flow) {
    return Boolean(status?.activeAction?.checkUpdates || flow.checkUpdates);
  }

  function getLayoutKey(status) {
    const flow = getFlow(status);
    if (!status?.activeAction && !isActionFlow(flow)) {
      return '';
    }

    const action = status?.activeAction?.action || actionFromFlowKind(flow.kind);
    const checkUpdates = hasSteamUpdate(status, flow);

    if (action === 'start') {
      return checkUpdates ? 'startWithSteamUpdate' : 'start';
    }

    if (action === 'safe_stop') {
      return 'safeStop';
    }

    if (action === 'safe_restart') {
      return checkUpdates ? 'restartWithSteamUpdate' : 'restart';
    }

    if (action === 'restart') {
      return checkUpdates ? 'directRestartWithSteamUpdate' : 'directRestart';
    }

    if (action === 'stop') {
      return 'directStop';
    }

    return '';
  }

  function getFlowTitle(status) {
    const layout = ACTION_LAYOUTS[getLayoutKey(status)];
    if (layout) {
      return layout.title;
    }

    if (status?.server?.ready) {
      return 'Server Ready';
    }

    return getFlow(status).title || 'Server Status';
  }

  function normalStep(id, title, detail, state) {
    const status = state?.error ? 'failed' : state?.active ? 'running' : state?.complete ? 'completed' : 'pending';
    return {
      id,
      key: id,
      title,
      detail,
      status,
      complete: status === 'completed',
      active: status === 'running',
      error: status === 'failed'
    };
  }

  function normalStatusSteps(status) {
    const preparationState = status?.preparation?.state || 'idle';
    const serverState = status?.server?.state || 'stopped';
    const ready = Boolean(status?.server?.ready);
    const preparing = preparationState === 'running';
    const prepareError = preparationState === 'error';
    const title = ready ? 'Server ready' : 'Server status';
    const detail = prepareError
      ? status?.preparation?.error || 'Preparation failed'
      : preparing
        ? 'preparing server files'
        : ready
          ? 'ready for players'
          : serverState;

    return [
      normalStep('serverStatus', title, detail, {
        complete: ready,
        active: preparing || TRANSITIONAL_SERVER_STATES.has(serverState) || (serverState === 'running' && !ready),
        error: prepareError || serverState === 'errored'
      })
    ];
  }

  function phaseStep(flow, status, layout) {
    const phase = flow.phase || '';
    const serverState = status?.server?.state || 'stopped';
    const ready = Boolean(status?.server?.ready);

    if (phase === 'complete') {
      return layout.steps[layout.steps.length - 1];
    }

    if (phase === 'ready') {
      return 'serverStarted';
    }

    if (phase === 'error') {
      return flow.failedStep || inferFailedStep(layout);
    }

    if (phase === 'countdown' || phase === 'saving') {
      return layout.steps.includes('alertPlayers') ? 'alertPlayers' : layout.steps[0];
    }

    if (phase === 'shutdown_pending' || phase === 'draining' || serverState === 'stopping') {
      return 'stopServer';
    }

    if (phase === 'preparing_updates') {
      return 'updateSteam';
    }

    if (ready && layout.steps[layout.steps.length - 1] === 'serverStarted') {
      return 'serverStarted';
    }

    if (phase === 'starting' || serverState === 'starting') {
      return 'startServer';
    }

    if (phase === 'started') {
      return layout.steps[0];
    }

    if (serverState === 'stopped') {
      if (layout.steps.includes('updateSteam') && phase !== 'updates_complete') {
        return 'updateSteam';
      }
      if (layout.steps.includes('startServer')) {
        return 'startServer';
      }
      return layout.steps.includes('serverStopped') ? 'serverStopped' : layout.steps[0];
    }

    return layout.steps[0];
  }

  function inferFailedStep(layout) {
    if (layout.steps.includes('updateSteam')) {
      return 'updateSteam';
    }

    if (layout.steps.includes('startServer')) {
      return 'startServer';
    }

    if (layout.steps.includes('stopServer')) {
      return 'stopServer';
    }

    return layout.steps[0];
  }

  function isStepCompleted(stepKey, status, flow, layout, activeIndex, stepIndex) {
    const phase = flow.phase || '';
    const ready = Boolean(status?.server?.ready);
    const serverState = status?.server?.state || 'stopped';

    if (phase === 'complete') {
      return true;
    }

    if (
      ready &&
      layout.steps[layout.steps.length - 1] === 'serverStarted' &&
      ['ready', 'starting'].includes(phase)
    ) {
      return true;
    }

    if (phase === 'updates_complete' && stepKey === 'updateSteam') {
      return true;
    }

    if (stepKey === 'serverStopped' && serverState === 'stopped' && !layout.steps.includes('startServer')) {
      return true;
    }

    if (stepKey === 'stopServer' && ['preparing_updates', 'updates_complete', 'starting'].includes(phase)) {
      return true;
    }

    return stepIndex < activeIndex;
  }

  function stepDetail(stepKey, status, flow, stepStatus) {
    if (stepStatus === 'failed') {
      return flow.detail || 'Failed';
    }

    if (stepStatus === 'running') {
      if (stepKey === 'alertPlayers') {
        if (flow.phase === 'saving') {
          return 'saving server';
        }

        const seconds = Number(flow.countdownRemainingSeconds);
        if (Number.isFinite(seconds) && seconds > 0) {
          return `${seconds} second${seconds === 1 ? '' : 's'} remaining`;
        }

        return 'notifying players';
      }

      if (stepKey === 'updateSteam') {
        return 'checking for updates';
      }

      if (stepKey === 'stopServer') {
        return 'waiting for shutdown';
      }

      if (stepKey === 'startServer') {
        return 'starting';
      }
    }

    if (stepStatus === 'completed') {
      return 'completed';
    }

    return 'pending';
  }

  function actionSteps(status, layoutKey) {
    const flow = getFlow(status);
    const layout = ACTION_LAYOUTS[layoutKey];
    const activeKey = phaseStep(flow, status, layout);
    const activeIndex = Math.max(layout.steps.indexOf(activeKey), 0);
    const failedKey = flow.phase === 'error' ? activeKey : '';

    return layout.steps.map((stepKey, index) => {
      let statusName = 'pending';
      if (failedKey === stepKey) {
        statusName = 'failed';
      } else if (isStepCompleted(stepKey, status, flow, layout, activeIndex, index)) {
        statusName = 'completed';
      } else if (stepKey === activeKey && flow.phase !== 'updates_complete') {
        statusName = 'running';
      }

      return {
        id: stepKey,
        key: stepKey,
        title: STEP_LABELS[stepKey],
        detail: stepDetail(stepKey, status, flow, statusName),
        status: statusName,
        complete: statusName === 'completed',
        active: statusName === 'running',
        error: statusName === 'failed'
      };
    });
  }

  function getFlowSteps(status) {
    const layoutKey = getLayoutKey(status);
    if (layoutKey) {
      return actionSteps(status, layoutKey);
    }

    return normalStatusSteps(status);
  }

  return {
    actionRequiresConfirmation,
    disabledActionReason,
    getButtonState,
    getFlowSteps,
    getFlowTitle,
    normalizeThemeChoice,
    resolveTheme
  };
});

'use strict';

const {
  actionRequiresConfirmation,
  disabledActionReason,
  getButtonState,
  getFlowSteps,
  getFlowTitle
} = window.PortalUiState;

const {
  api,
  escapeHtml,
  formatLabel,
  iconSvg,
  initTheme,
  renderIconElement,
  renderIcons,
  setStatusBadge,
  setStatusPill,
  statusTone
} = window.PortalCommon;

const appView = document.getElementById('appView');
const accountMenu = document.getElementById('accountMenu');
const userLabel = document.getElementById('userLabel');
const accountIdentity = document.getElementById('accountIdentity');
const accountProvider = document.getElementById('accountProvider');
const logoutButton = document.getElementById('logoutButton');
const headerStatusPill = document.getElementById('headerStatusPill');
const headerStatusText = document.getElementById('headerStatusText');
const overviewSummary = document.getElementById('overviewSummary');
const overviewServerState = document.getElementById('overviewServerState');
const overviewReadyState = document.getElementById('overviewReadyState');
const overviewPreparationState = document.getElementById('overviewPreparationState');
const overviewRconState = document.getElementById('overviewRconState');
const overviewPidState = document.getElementById('overviewPidState');
const overviewLastExitState = document.getElementById('overviewLastExitState');
const liveUpdateControl = document.getElementById('liveUpdateControl');
const liveUpdatesSwitch = document.getElementById('liveUpdatesSwitch');
const liveStatus = document.getElementById('liveStatus');
const flowTitle = document.getElementById('flowTitle');
const startupFlow = document.getElementById('startupFlow');
const flowSummary = document.getElementById('flowSummary');
const busyBadge = document.getElementById('busyBadge');
const actionMessage = document.getElementById('actionMessage');
const actionHelp = document.getElementById('actionHelp');
const logs = document.getElementById('logs');
const logsEmpty = document.getElementById('logsEmpty');
const pauseAutoscrollSwitch = document.getElementById('pauseAutoscrollSwitch');
const wrapLogsSwitch = document.getElementById('wrapLogsSwitch');
const logSourceFilter = document.getElementById('logSourceFilter');
const logSearch = document.getElementById('logSearch');
const copyLogsButton = document.getElementById('copyLogsButton');
const actionsPanel = document.getElementById('actionsPanel');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const restartButton = document.getElementById('restartButton');
const safeStopButton = document.getElementById('safeStopButton');
const safeRestartButton = document.getElementById('safeRestartButton');
const immediateStopButton = document.getElementById('immediateStopButton');
const immediateRestartButton = document.getElementById('immediateRestartButton');
const immediateActionGroup = document.getElementById('immediateActionGroup');
const refreshLogsButton = document.getElementById('refreshLogsButton');
const refreshActivityButton = document.getElementById('refreshActivityButton');
const activityList = document.getElementById('activityList');
const activityEmpty = document.getElementById('activityEmpty');
const actionConfirmModal = document.getElementById('actionConfirmModal');
const confirmActionTitle = document.getElementById('confirmActionTitle');
const confirmActionBody = document.getElementById('confirmActionBody');
const confirmActionButton = document.getElementById('confirmActionButton');
const confirmActionWarning = document.getElementById('confirmActionWarning');
const confirmActionMeta = document.getElementById('confirmActionMeta');
const checkUpdatesSwitch = document.getElementById('checkUpdatesSwitch');
const checkUpdatesLabel = document.getElementById('checkUpdatesLabel');
const checkUpdatesGroup = checkUpdatesSwitch ? checkUpdatesSwitch.closest('.form-check') : null;
const countdownControlGroup = document.getElementById('countdownControlGroup');
const countdownSecondsRange = document.getElementById('countdownSecondsRange');
const countdownSecondsValue = document.getElementById('countdownSecondsValue');
const toastContainer = document.getElementById('toastContainer');
const changePasswordButton = document.getElementById('changePasswordButton');
const changePasswordModal = document.getElementById('changePasswordModal');
const changePasswordForm = document.getElementById('changePasswordForm');
const changePasswordMessage = document.getElementById('changePasswordMessage');
const changePasswordCloseButton = document.getElementById('changePasswordCloseButton');
const changePasswordCancelButton = document.getElementById('changePasswordCancelButton');
const changePasswordLogoutButton = document.getElementById('changePasswordLogoutButton');
const savePasswordButton = document.getElementById('savePasswordButton');
const userManagementPanel = document.getElementById('userManagementPanel');
const userManagementTabItem = document.getElementById('userManagementTabItem');
const userManagementTabButton = document.getElementById('userManagementTabButton');
const createUserButton = document.getElementById('createUserButton');
const usersTable = document.getElementById('usersTable');
const usersEmpty = document.getElementById('usersEmpty');
const createUserModal = document.getElementById('createUserModal');
const createUserForm = document.getElementById('createUserForm');
const createUserMessage = document.getElementById('createUserMessage');
const createUserSubmitButton = document.getElementById('createUserSubmitButton');
const initialPasswordModal = document.getElementById('initialPasswordModal');
const initialPasswordIntro = document.getElementById('initialPasswordIntro');
const initialPasswordCode = document.getElementById('initialPasswordCode');
const copyInitialPasswordButton = document.getElementById('copyInitialPasswordButton');
const editUserRoleModal = document.getElementById('editUserRoleModal');
const editUserRoleForm = document.getElementById('editUserRoleForm');
const editUserId = document.getElementById('editUserId');
const editUserRole = document.getElementById('editUserRole');
const editUserRoleIntro = document.getElementById('editUserRoleIntro');
const editUserRoleMessage = document.getElementById('editUserRoleMessage');
const saveUserRoleButton = document.getElementById('saveUserRoleButton');
const deleteUserModal = document.getElementById('deleteUserModal');
const deleteUserBody = document.getElementById('deleteUserBody');
const deleteUserMessage = document.getElementById('deleteUserMessage');
const confirmDeleteUserButton = document.getElementById('confirmDeleteUserButton');
const logsTabButton = document.getElementById('logsTabButton');
const serverStatusPanel = document.getElementById('serverStatusPanel');
const serverStatusTabItem = document.getElementById('serverStatusTabItem');
const serverStatusTabButton = document.getElementById('serverStatusTabButton');
const serverStatusSummary = document.getElementById('serverStatusSummary');
const serverStatusUpdatedAt = document.getElementById('serverStatusUpdatedAt');
const refreshServerStatusButton = document.getElementById('refreshServerStatusButton');
const rconPlayersOnline = document.getElementById('rconPlayersOnline');
const rconPlayerCountLabel = document.getElementById('rconPlayerCountLabel');
const rconPlayerList = document.getElementById('rconPlayerList');
const rconPlayersEmpty = document.getElementById('rconPlayersEmpty');
const rconZombiesTotal = document.getElementById('rconZombiesTotal');
const rconZombiesKilledToday = document.getElementById('rconZombiesKilledToday');
const rconFps = document.getElementById('rconFps');
const rconFpsCard = document.getElementById('rconFpsCard');
const rconFpsTone = document.getElementById('rconFpsTone');
const rconFpsBar = document.getElementById('rconFpsBar');
const rconFpsNote = document.getElementById('rconFpsNote');
const rconMemory = document.getElementById('rconMemory');
const rconMemoryCard = document.getElementById('rconMemoryCard');
const rconMemoryTone = document.getElementById('rconMemoryTone');
const rconMemoryGauge = document.getElementById('rconMemoryGauge');
const rconMemoryPercent = document.getElementById('rconMemoryPercent');
const rconMemoryFree = document.getElementById('rconMemoryFree');
const rconNetwork = document.getElementById('rconNetwork');
const rconNetworkCard = document.getElementById('rconNetworkCard');
const rconNetworkTone = document.getElementById('rconNetworkTone');
const rconNetworkSentBar = document.getElementById('rconNetworkSentBar');
const rconNetworkSentValue = document.getElementById('rconNetworkSentValue');
const rconNetworkReceivedBar = document.getElementById('rconNetworkReceivedBar');
const rconNetworkReceivedValue = document.getElementById('rconNetworkReceivedValue');
const rconPacketLoss = document.getElementById('rconPacketLoss');
const serverStatusMessage = document.getElementById('serverStatusMessage');
const rconStatusSections = document.getElementById('rconStatusSections');
const rconStatusEmpty = document.getElementById('rconStatusEmpty');
const activityTabButton = document.getElementById('activityTabButton');
const rconTerminalPanel = document.getElementById('rconTerminalPanel');
const rconTabItem = document.getElementById('rconTabItem');
const rconTabButton = document.getElementById('rconTabButton');
const rconTerminalSummary = document.getElementById('rconTerminalSummary');
const terminalPanelForm = document.getElementById('terminalPanelForm');
const terminalPanelInput = document.getElementById('terminalPanelInput');
const terminalPanelSubmit = document.getElementById('terminalPanelSubmit');
const terminalPanelOutput = document.getElementById('terminalPanelOutput');
const terminalPanelEmpty = document.getElementById('terminalPanelEmpty');
const terminalLauncherButton = document.getElementById('terminalLauncherButton');
const terminalModeOverlay = document.getElementById('terminalModeOverlay');
const terminalDrawer = document.getElementById('terminalDrawer');
const terminalDrawerCloseButton = document.getElementById('terminalDrawerCloseButton');
const terminalDrawerForm = document.getElementById('terminalDrawerForm');
const terminalDrawerInput = document.getElementById('terminalDrawerInput');
const terminalDrawerSubmit = document.getElementById('terminalDrawerSubmit');
const terminalDrawerOutput = document.getElementById('terminalDrawerOutput');
const terminalDrawerEmpty = document.getElementById('terminalDrawerEmpty');
const operationTabButtons = [
  logsTabButton,
  serverStatusTabButton,
  rconTabButton,
  activityTabButton,
  userManagementTabButton
].filter(Boolean);

const TRANSITIONAL_SERVER_STATES = new Set(['starting', 'stopping']);
const ROLE_RANK = { read_only: 0, admin: 1, operator: 2 };
const MAX_LOGS = 800;
const POLL_MS = 5000;
const DEFAULT_SAFE_COUNTDOWN_SECONDS = 300;
const RCON_STATUS_SECTION_ORDER = ['performance', 'game', 'connection', 'network'];
const keyedToasts = new Map();

const actionButtonConfigs = [
  { action: 'start', stateKey: 'start', button: startButton },
  { action: 'safe_stop', stateKey: 'safeStop', button: safeStopButton },
  { action: 'safe_restart', stateKey: 'safeRestart', button: safeRestartButton },
  { action: 'stop', stateKey: 'stop', button: stopButton },
  { action: 'restart', stateKey: 'restart', button: restartButton },
  { action: 'stop', stateKey: 'immediateStop', reasonAction: 'immediate_stop', button: immediateStopButton },
  { action: 'restart', stateKey: 'immediateRestart', reasonAction: 'immediate_restart', button: immediateRestartButton }
];
const actionButtons = actionButtonConfigs.map((config) => config.button).filter(Boolean);

let currentAuth = null;
let currentUser = null;
let currentStatus = null;
let countdownSnapshot = null;
let pzDataSource = null;
let pollInFlight = false;
let pendingConfirmedAction = null;
let pendingAction = '';
let confirmModal = null;
let passwordModal = null;
let createUserModalInstance = null;
let initialPasswordModalInstance = null;
let editUserRoleModalInstance = null;
let deleteUserModalInstance = null;
let forcingPasswordChange = false;
let pendingDeleteUserId = null;
let lastInitialPassword = '';
let allLogs = [];
let rconStatusInFlight = false;
let terminalEntries = [];
let terminalSubmitting = false;
let terminalRecallIndex = null;
let terminalRecallDraft = '';
let terminalDrawerOpen = false;
let terminalScrollFrame = null;

function pzLiveUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/server/live`;
}

function normalizePzLivePayload(payload) {
  if (!payload || typeof payload.type !== 'string') {
    throw new Error('Malformed live update payload.');
  }

  if (payload.type === 'connected') {
    return [];
  }

  if (payload.type === 'log') {
    return [{
      type: 'logs',
      mode: 'append',
      entries: payload.entry ? [payload.entry] : []
    }];
  }

  if (payload.type === 'logs') {
    return [{
      type: 'logs',
      mode: payload.mode || (payload.replace ? 'replace' : 'append'),
      entries: Array.isArray(payload.entries) ? payload.entries : []
    }];
  }

  if (payload.type === 'status') {
    return [{ type: 'status', status: payload.status }];
  }

  if (payload.type === 'toast') {
    return [{ type: 'toast', toast: payload.toast }];
  }

  if (payload.type === 'action') {
    return [{
      type: 'action',
      action: payload.action,
      status: payload.status,
      message: payload.message
    }];
  }

  return [];
}

class ApiPzDataSource {
  constructor(emit) {
    this.emit = emit;
    this.kind = 'api';
    this.running = false;
  }

  async start(options = {}) {
    this.running = true;
    this.emit(options.connection || {
      type: 'connection',
      text: 'Manual refresh',
      state: '',
      live: false
    });

    if (options.refresh !== false) {
      await this.refreshAll();
    }
  }

  stop() {
    this.running = false;
  }

  async refreshStatus() {
    const status = await api('/api/server/status');
    if (this.running) {
      this.emit({ type: 'status', status });
    }
    return status;
  }

  async refreshLogs() {
    const payload = await api('/api/server/logs?limit=400');
    const entries = payload.logs || [];
    if (this.running) {
      this.emit({ type: 'logs', mode: 'replace', entries });
    }
    return entries;
  }

  async refreshAll() {
    await this.refreshStatus();
    await this.refreshLogs();
  }
}

class WebSocketPzDataSource {
  constructor(emit) {
    this.emit = emit;
    this.kind = 'websocket';
    this.running = false;
    this.socket = null;
  }

  async start() {
    this.running = true;
    this.emit({
      type: 'connection',
      text: 'Connecting...',
      state: 'status-warning',
      live: true
    });

    return new Promise((resolve, reject) => {
      let settled = false;

      const rejectStart = (error) => {
        if (settled) {
          return;
        }
        settled = true;
        this.running = false;
        this.socket = null;
        this.emit({
          type: 'connection',
          text: 'Connection error',
          state: 'status-danger',
          live: false
        });
        reject(error);
      };

      try {
        const socket = new WebSocket(pzLiveUrl());
        this.socket = socket;

        socket.addEventListener('open', () => {
          if (!this.running) {
            return;
          }
          settled = true;
          this.emit({
            type: 'connection',
            text: 'Live',
            state: 'live status-success',
            live: true
          });
          resolve();
        });

        socket.addEventListener('message', (event) => {
          this.handleRawMessage(event);
        });

        socket.addEventListener('close', () => {
          const shouldFallback = this.running;
          this.running = false;
          this.socket = null;
          if (!settled) {
            rejectStart(new Error('Live update connection closed.'));
            return;
          }
          if (shouldFallback) {
            this.emit({
              type: 'connection',
              text: 'Disconnected; manual refresh',
              state: 'status-warning',
              live: false,
              fallback: true
            });
          }
        });

        socket.addEventListener('error', () => {
          if (!settled) {
            rejectStart(new Error('Unable to open live updates.'));
            return;
          }
          if (this.running) {
            this.running = false;
            this.emit({
              type: 'connection',
              text: 'Connection error',
              state: 'status-danger',
              live: false,
              fallback: true
            });
            socket.close();
          }
        });
      } catch (error) {
        rejectStart(error);
      }
    });
  }

  stop() {
    this.running = false;
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState < WebSocket.CLOSING) {
      socket.close();
    }
  }

  handleRawMessage(event) {
    if (!this.running) {
      return;
    }

    try {
      for (const update of normalizePzLivePayload(JSON.parse(event.data))) {
        this.emit(update);
      }
    } catch (error) {
      this.running = false;
      this.emit({
        type: 'toast',
        toast: {
          title: 'Live updates',
          message: error.message || 'Received a malformed live update.',
          variant: 'warning'
        }
      });
      this.emit({
        type: 'connection',
        text: 'Connection error',
        state: 'status-danger',
        live: false,
        fallback: true
      });
      this.stop();
    }
  }
}

const TOAST_VARIANTS = [
  'primary',
  'secondary',
  'success',
  'danger',
  'warning',
  'info',
  'light',
  'dark'
];

function toastMarkup(title, message, variant) {
  const closeClass = variant === 'warning' || variant === 'light' ? 'btn-close' : 'btn-close btn-close-white';
  return `
    <div class="d-flex">
      <div class="toast-body">
        <strong>${escapeHtml(title)}</strong>
        ${message ? `<div>${escapeHtml(message)}</div>` : ''}
      </div>
      <button type="button" class="${closeClass} me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;
}

function applyToastVariant(toast, variant) {
  for (const candidate of TOAST_VARIANTS) {
    toast.classList.remove(`text-bg-${candidate}`);
  }
  toast.classList.add(`text-bg-${variant}`);
  toast.setAttribute('role', variant === 'danger' ? 'alert' : 'status');
  toast.setAttribute('aria-live', variant === 'danger' ? 'assertive' : 'polite');
}

function showToast(title, message, variant = 'primary', options = {}) {
  if (!toastContainer || !window.bootstrap?.Toast) {
    actionMessage.textContent = message || title;
    return;
  }

  const toastId = options.id || '';
  const existing = toastId ? keyedToasts.get(toastId) : null;
  if (existing?.toast?.isConnected) {
    applyToastVariant(existing.toast, variant);
    existing.toast.innerHTML = toastMarkup(title, message, variant);
    existing.instance.show();
    return;
  }

  if (toastId) {
    keyedToasts.delete(toastId);
  }

  const toast = document.createElement('div');
  toast.className = 'toast border-0';
  applyToastVariant(toast, variant);
  toast.setAttribute('aria-atomic', 'true');
  toast.innerHTML = toastMarkup(title, message, variant);
  toastContainer.append(toast);

  const instance = new window.bootstrap.Toast(toast, {
    delay: options.delayMs || (variant === 'danger' ? 9000 : 5000)
  });
  if (toastId) {
    keyedToasts.set(toastId, { toast, instance });
  }
  toast.addEventListener('hidden.bs.toast', () => {
    toast.remove();
    if (toastId && keyedToasts.get(toastId)?.toast === toast) {
      keyedToasts.delete(toastId);
    }
  });
  instance.show();
}

function currentRole() {
  return currentUser?.role || 'read_only';
}

function canRole(role) {
  return (ROLE_RANK[currentRole()] ?? 0) >= (ROLE_RANK[role] ?? 0);
}

function isOperator() {
  return canRole('operator');
}

function formatLowerLabel(value) {
  return formatLabel(value).toLowerCase();
}

function formatCountdownDuration(seconds) {
  if (seconds >= 60 && seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  return seconds === 1 ? '1 second' : `${seconds} seconds`;
}

function countdownTarget(status) {
  const action = status?.activeAction?.action || '';
  const kind = status?.flow?.kind || '';
  return action === 'safe_restart' || kind === 'safe_restart' ? 'restart' : 'stop';
}

function formatStepDetail(value) {
  const detail = String(value || '');
  return /\s/.test(detail) ? detail : formatLabel(detail);
}

function formatTime(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatDateTime(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function setHeaderStatus(serverState) {
  const normalized = serverState || 'unknown';
  setStatusPill(headerStatusPill, headerStatusText, normalized);
}

function formatLastExit(server) {
  if (!server?.lastExitAt) {
    return 'None';
  }
  const code = server.lastExitCode ?? 'n/a';
  const signal = server.lastExitSignal ? `, ${server.lastExitSignal}` : '';
  return `Code ${code}${signal} at ${formatDateTime(server.lastExitAt)}`;
}

function renderOverview(status) {
  const serverState = status?.server?.state || 'unknown';
  const preparationState = status?.preparation?.state || 'unknown';
  const ready = Boolean(status?.server?.ready);
  const activeAction = status?.activeAction?.action;

  setHeaderStatus(activeAction ? serverState : serverState);

  if (activeAction) {
    overviewSummary.textContent = `${formatLabel(activeAction)} is running. ${status.flow?.detail || ''}`.trim();
  } else if (ready) {
    overviewSummary.textContent = 'Server is ready for players.';
  } else if (status?.preparation?.state === 'error') {
    overviewSummary.textContent = status.preparation.error || 'Preparation failed.';
  } else {
    overviewSummary.textContent = `Server is ${formatLowerLabel(serverState)}.`;
  }

  setStatusBadge(
    overviewServerState,
    formatLabel(serverState),
    statusTone(serverState),
    serverState
  );
  setStatusBadge(
    overviewReadyState,
    ready ? 'Ready' : 'Not Ready',
    ready ? 'success' : serverState === 'running' ? 'warning' : 'secondary',
    ready ? 'ready' : 'not-ready'
  );
  setStatusBadge(
    overviewPreparationState,
    formatLabel(preparationState),
    statusTone(preparationState === 'running' ? 'running-prep' : preparationState),
    preparationState
  );
  setStatusBadge(
    overviewRconState,
    status?.capabilities?.rcon ? 'Enabled' : 'Disabled',
    status?.capabilities?.rcon ? 'success' : 'secondary',
    status?.capabilities?.rcon ? 'enabled' : 'disabled'
  );
  overviewPidState.textContent = status?.server?.pid ? String(status.server.pid) : 'None';
  overviewLastExitState.textContent = formatLastExit(status?.server);
}

function markerContent(step) {
  if (step.status === 'running' || step.active) {
    return '<span class="spinner-border spinner-border-sm" aria-label="In progress"></span>';
  }

  if (step.status === 'completed' || step.complete) {
    return iconSvg('check');
  }

  if (step.status === 'failed' || step.error) {
    return iconSvg('alert-triangle');
  }

  return iconSvg('circle');
}

function countdownProgress(status, step) {
  if (step.id !== 'alertPlayers' || step.status !== 'running') {
    return '';
  }
  const remaining = Number(status?.flow?.countdownRemainingSeconds);
  if (!Number.isFinite(remaining)) {
    return '';
  }
  const total = Number(status?.flow?.countdownTotalSeconds);
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 60;
  const clampedRemaining = Math.max(0, Math.min(remaining, safeTotal));
  const width = Math.max(0, Math.min(100, 100 - (clampedRemaining / safeTotal) * 100));
  return `
    <div class="flow-progress" aria-hidden="true">
      <div class="flow-progress-bar" style="--flow-progress: ${width}%"></div>
    </div>
  `;
}

function renderStartupFlow(status) {
  const steps = getFlowSteps(status);
  flowTitle.textContent = getFlowTitle(status);
  startupFlow.innerHTML = steps
    .map((step) => {
      const markerClass = [
        'flow-marker',
        step.status || '',
        step.complete ? 'completed' : '',
        step.error ? 'error' : ''
      ].filter(Boolean).join(' ');
      const stepClass = [
        'flow-step',
        step.status || ''
      ].filter(Boolean).join(' ');

      return `
        <div class="${stepClass}">
          <div class="${markerClass}">${markerContent(step)}</div>
          <div class="flow-content">
            <div class="flow-title">${escapeHtml(step.title)}</div>
            <div class="flow-detail">${escapeHtml(formatStepDetail(step.detail))}</div>
            ${countdownProgress(status, step)}
          </div>
        </div>
      `;
    })
    .join('');
}

function setButtonLoading(button, loading) {
  if (!button) {
    return;
  }
  button.classList.toggle('is-loading', loading);
  const spinner = button.querySelector('.action-spinner');
  if (spinner) {
    spinner.classList.toggle('hidden', !loading);
  }
}

function setActionControl(config, enabled, reason, loadingAction) {
  const { button, action, reasonAction } = config;
  if (!button) {
    return;
  }
  const loading = loadingAction === action;
  button.disabled = !enabled || Boolean(loadingAction);
  button.title = !enabled && reason ? reason : '';
  button.setAttribute('aria-disabled', button.disabled ? 'true' : 'false');
  button.dataset.disabledReason = reason || '';
  setButtonLoading(button, loading);
  if (reasonAction) {
    button.dataset.reasonAction = reasonAction;
  }
}

function setActionButtonsDisabled(disabled) {
  for (const button of actionButtons) {
    if (button) {
      button.disabled = disabled;
      button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    }
  }
}

function toggleActionMode(rconEnabled) {
  document.querySelectorAll('.rcon-action').forEach((element) => {
    element.classList.toggle('hidden', !rconEnabled);
  });
  document.querySelectorAll('.direct-action').forEach((element) => {
    element.classList.toggle('hidden', rconEnabled);
  });
}

function describeActiveAction(activeAction) {
  if (!activeAction) {
    return '';
  }
  const who = activeAction.username ? ` by ${activeAction.username}` : '';
  const since = activeAction.startedAt ? ` since ${formatDateTime(activeAction.startedAt)}` : '';
  return `${formatLabel(activeAction.action)}${who}${since}`;
}

function renderControls(status) {
  if (!canRole('admin')) {
    setActionButtonsDisabled(true);
    actionHelp.textContent = 'Your account is read-only.';
    return;
  }

  const buttonState = getButtonState(status);
  const loadingAction = status?.activeAction?.action || pendingAction;
  toggleActionMode(buttonState.rconEnabled);

  for (const config of actionButtonConfigs) {
    const reason = disabledActionReason(status, config.reasonAction || config.action);
    setActionControl(config, buttonState[config.stateKey], reason, loadingAction);
  }

  if (status?.activeAction) {
    actionHelp.textContent = `${describeActiveAction(status.activeAction)} is in progress. Other actions are locked.`;
    return;
  }

  if (buttonState.rconEnabled) {
    actionHelp.textContent = 'Safe actions warn players over RCON before shutdown. Immediate actions stay separated below.';
    return;
  }

  const firstDisabled = actionButtonConfigs.find((config) => {
    if (!config.button || config.button.closest('.hidden') || config.button.classList.contains('hidden')) {
      return false;
    }
    return !buttonState[config.stateKey] && disabledActionReason(status, config.reasonAction || config.action);
  });
  actionHelp.textContent = firstDisabled
    ? disabledActionReason(status, firstDisabled.reasonAction || firstDisabled.action)
    : 'Direct controls are available because RCON safe actions are not enabled.';
}

function renderBusy(status) {
  if (status.activeAction) {
    busyBadge.textContent = `${describeActiveAction(status.activeAction)} running`;
    busyBadge.classList.remove('hidden');
    return;
  }

  busyBadge.textContent = '';
  busyBadge.classList.add('hidden');
}

function renderSummary(status) {
  if (status.flow?.detail) {
    flowSummary.textContent = status.flow.detail;
    return;
  }

  if (status.preparation.state === 'error') {
    flowSummary.textContent = status.preparation.error || 'Preparation failed.';
    return;
  }

  if (status.activeAction) {
    flowSummary.textContent = `${formatLabel(status.activeAction.action)} is in progress.`;
    return;
  }

  if (status.server.ready) {
    flowSummary.textContent = 'Server is ready for players.';
    return;
  }

  if (status.server.state === 'starting') {
    flowSummary.textContent = 'Server is starting.';
    return;
  }

  if (status.server.state === 'stopping') {
    flowSummary.textContent = 'Shutdown pending; waiting for the server process to fully stop.';
    return;
  }

  flowSummary.textContent = `Server is ${formatLabel(status.server.state).toLowerCase()}.`;
}

function captureCountdownSnapshot(status) {
  const remaining = Number(status?.flow?.countdownRemainingSeconds);
  const total = Number(status?.flow?.countdownTotalSeconds);

  if (status?.flow?.phase === 'countdown' && Number.isFinite(remaining) && remaining > 0) {
    countdownSnapshot = {
      receivedAtMs: Date.now(),
      remaining,
      total: Number.isFinite(total) && total > 0 ? total : Math.max(remaining, 60)
    };
    return;
  }

  countdownSnapshot = null;
}

function getOperationTabPane(button) {
  const target = button?.getAttribute('data-bs-target');
  return target ? document.querySelector(target) : null;
}

function setOperationTabAvailable(tabItem, tabButton, tabPane, available) {
  tabItem?.classList.toggle('hidden', !available);
  tabPane?.classList.toggle('hidden', !available);

  if (tabButton) {
    tabButton.disabled = !available;
    tabButton.setAttribute('aria-hidden', available ? 'false' : 'true');
  }

  if (tabPane) {
    tabPane.setAttribute('aria-hidden', available ? 'false' : 'true');
  }
}

function isOperationTabAvailable(button) {
  if (!button || button.disabled) {
    return false;
  }

  const tabItem = button.closest('.nav-item');
  const tabPane = getOperationTabPane(button);
  return !tabItem?.classList.contains('hidden') && !tabPane?.classList.contains('hidden');
}

function activateOperationTab(button) {
  if (!button) {
    return;
  }

  const Tab = window.bootstrap?.Tab;
  if (Tab) {
    const instance = Tab.getOrCreateInstance ? Tab.getOrCreateInstance(button) : new Tab(button);
    instance.show();
    if (button === rconTabButton) {
      scheduleTerminalScrollToBottom();
    }
    return;
  }

  for (const tabButton of operationTabButtons) {
    const active = tabButton === button;
    const tabPane = getOperationTabPane(tabButton);
    tabButton.classList.toggle('active', active);
    tabButton.setAttribute('aria-selected', active ? 'true' : 'false');
    tabPane?.classList.toggle('show', active);
    tabPane?.classList.toggle('active', active);
  }

  if (button === rconTabButton) {
    scheduleTerminalScrollToBottom();
  }
}

function ensureVisibleOperationTab() {
  const activeButton = operationTabButtons.find((button) => button.classList.contains('active'));
  if (isOperationTabAvailable(activeButton)) {
    return;
  }

  activateOperationTab(operationTabButtons.find(isOperationTabAvailable));
}

function terminalViews() {
  return [
    {
      form: terminalPanelForm,
      input: terminalPanelInput,
      submit: terminalPanelSubmit,
      output: terminalPanelOutput,
      empty: terminalPanelEmpty
    },
    {
      form: terminalDrawerForm,
      input: terminalDrawerInput,
      submit: terminalDrawerSubmit,
      output: terminalDrawerOutput,
      empty: terminalDrawerEmpty
    }
  ].filter((view) => view.form && view.input && view.submit && view.output && view.empty);
}

function scrollTerminalViewsToBottom() {
  for (const view of terminalViews()) {
    view.output.scrollTop = view.output.scrollHeight;
  }
}

function scheduleTerminalScrollToBottom() {
  scrollTerminalViewsToBottom();

  const requestFrame = window.requestAnimationFrame
    ? window.requestAnimationFrame.bind(window)
    : (callback) => window.setTimeout(callback, 0);
  if (terminalScrollFrame !== null && window.cancelAnimationFrame) {
    window.cancelAnimationFrame(terminalScrollFrame);
  }

  terminalScrollFrame = requestFrame(() => {
    scrollTerminalViewsToBottom();
    terminalScrollFrame = requestFrame(() => {
      scrollTerminalViewsToBottom();
      terminalScrollFrame = null;
    });
  });
}

function setTerminalDisabled(disabled) {
  for (const view of terminalViews()) {
    view.input.disabled = disabled;
    view.submit.disabled = disabled || terminalSubmitting;
  }
}

function renderRoleGates() {
  const admin = canRole('admin');
  const operator = isOperator();
  actionsPanel?.classList.toggle('hidden', !admin);
  setOperationTabAvailable(serverStatusTabItem, serverStatusTabButton, serverStatusPanel, admin);
  setOperationTabAvailable(rconTabItem, rconTabButton, rconTerminalPanel, operator);
  terminalLauncherButton?.classList.toggle('hidden', !operator);
  if (!operator) {
    closeTerminalDrawer();
  }
  setOperationTabAvailable(
    userManagementTabItem,
    userManagementTabButton,
    userManagementPanel,
    operator && currentAuth?.local
  );
  ensureVisibleOperationTab();
}

function renderRconAvailability(status) {
  if (!rconTerminalPanel || !isOperator()) {
    setTerminalDisabled(true);
    return;
  }

  const enabled = Boolean(status?.capabilities?.rcon);
  setTerminalDisabled(false);
  rconTerminalSummary.textContent = enabled
    ? 'Portal terminal ready.'
    : 'Portal terminal ready. RCON offline.';
}

function formatRconNumber(value, options = {}) {
  if (!Number.isFinite(value)) {
    return 'Unknown';
  }

  return value.toLocaleString([], {
    maximumFractionDigits: options.maximumFractionDigits ?? (Number.isInteger(value) ? 0 : 1)
  });
}

function setRconMetric(element, value, options = {}) {
  if (element) {
    element.textContent = formatRconNumber(value, options);
  }
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.max(min, Math.min(max, value));
}

function percentOf(value, max) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
    return null;
  }
  return clampNumber((value / max) * 100, 0, 100);
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${Math.round(value)}%` : '--%';
}

function formatRate(value) {
  if (!Number.isFinite(value)) {
    return 'Unknown';
  }

  const abs = Math.abs(value);
  if (abs >= 1024 * 1024) {
    return `${formatRconNumber(value / (1024 * 1024), { maximumFractionDigits: 1 })} MB/s`;
  }
  if (abs >= 1024) {
    return `${formatRconNumber(value / 1024, { maximumFractionDigits: 1 })} KB/s`;
  }
  return `${formatRconNumber(value, { maximumFractionDigits: 1 })} B/s`;
}

function memoryTone(percent) {
  if (!Number.isFinite(percent)) {
    return { tone: 'unknown', label: 'Unknown' };
  }
  if (percent >= 85) {
    return { tone: 'danger', label: 'Critical' };
  }
  if (percent >= 65) {
    return { tone: 'warning', label: 'Watch' };
  }
  return { tone: 'success', label: 'Healthy' };
}

function fpsTone(value) {
  if (!Number.isFinite(value)) {
    return { tone: 'unknown', label: 'Unknown', note: 'Waiting for simulation metrics.' };
  }
  if (value < 30) {
    return { tone: 'danger', label: 'Strained', note: 'Server simulation is below the comfort band.' };
  }
  if (value < 55) {
    return { tone: 'warning', label: 'Watch', note: 'Simulation is usable but worth watching.' };
  }
  return { tone: 'success', label: 'Stable', note: 'Simulation frame rate looks healthy.' };
}

function packetLossTone(value) {
  if (!Number.isFinite(value)) {
    return { tone: 'unknown', label: 'Unknown' };
  }
  if (value > 5) {
    return { tone: 'danger', label: 'Loss high' };
  }
  if (value > 0) {
    return { tone: 'warning', label: 'Loss seen' };
  }
  return { tone: 'success', label: 'Clear' };
}

function setTone(card, pill, state) {
  const tone = state?.tone || 'unknown';
  if (card) {
    card.classList.remove('tone-success', 'tone-warning', 'tone-danger', 'tone-unknown');
    card.classList.add(`tone-${tone}`);
  }
  if (pill) {
    pill.className = `rcon-health-pill tone-${tone}`;
    pill.textContent = state?.label || 'Unknown';
  }
}

function setMeter(element, percent) {
  if (element) {
    element.style.setProperty('--meter-value', `${Number.isFinite(percent) ? clampNumber(percent, 0, 100) : 0}%`);
  }
}

function formatRconNetwork(summary = {}) {
  const sent = summary.sentBps;
  const received = summary.receivedBps;
  if (Number.isFinite(sent) && Number.isFinite(received)) {
    return `${formatRate(sent)} sent / ${formatRate(received)} received`;
  }
  return 'Unknown';
}

function renderMemoryVisual(summary = {}) {
  const used = summary.memoryUsed;
  const max = summary.memoryMax;
  const percent = percentOf(used, max);
  const tone = memoryTone(percent);
  setTone(rconMemoryCard, rconMemoryTone, tone);

  if (rconMemoryGauge) {
    rconMemoryGauge.style.setProperty('--gauge-value', `${Number.isFinite(percent) ? percent : 0}%`);
    rconMemoryGauge.setAttribute('aria-valuenow', Number.isFinite(percent) ? String(Math.round(percent)) : '0');
    rconMemoryGauge.setAttribute(
      'aria-valuetext',
      Number.isFinite(percent) ? `${Math.round(percent)} percent memory used` : 'Memory usage unknown'
    );
  }
  if (rconMemoryPercent) {
    rconMemoryPercent.textContent = formatPercent(percent);
  }
  if (rconMemory) {
    rconMemory.textContent = Number.isFinite(used) && Number.isFinite(max)
      ? `${formatRconNumber(used)} / ${formatRconNumber(max)} MB`
      : Number.isFinite(used) ? `${formatRconNumber(used)} MB used` : 'Unknown';
  }
  if (rconMemoryFree) {
    const headroom = Number.isFinite(used) && Number.isFinite(max) ? Math.max(0, max - used) : null;
    rconMemoryFree.textContent = Number.isFinite(headroom)
      ? `${formatRconNumber(headroom)} MB headroom before the configured max.`
      : 'Waiting for memory metrics.';
  }
}

function renderFpsVisual(summary = {}) {
  const fps = summary.fps;
  const state = fpsTone(fps);
  setTone(rconFpsCard, rconFpsTone, state);
  if (rconFps) {
    rconFps.textContent = Number.isFinite(fps) ? formatRconNumber(fps, { maximumFractionDigits: 1 }) : 'Unknown';
  }
  setMeter(rconFpsBar, Number.isFinite(fps) ? percentOf(fps, 120) : 0);
  if (rconFpsNote) {
    rconFpsNote.textContent = state.note;
  }
}

function renderNetworkVisual(summary = {}) {
  const sent = summary.sentBps;
  const received = summary.receivedBps;
  const loss = summary.packetLossLastSecond;
  const state = packetLossTone(loss);
  const maxTraffic = Math.max(
    Number.isFinite(sent) ? sent : 0,
    Number.isFinite(received) ? received : 0,
    1
  );

  setTone(rconNetworkCard, rconNetworkTone, state);
  if (rconNetwork) {
    rconNetwork.textContent = formatRconNetwork(summary);
  }
  if (rconNetworkSentValue) {
    rconNetworkSentValue.textContent = formatRate(sent);
  }
  if (rconNetworkReceivedValue) {
    rconNetworkReceivedValue.textContent = formatRate(received);
  }
  setMeter(rconNetworkSentBar, Number.isFinite(sent) ? percentOf(sent, maxTraffic) : 0);
  setMeter(rconNetworkReceivedBar, Number.isFinite(received) ? percentOf(received, maxTraffic) : 0);
  if (rconPacketLoss) {
    rconPacketLoss.textContent = Number.isFinite(loss)
      ? `${formatRconNumber(loss, { maximumFractionDigits: 2 })}% packet loss last second.`
      : 'Packet loss unknown.';
  }
}

function renderPlayerRoster(summary = {}) {
  if (!rconPlayerList || !rconPlayersEmpty || !rconPlayerCountLabel) {
    return;
  }

  const players = Array.isArray(summary.players) ? summary.players : [];
  rconPlayerList.replaceChildren();
  rconPlayersEmpty.classList.toggle('hidden', players.length > 0);
  rconPlayerCountLabel.textContent = Number.isFinite(summary.playersOnline)
    ? `${summary.playersOnline} online`
    : 'Unknown';

  const fragment = document.createDocumentFragment();
  for (const player of players) {
    const item = document.createElement('span');
    item.className = 'rcon-player-chip';
    item.textContent = player;
    fragment.append(item);
  }

  rconPlayerList.append(fragment);
}

function setRconStatusLoading(loading) {
  rconStatusInFlight = loading;
  if (refreshServerStatusButton) {
    refreshServerStatusButton.disabled = loading;
    refreshServerStatusButton.setAttribute('aria-disabled', loading ? 'true' : 'false');
  }
}

function renderRconStatusSections(sections = []) {
  if (!rconStatusSections || !rconStatusEmpty) {
    return;
  }

  const openSectionIds = new Set(
    Array.from(rconStatusSections.querySelectorAll('.rcon-status-section[open]'))
      .map((section) => section.dataset.sectionId)
      .filter(Boolean)
  );
  rconStatusSections.replaceChildren();
  const ordered = [...sections].sort((left, right) => {
    const leftIndex = RCON_STATUS_SECTION_ORDER.indexOf(left.id);
    const rightIndex = RCON_STATUS_SECTION_ORDER.indexOf(right.id);
    return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
  });
  const visibleSections = ordered.filter((section) => Array.isArray(section.metrics) && section.metrics.length > 0);
  rconStatusEmpty.classList.toggle('hidden', visibleSections.length > 0);

  const fragment = document.createDocumentFragment();
  for (const section of visibleSections) {
    const details = document.createElement('details');
    details.className = 'rcon-status-section';
    details.dataset.sectionId = section.id || '';
    details.open = openSectionIds.has(section.id);

    const summary = document.createElement('summary');
    summary.className = 'rcon-status-section-title';
    const title = document.createElement('span');
    title.className = 'rcon-status-section-name';
    title.textContent = section.title || formatLabel(section.id);
    const count = document.createElement('span');
    count.className = 'rcon-status-section-count';
    count.textContent = `${section.metrics.length} metrics`;
    summary.append(title, count);
    details.append(summary);

    const list = document.createElement('div');
    list.className = 'rcon-status-metrics';
    for (const metric of section.metrics) {
      const row = document.createElement('div');
      row.className = 'rcon-status-metric';

      const name = document.createElement('span');
      name.className = 'rcon-status-metric-name';
      name.textContent = metric.label || formatLabel(metric.key);

      const value = document.createElement('span');
      value.className = 'rcon-status-metric-value';
      value.textContent = Number.isFinite(metric.value)
        ? formatRconNumber(metric.value, { maximumFractionDigits: 2 })
        : metric.raw || 'Unknown';

      row.append(name, value);
      list.append(row);
    }

    details.append(list);
    fragment.append(details);
  }

  rconStatusSections.append(fragment);
}

function renderRconStatus(payload) {
  const summary = payload?.summary || {};
  const available = Boolean(payload?.available);
  const stale = Boolean(payload?.stale);

  setRconMetric(rconPlayersOnline, summary.playersOnline);
  setRconMetric(rconZombiesTotal, summary.zombiesTotal);
  setRconMetric(rconZombiesKilledToday, summary.zombiesKilledToday);
  renderMemoryVisual(summary);
  renderFpsVisual(summary);
  renderNetworkVisual(summary);
  renderPlayerRoster(summary);

  if (serverStatusUpdatedAt) {
    serverStatusUpdatedAt.textContent = payload?.updatedAt
      ? `${stale ? 'Last known' : 'Updated'} ${formatDateTime(payload.updatedAt)}`
      : 'Not updated';
  }

  if (serverStatusSummary) {
    serverStatusSummary.textContent = available
      ? stale ? 'Showing last known RCON metrics.' : 'RCON metrics are current.'
      : 'RCON status is unavailable.';
  }

  if (serverStatusMessage) {
    serverStatusMessage.textContent = payload?.error || '';
    serverStatusMessage.classList.toggle('error', Boolean(payload?.error));
  }

  renderRconStatusSections(payload?.sections || []);
}

function renderRconStatusUnavailable(message) {
  renderRconStatus({
    available: false,
    refreshing: false,
    stale: false,
    updatedAt: null,
    error: message,
    summary: {},
    sections: []
  });
}

function adjustedCountdownStatus(status) {
  if (!status || !countdownSnapshot || status.flow?.phase !== 'countdown') {
    return status;
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - countdownSnapshot.receivedAtMs) / 1000));
  const remaining = Math.max(0, countdownSnapshot.remaining - elapsedSeconds);
  const saving = remaining <= 0;

  return {
    ...status,
    flow: {
      ...status.flow,
      phase: saving ? 'saving' : status.flow.phase,
      detail: saving
        ? 'Saving server before shutdown.'
        : `Server will ${countdownTarget(status)} in ${formatCountdownDuration(remaining)}.`,
      countdownRemainingSeconds: remaining,
      countdownTotalSeconds: countdownSnapshot.total
    }
  };
}

function renderStatusView(status) {
  renderOverview(status);
  renderStartupFlow(status);
  renderControls(status);
  renderRconAvailability(status);
  renderBusy(status);
  renderSummary(status);
  actionMessage.textContent = status.activeAction ? `${formatLabel(status.activeAction.action)} running` : '';
}

function renderStatus(status) {
  currentStatus = status;
  captureCountdownSnapshot(status);
  renderStatusView(adjustedCountdownStatus(status));
}

function renderCountdownTick() {
  if (!countdownSnapshot || !currentStatus || appView.classList.contains('hidden')) {
    return;
  }

  renderStatusView(adjustedCountdownStatus(currentStatus));
}

function normalizeLogEntry(entry) {
  return {
    timestamp: entry?.timestamp || '',
    source: entry?.source || 'unknown',
    line: String(entry?.line ?? '')
  };
}

function formatLogEntry(entry) {
  return `[${entry.timestamp}] [${entry.source}] ${entry.line}`;
}

function isErrorLog(entry) {
  return /stderr/i.test(entry.source) || /\b(error|exception|failed|traceback)\b/i.test(entry.line);
}

function visibleLogs() {
  const source = logSourceFilter.value;
  const query = logSearch.value.trim().toLowerCase();
  return allLogs.filter((entry) => {
    if (source && entry.source !== source) {
      return false;
    }
    if (!query) {
      return true;
    }
    return `${entry.timestamp} ${entry.source} ${entry.line}`.toLowerCase().includes(query);
  });
}

function renderLogSourceOptions() {
  const selected = logSourceFilter.value;
  const sources = Array.from(new Set(allLogs.map((entry) => entry.source))).sort();
  logSourceFilter.replaceChildren(new Option('All sources', ''));
  for (const source of sources) {
    logSourceFilter.append(new Option(source, source));
  }
  if (sources.includes(selected)) {
    logSourceFilter.value = selected;
  }
}

function renderLogLines() {
  const entries = visibleLogs();
  logs.replaceChildren();
  logs.classList.toggle('wrap', wrapLogsSwitch.checked);
  logs.classList.toggle('nowrap', !wrapLogsSwitch.checked);

  const fragment = document.createDocumentFragment();
  const query = logSearch.value.trim().toLowerCase();
  for (const entry of entries) {
    const row = document.createElement('div');
    row.className = ['log-line', isErrorLog(entry) ? 'error' : '', query ? 'match' : ''].filter(Boolean).join(' ');

    const timestamp = document.createElement('span');
    timestamp.className = 'log-timestamp';
    timestamp.textContent = formatTime(entry.timestamp) || entry.timestamp;

    const source = document.createElement('span');
    source.className = 'log-source';
    source.textContent = entry.source;

    const message = document.createElement('span');
    message.className = 'log-message';
    message.textContent = entry.line;

    row.append(timestamp, source, message);
    fragment.append(row);
  }

  logs.append(fragment);
  logsEmpty.classList.toggle('hidden', entries.length > 0);
  if (!pauseAutoscrollSwitch.checked) {
    logs.scrollTop = logs.scrollHeight;
  }
}

function renderLogs(payload) {
  allLogs = (payload.logs || []).map(normalizeLogEntry).slice(-MAX_LOGS);
  renderLogSourceOptions();
  renderLogLines();
}

function appendLogs(entries) {
  if (!entries || entries.length === 0) {
    return;
  }

  allLogs.push(...entries.map(normalizeLogEntry));
  if (allLogs.length > MAX_LOGS) {
    allLogs = allLogs.slice(-MAX_LOGS);
  }
  renderLogSourceOptions();
  renderLogLines();
}

async function copyVisibleLogs() {
  const text = visibleLogs().map(formatLogEntry).join('\n');
  if (!text) {
    showToast('Logs', 'No visible logs to copy.', 'warning');
    return;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.append(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    showToast('Logs copied', `${visibleLogs().length} visible log lines copied.`, 'success');
  } catch (error) {
    showToast('Copy failed', error.message || 'Unable to copy logs.', 'danger');
  }
}

function setLiveStatus(text, state = '') {
  liveStatus.textContent = text;
  liveStatus.className = ['connection-pill', state].filter(Boolean).join(' ');
}

function setLiveUpdatesUi(enabled) {
  if (liveUpdatesSwitch) {
    liveUpdatesSwitch.checked = enabled;
  }
  if (refreshLogsButton) {
    refreshLogsButton.disabled = enabled;
    refreshLogsButton.setAttribute(
      'aria-disabled',
      enabled ? 'true' : 'false'
    );
    refreshLogsButton.setAttribute(
      'aria-label',
      enabled ? 'Logs update automatically while live updates are on' : 'Refresh logs'
    );
    refreshLogsButton.dataset.bsTitle = enabled
      ? 'Logs update automatically while live updates are on'
      : 'Refresh logs';
    window.bootstrap?.Tooltip.getInstance(refreshLogsButton)
      ?.setContent({ '.tooltip-inner': refreshLogsButton.dataset.bsTitle });
  }
}

function isLivePzDataSource() {
  return pzDataSource?.kind === 'websocket';
}

function handlePzUpdate(update) {
  if (!update || typeof update.type !== 'string') {
    return;
  }

  if (update.type === 'connection') {
    setLiveStatus(update.text || 'Manual refresh', update.state || '');
    if (Object.prototype.hasOwnProperty.call(update, 'live')) {
      setLiveUpdatesUi(Boolean(update.live));
    }
    if (update.fallback) {
      fallbackToApiPzDataSource(update).catch((error) => {
        showToast('Live updates', error.message || 'Unable to restore manual refresh.', 'danger');
      });
    }
    return;
  }

  if (update.type === 'logs') {
    if (update.mode === 'replace') {
      renderLogs({ logs: update.entries || [] });
    } else {
      appendLogs(update.entries || []);
    }
    return;
  }

  if (update.type === 'status') {
    renderStatus(update.status);
    return;
  }

  if (update.type === 'toast' && update.toast) {
    showToast(update.toast.title, update.toast.message, update.toast.variant, update.toast);
    return;
  }

  if (update.type === 'action') {
    actionMessage.textContent = update.status === 'started'
      ? `${formatLabel(update.action?.action)} running`
      : '';
    window.setTimeout(refreshActivity, update.status === 'started' ? 50 : 300);
  }
}

async function startApiPzDataSource(options = {}) {
  pzDataSource?.stop();
  const source = new ApiPzDataSource(handlePzUpdate);
  pzDataSource = source;
  setLiveUpdatesUi(false);
  await source.start(options);
}

async function startLivePzDataSource() {
  pzDataSource?.stop();
  const source = new WebSocketPzDataSource(handlePzUpdate);
  pzDataSource = source;
  setLiveUpdatesUi(true);

  try {
    await source.start();
  } catch (error) {
    if (pzDataSource !== source) {
      return;
    }
    source.stop();
    pzDataSource = null;
    setLiveUpdatesUi(false);
    setLiveStatus('Connection error', 'status-danger');
    showToast('Live updates', error.message || 'Unable to open live updates.', 'danger');
    await startApiPzDataSource({
      connection: {
        type: 'connection',
        text: 'Connection error',
        state: 'status-danger',
        live: false
      }
    });
  }
}

async function fallbackToApiPzDataSource(connectionUpdate) {
  if (!isLivePzDataSource()) {
    return;
  }

  const message = connectionUpdate.state === 'status-danger'
    ? 'Connection error. Manual refresh is available.'
    : 'Disconnected. Manual refresh is available.';
  showToast('Live updates', message, connectionUpdate.state === 'status-danger' ? 'danger' : 'warning');
  await startApiPzDataSource({
    connection: {
      type: 'connection',
      text: connectionUpdate.text || 'Disconnected; manual refresh',
      state: connectionUpdate.state || 'status-warning',
      live: false
    }
  });
}

function stopPzDataSource() {
  pzDataSource?.stop();
  pzDataSource = null;
  setLiveUpdatesUi(false);
  setLiveStatus('Manual refresh');
}

async function refreshStatus() {
  try {
    if (isLivePzDataSource()) {
      return;
    }
    if (!pzDataSource) {
      await startApiPzDataSource({ refresh: false });
    }
    await pzDataSource.refreshStatus();
  } catch (error) {
    if (await handleSessionError(error)) {
      return;
    }
  }
}

async function refreshLogs() {
  try {
    if (isLivePzDataSource()) {
      return;
    }
    if (!pzDataSource) {
      await startApiPzDataSource({ refresh: false });
    }
    await pzDataSource.refreshLogs();
  } catch (error) {
    if (await handleSessionError(error)) {
      return;
    }

    if (error.status !== 401) {
      showToast('Logs failed', error.message, 'danger');
    }
  }
}

function renderActivity(actions = []) {
  activityList.replaceChildren();
  activityEmpty.classList.toggle('hidden', actions.length > 0);

  const fragment = document.createDocumentFragment();
  for (const entry of actions) {
    const item = document.createElement('article');
    item.className = 'activity-item';

    const main = document.createElement('div');
    main.className = 'activity-main';

    const action = document.createElement('div');
    action.className = 'activity-action';
    action.textContent = formatLabel(entry.action);

    const badge = document.createElement('span');
    badge.className = `status-badge status-${statusTone(entry.status)} status-${entry.status}`;
    badge.textContent = formatLabel(entry.status);

    main.append(action, badge);

    const meta = document.createElement('div');
    meta.className = 'activity-meta';
    meta.textContent = `${entry.username || 'unknown'} - ${formatDateTime(entry.createdAt)}`;

    item.append(main, meta);
    if (entry.message) {
      const message = document.createElement('div');
      message.className = 'activity-message';
      message.textContent = entry.message;
      item.append(message);
    }

    fragment.append(item);
  }

  activityList.append(fragment);
}

async function refreshActivity() {
  try {
    const payload = await api('/api/server/actions/recent?limit=20');
    renderActivity(payload.actions || []);
  } catch (error) {
    if (await handleSessionError(error)) {
      return;
    }

    if (error.status !== 401) {
      showToast('Activity failed', error.message, 'warning');
    }
  }
}

async function refreshRconStatus(options = {}) {
  if (!canRole('admin') || rconStatusInFlight) {
    return;
  }

  try {
    setRconStatusLoading(true);
    const payload = await api(`/api/server/rcon-status${options.refresh ? '?refresh=true' : ''}`);
    renderRconStatus(payload);
  } catch (error) {
    if (await handleSessionError(error)) {
      return;
    }

    if (error.status === 403) {
      renderRoleGates();
      return;
    }

    renderRconStatusUnavailable(error.message || 'RCON status is unavailable.');
    showToast('Server status failed', error.message, 'warning');
  } finally {
    setRconStatusLoading(false);
  }
}

function roleBadge(role) {
  const badge = document.createElement('span');
  badge.className = `status-badge status-${role === 'operator' ? 'success' : role === 'admin' ? 'warning' : 'secondary'}`;
  badge.textContent = formatLabel(role);
  return badge;
}

function renderUsers(users = []) {
  usersTable.replaceChildren();
  usersEmpty.classList.toggle('hidden', users.length > 0);

  const fragment = document.createDocumentFragment();
  for (const user of users) {
    const row = document.createElement('article');
    row.className = 'user-row';

    const main = document.createElement('div');
    main.className = 'user-main';
    const name = document.createElement('div');
    name.className = 'user-name';
    name.textContent = user.username;
    const meta = document.createElement('div');
    meta.className = 'user-meta';
    meta.textContent = [
      user.protectedOperator ? 'Protected operator' : '',
      user.mustChangePassword ? 'Password change required' : ''
    ].filter(Boolean).join(' - ') || 'Local account';
    main.append(name, meta);

    const actions = document.createElement('div');
    actions.className = 'user-actions';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'btn btn-sm btn-outline-secondary icon-text-button';
    edit.disabled = user.protectedOperator;
    edit.innerHTML = `${iconSvg('pencil')} Edit`;
    edit.addEventListener('click', () => openEditUserRole(user));

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn btn-sm btn-outline-danger icon-text-button';
    del.disabled = user.protectedOperator;
    del.innerHTML = `${iconSvg('trash-2')} Delete`;
    del.addEventListener('click', () => openDeleteUser(user));
    actions.append(edit, del);

    row.append(main, roleBadge(user.role), actions);
    fragment.append(row);
  }

  usersTable.append(fragment);
}

async function refreshUsers() {
  if (!isOperator() || !currentAuth?.local) {
    renderUsers([]);
    return;
  }

  try {
    const payload = await api('/api/users');
    renderUsers(payload.users || []);
  } catch (error) {
    if (await handleSessionError(error)) {
      return;
    }

    if (error.status === 403) {
      await init();
      return;
    }

    showToast('Users failed', error.message, 'warning');
  }
}

function isForcedPasswordModalOpen() {
  return forcingPasswordChange && changePasswordModal.classList.contains('show');
}

async function runAutomaticRefresh() {
  if (pollInFlight) {
    return;
  }

  pollInFlight = true;
  try {
    if (!currentUser || appView.classList.contains('hidden') || isForcedPasswordModalOpen()) {
      return;
    }

    await refreshStatus();
    if (isForcedPasswordModalOpen()) {
      return;
    }
    await refreshLogs();
    await refreshRconStatus();
  } finally {
    pollInFlight = false;
  }
}

function setCreateUserLoading(loading) {
  createUserSubmitButton.disabled = loading;
  createUserSubmitButton.textContent = loading ? 'Creating...' : 'Create user';
}

function openEditUserRole(user) {
  editUserId.value = String(user.id);
  editUserRole.value = user.role;
  editUserRoleIntro.textContent = `Change permissions for ${user.username}.`;
  editUserRoleMessage.textContent = '';
  editUserRoleMessage.className = 'portal-message mt-3 mb-0';
  editUserRoleModalInstance.show();
}

function openDeleteUser(user) {
  pendingDeleteUserId = user.id;
  deleteUserBody.textContent = `Delete ${user.username}? Their active local sessions will stop working.`;
  deleteUserMessage.textContent = '';
  deleteUserMessage.className = 'portal-message mt-3 mb-0';
  deleteUserModalInstance.show();
}

async function copyInitialPassword() {
  if (!lastInitialPassword) {
    return;
  }

  try {
    await navigator.clipboard.writeText(lastInitialPassword);
    showToast('Password copied', 'Initial password copied.', 'success');
  } catch (error) {
    showToast('Copy failed', error.message || 'Unable to copy password.', 'danger');
  }
}

function terminalInputHistory() {
  return terminalEntries
    .map((entry) => entry.input)
    .filter(Boolean);
}

function resetTerminalRecall() {
  terminalRecallIndex = null;
  terminalRecallDraft = '';
}

function terminalKindLabel(entry) {
  return {
    rcon: 'RCON',
    portal: 'Portal',
    system: 'System'
  }[entry?.kind] || formatLabel(entry?.kind || 'terminal');
}

function terminalStatusLabel(entry) {
  if (entry?.status === 'failed') {
    return 'failed';
  }
  if (entry?.status === 'running') {
    return 'running';
  }
  return 'completed';
}

function appendTerminalBlock(container, label, text, tone = '') {
  if (!text) {
    return;
  }

  const block = document.createElement('div');
  block.className = ['terminal-block', tone ? `terminal-block-${tone}` : ''].filter(Boolean).join(' ');

  const blockLabel = document.createElement('div');
  blockLabel.className = 'terminal-block-label';
  blockLabel.textContent = label;

  const pre = document.createElement('pre');
  pre.textContent = String(text).trimEnd();

  block.append(blockLabel, pre);
  container.append(block);
}

function renderTerminalEntry(entry) {
  const item = document.createElement('article');
  const statusClass = ['failed', 'running'].includes(entry.status) ? entry.status : 'completed';
  item.className = `terminal-entry terminal-entry-${statusClass}`;

  const commandLine = document.createElement('div');
  commandLine.className = 'terminal-entry-line';

  const prompt = document.createElement('span');
  prompt.className = 'terminal-entry-prompt';
  prompt.textContent = 'pz$';

  const command = document.createElement('span');
  command.className = 'terminal-entry-command';
  command.textContent = entry.input || '';

  const meta = document.createElement('span');
  meta.className = 'terminal-entry-meta';
  meta.textContent = `${terminalKindLabel(entry)} ${terminalStatusLabel(entry)}${entry.createdAt ? ` ${formatTime(entry.createdAt)}` : ''}`;

  commandLine.append(prompt, command, meta);
  item.append(commandLine);

  const output = document.createElement('div');
  output.className = 'terminal-entry-output';
  appendTerminalBlock(output, 'stdout', entry.stdout || '');
  appendTerminalBlock(output, 'stderr', entry.stderr || '', 'error');
  appendTerminalBlock(
    output,
    entry.status === 'failed' ? 'error' : entry.status === 'running' ? 'running' : 'message',
    entry.message || '',
    entry.status === 'failed' ? 'error' : ''
  );

  if (!output.childElementCount) {
    appendTerminalBlock(output, 'message', 'No output.');
  }

  item.append(output);
  return item;
}

function renderTerminalViews() {
  for (const view of terminalViews()) {
    view.output.replaceChildren();
    view.empty.classList.toggle('hidden', terminalEntries.length > 0);

    const fragment = document.createDocumentFragment();
    for (const entry of terminalEntries) {
      fragment.append(renderTerminalEntry(entry));
    }
    view.output.append(fragment);
  }

  scheduleTerminalScrollToBottom();
}

function setTerminalSubmitting(loading) {
  terminalSubmitting = loading;
  renderRconAvailability(currentStatus);
}

function appendTerminalEntry(entry) {
  terminalEntries = [...terminalEntries, entry].slice(-100);
  renderTerminalViews();
}

function replaceTerminalEntry(localId, entry) {
  terminalEntries = terminalEntries.map((current) => (
    current.localId === localId ? { ...entry } : current
  ));
  renderTerminalViews();
}

function clearTerminalEntries() {
  terminalEntries = [];
  renderTerminalViews();
}

async function refreshTerminalHistory() {
  if (!isOperator()) {
    terminalEntries = [];
    renderTerminalViews();
    return;
  }

  try {
    const payload = await api('/api/terminal/history?limit=100');
    terminalEntries = Array.isArray(payload.entries) ? payload.entries : [];
    renderTerminalViews();
  } catch (error) {
    if (!(await handleSessionError(error))) {
      showToast('Terminal history', error.message || 'Unable to load terminal history.', 'danger');
    }
  }
}

async function refreshAfterTerminalEntry(entry) {
  if (!entry) {
    return;
  }

  if (entry.kind === 'rcon') {
    await refreshActivity();
    return;
  }

  if (['start', 'stop', 'restart', 'safe_stop', 'safe_restart'].includes(entry.command)) {
    if (!isLivePzDataSource()) {
      await refreshStatus();
      await refreshLogs();
    }
    await refreshActivity();
  }
}

async function submitTerminalCommand(inputElement) {
  const command = inputElement.value.trim();
  if (!command || terminalSubmitting) {
    return;
  }

  resetTerminalRecall();
  inputElement.value = '';
  const localId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  appendTerminalEntry({
    localId,
    input: command,
    kind: command.startsWith('!') ? 'portal' : command.startsWith('/') || command.startsWith('\\') ? 'rcon' : 'system',
    status: 'running',
    command: '',
    stdout: '',
    stderr: '',
    message: 'Running command...',
    code: null,
    signal: null,
    createdAt: Date.now()
  });
  setTerminalSubmitting(true);

  try {
    const result = await api('/api/terminal/commands', {
      method: 'POST',
      body: JSON.stringify({ command })
    });

    if (result.cleared) {
      clearTerminalEntries();
      showToast('Terminal', result.message || 'Terminal history cleared.', 'success');
      return;
    }

    if (result.entry) {
      replaceTerminalEntry(localId, result.entry);
      await refreshAfterTerminalEntry(result.entry);
    }
  } catch (error) {
    if (!(await handleSessionError(error))) {
      replaceTerminalEntry(localId, {
        localId,
        input: command,
        kind: command.startsWith('!') ? 'portal' : command.startsWith('/') || command.startsWith('\\') ? 'rcon' : 'system',
        status: 'failed',
        command: '',
        stdout: '',
        stderr: '',
        message: error.message || 'Unable to run command.',
        code: null,
        signal: null,
        createdAt: Date.now()
      });
      showToast('Terminal failed', error.message || 'Unable to run command.', 'danger');
    }
  } finally {
    setTerminalSubmitting(false);
  }
}

function recallTerminalInput(event, inputElement) {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
    return false;
  }

  const history = terminalInputHistory();
  if (history.length === 0) {
    return false;
  }

  event.preventDefault();

  if (event.key === 'ArrowUp') {
    if (terminalRecallIndex === null) {
      terminalRecallDraft = inputElement.value;
      terminalRecallIndex = history.length - 1;
    } else {
      terminalRecallIndex = Math.max(0, terminalRecallIndex - 1);
    }
    inputElement.value = history[terminalRecallIndex] || '';
    inputElement.setSelectionRange(inputElement.value.length, inputElement.value.length);
    return true;
  }

  if (terminalRecallIndex === null) {
    return true;
  }

  if (terminalRecallIndex < history.length - 1) {
    terminalRecallIndex += 1;
    inputElement.value = history[terminalRecallIndex] || '';
  } else {
    inputElement.value = terminalRecallDraft;
    resetTerminalRecall();
  }

  inputElement.setSelectionRange(inputElement.value.length, inputElement.value.length);
  return true;
}

function openTerminalDrawer() {
  if (!isOperator() || !terminalDrawer || !terminalModeOverlay) {
    return;
  }

  terminalDrawerOpen = true;
  terminalDrawer.classList.remove('hidden');
  terminalModeOverlay.classList.remove('hidden');
  terminalModeOverlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('terminal-mode-open');
  renderTerminalViews();
  scheduleTerminalScrollToBottom();
  window.setTimeout(() => terminalDrawerInput?.focus(), 0);
}

function closeTerminalDrawer() {
  terminalDrawerOpen = false;
  terminalDrawer?.classList.add('hidden');
  terminalModeOverlay?.classList.add('hidden');
  terminalModeOverlay?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('terminal-mode-open');
  resetTerminalRecall();
}

function isDesktopTerminalViewport() {
  return window.matchMedia('(min-width: 768px)').matches;
}

function isTerminalTabActive() {
  return Boolean(
    rconTerminalPanel
      && !rconTerminalPanel.classList.contains('hidden')
      && rconTerminalPanel.classList.contains('active')
  );
}

function isTerminalShortcut(event) {
  return (event.ctrlKey || event.metaKey) && !event.altKey && event.code === 'Backquote';
}

function focusTerminalTabInput() {
  activateOperationTab(rconTabButton);
  window.setTimeout(() => terminalPanelInput?.focus(), 0);
}

function handleTerminalShortcut(event) {
  if (!isTerminalShortcut(event) || !isOperator()) {
    return;
  }

  event.preventDefault();

  if (terminalDrawerOpen) {
    closeTerminalDrawer();
    return;
  }

  if (isTerminalTabActive() || !isDesktopTerminalViewport()) {
    focusTerminalTabInput();
    return;
  }

  openTerminalDrawer();
}

function initBootstrapWidgets() {
  if (!window.bootstrap) {
    return;
  }

  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((element) => {
    new window.bootstrap.Tooltip(element);
  });

  confirmModal = new window.bootstrap.Modal(actionConfirmModal);
  passwordModal = new window.bootstrap.Modal(changePasswordModal, {
    backdrop: 'static',
    keyboard: false
  });
  createUserModalInstance = new window.bootstrap.Modal(createUserModal);
  initialPasswordModalInstance = new window.bootstrap.Modal(initialPasswordModal);
  editUserRoleModalInstance = new window.bootstrap.Modal(editUserRoleModal);
  deleteUserModalInstance = new window.bootstrap.Modal(deleteUserModal);

  changePasswordModal.addEventListener('shown.bs.modal', () => {
    document.getElementById('currentPassword')?.focus();
  });
  actionConfirmModal.addEventListener('shown.bs.modal', () => {
    confirmActionButton?.focus();
  });
  createUserModal.addEventListener('shown.bs.modal', () => {
    document.getElementById('newUserUsername')?.focus();
  });
  for (const view of terminalViews()) {
    view.input.addEventListener('keydown', (event) => {
      if (recallTerminalInput(event, view.input)) {
        return;
      }
      if (event.key === 'Enter' && event.ctrlKey) {
        view.form.requestSubmit();
      }
    });
    view.input.addEventListener('input', resetTerminalRecall);
  }
}

function redirectHome() {
  currentUser = null;
  stopPzDataSource();
  window.location.replace('/');
}

function showApp(user) {
  currentUser = user;
  appView.classList.remove('hidden');
  accountMenu.classList.remove('hidden');
  liveUpdateControl?.classList.remove('hidden');
  logoutButton.classList.remove('hidden');
  userLabel.textContent = user.username || 'Account';
  accountIdentity.textContent = user.username || 'Signed in';
  accountProvider.textContent = `${formatLabel(user.role || 'read_only')} via ${formatLabel(user.provider || 'local')}`;
  changePasswordButton.classList.toggle(
    'hidden',
    !(currentAuth?.local && user.provider === 'local')
  );
  renderRoleGates();
}

function showPasswordChangeModal(force = false) {
  const alreadyOpen = changePasswordModal.classList.contains('show');
  const alreadyForcing = force && isForcedPasswordModalOpen();
  forcingPasswordChange = force;
  if (currentUser) {
    currentUser.mustChangePassword = force;
  }

  if (!alreadyForcing) {
    changePasswordForm.reset();
    changePasswordForm.classList.remove('was-validated');
    changePasswordMessage.textContent = force ? 'Change your initial password before continuing.' : '';
    changePasswordMessage.className = 'portal-message mt-3 mb-0';
  }

  changePasswordCloseButton.classList.toggle('hidden', force);
  changePasswordCancelButton.classList.toggle('hidden', force);
  changePasswordLogoutButton.classList.toggle('hidden', !force);
  if (!alreadyOpen) {
    passwordModal.show();
  }
}

async function handleSessionError(error) {
  if (error.status === 401) {
    redirectHome();
    return true;
  }

  if (error.status === 403 && error.body?.error === 'password_change_required') {
    showPasswordChangeModal(true);
    return true;
  }

  return false;
}

async function init() {
  const session = await api('/api/me');
  currentAuth = session.auth;

  if (!session.authenticated) {
    redirectHome();
    return;
  }

  showApp(session.user);
  if (session.user.mustChangePassword) {
    showPasswordChangeModal(true);
    return;
  }

  await startApiPzDataSource({ refresh: false });
  await refreshStatus();
  await refreshLogs();
  await refreshActivity();
  await refreshRconStatus();
  await refreshTerminalHistory();
  await refreshUsers();
}

function updateCheckLabelForAction(action) {
  if (action === 'start') {
    return 'Run SteamCMD update check before starting';
  }

  if (action === 'restart' || action === 'safe_restart') {
    return 'Run SteamCMD update check before starting again';
  }

  return '';
}

function actionSupportsUpdateCheck(action) {
  return ['start', 'restart', 'safe_restart'].includes(action);
}

function actionSupportsCountdown(action) {
  return ['safe_stop', 'safe_restart'].includes(action);
}

function formatCountdownChoice(seconds) {
  const minutes = Math.max(1, Math.round(Number(seconds || DEFAULT_SAFE_COUNTDOWN_SECONDS) / 60));
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function updateCountdownChoiceLabel() {
  if (countdownSecondsValue && countdownSecondsRange) {
    countdownSecondsValue.textContent = formatCountdownChoice(countdownSecondsRange.value);
  }
}

function actionRisk(action) {
  if (action === 'start') {
    return 'success';
  }
  if (action.startsWith('safe_')) {
    return 'warning';
  }
  return 'danger';
}

function actionConfirmationCopy(action) {
  const copies = {
    start: {
      title: 'Start Server',
      body: 'Start the Project Zomboid dedicated server process.',
      warning: '',
      meta: ['Players can join after readiness is detected in the server logs.']
    },
    safe_stop: {
      title: 'Safe Stop',
      body: 'Send player countdown warnings over RCON, save the server, then stop it.',
      warning: 'Players receive warning messages before shutdown.',
      meta: ['The server will remain stopped.', 'RCON must stay available during the countdown.']
    },
    safe_restart: {
      title: 'Safe Restart',
      body: 'Send player countdown warnings over RCON, save the server, stop it, then start it again.',
      warning: 'Players receive warning messages before restart.',
      meta: ['The server returns to ready after startup completes.', 'RCON must stay available during the countdown.']
    },
    stop: {
      title: 'Stop Now',
      body: 'Stop the server process immediately.',
      warning: 'Players will not receive an in-game countdown warning.',
      meta: ['The server will remain stopped.', 'Use Safe Stop when RCON is available and players need warning.']
    },
    restart: {
      title: 'Restart Now',
      body: 'Stop the server process immediately, then start it again.',
      warning: 'Players will not receive an in-game countdown warning.',
      meta: ['Use Safe Restart when RCON is available and players need warning.']
    }
  };
  return copies[action] || copies.restart;
}

function confirmAction(action) {
  if (!actionRequiresConfirmation(action)) {
    runAction(action);
    return;
  }

  if (!confirmModal) {
    runAction(action);
    return;
  }

  const copy = actionConfirmationCopy(action);
  const risk = actionRisk(action);
  pendingConfirmedAction = action;
  confirmActionTitle.textContent = copy.title;
  confirmActionBody.textContent = copy.body;
  confirmActionWarning.textContent = copy.warning;
  confirmActionWarning.classList.toggle('hidden', !copy.warning);
  confirmActionWarning.classList.toggle('safe', action.startsWith('safe_'));

  confirmActionMeta.replaceChildren();
  for (const line of copy.meta) {
    const item = document.createElement('div');
    item.textContent = line;
    confirmActionMeta.append(item);
  }

  const supportsUpdateCheck = actionSupportsUpdateCheck(action);
  checkUpdatesSwitch.checked = false;
  checkUpdatesSwitch.disabled = !supportsUpdateCheck;
  if (checkUpdatesGroup) {
    checkUpdatesGroup.classList.toggle('hidden', !supportsUpdateCheck);
  }
  checkUpdatesLabel.textContent = supportsUpdateCheck ? updateCheckLabelForAction(action) : '';

  const supportsCountdown = actionSupportsCountdown(action);
  if (countdownControlGroup) {
    countdownControlGroup.classList.toggle('hidden', !supportsCountdown);
  }
  if (countdownSecondsRange) {
    countdownSecondsRange.value = String(DEFAULT_SAFE_COUNTDOWN_SECONDS);
    countdownSecondsRange.disabled = !supportsCountdown;
  }
  updateCountdownChoiceLabel();

  confirmActionButton.textContent = formatLabel(action);
  confirmActionButton.classList.remove('btn-danger', 'btn-warning', 'btn-success');
  confirmActionButton.classList.add(`btn-${risk}`);
  confirmModal.show();
}

async function runAction(action, options = {}) {
  actionMessage.textContent = '';
  pendingAction = action;
  setActionButtonsDisabled(true);
  renderControls(currentStatus || {});
  if (!isLivePzDataSource()) {
    showToast(formatLabel(action), 'Action started.', action.startsWith('safe_') ? 'warning' : 'primary');
  }

  try {
    const status = await api('/api/server/actions', {
      method: 'POST',
      body: JSON.stringify({
        action,
        checkUpdates: Boolean(options.checkUpdates),
        ...(options.countdownSeconds ? { countdownSeconds: options.countdownSeconds } : {})
      })
    });
    if (!isLivePzDataSource()) {
      renderStatus(status);
    }
    await refreshActivity();
    if (!isLivePzDataSource()) {
      showToast(formatLabel(action), 'Action completed.', 'success');
      await refreshLogs();
    }
  } catch (error) {
    const activeAction = error.body?.activeAction;
    const message = error.status === 409 && activeAction
      ? `${describeActiveAction(activeAction)} is already running.`
      : error.status === 409
        ? 'Another action is already running.'
        : error.message;
    actionMessage.textContent = message;
    showToast('Action failed', message, error.status === 409 ? 'warning' : 'danger');
    if (activeAction && currentStatus) {
      renderStatus({ ...currentStatus, activeAction });
    }
  } finally {
    pendingAction = '';
    if (!isLivePzDataSource()) {
      await refreshStatus();
    }
    await refreshActivity();
  }
}

function setPasswordButtonLoading(loading) {
  if (!savePasswordButton) {
    return;
  }
  savePasswordButton.disabled = loading;
  savePasswordButton.textContent = loading ? 'Saving...' : 'Save password';
}

function initPasswordToggles() {
  document.querySelectorAll('.password-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.targetInput);
      if (!input) {
        return;
      }
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      const label = visible ? 'Hide password' : 'Show password';
      button.setAttribute('aria-label', label);
      button.dataset.bsTitle = label;
      renderIconElement(button.querySelector('[data-icon]'), visible ? 'eye-off' : 'eye');
      const tooltip = window.bootstrap?.Tooltip.getInstance(button);
      tooltip?.setContent({ '.tooltip-inner': label });
    });
  });
}

async function logoutToLogin() {
  await api('/api/auth/logout', { method: 'POST', body: '{}' });
  stopPzDataSource();
  forcingPasswordChange = false;
  if (currentUser) {
    currentUser.mustChangePassword = false;
  }
  passwordModal?.hide();
  changePasswordForm.reset();
  changePasswordForm.classList.remove('was-validated');
  window.location.replace('/');
}

logoutButton.addEventListener('click', async () => {
  await logoutToLogin();
});

startButton.addEventListener('click', () => confirmAction('start'));
safeStopButton.addEventListener('click', () => confirmAction('safe_stop'));
safeRestartButton.addEventListener('click', () => confirmAction('safe_restart'));
stopButton.addEventListener('click', () => confirmAction('stop'));
restartButton.addEventListener('click', () => confirmAction('restart'));
immediateStopButton.addEventListener('click', () => confirmAction('stop'));
immediateRestartButton.addEventListener('click', () => confirmAction('restart'));
confirmActionButton.addEventListener('click', () => {
  const action = pendingConfirmedAction;
  pendingConfirmedAction = null;
  confirmModal.hide();
  if (action) {
    runAction(action, {
      checkUpdates: actionSupportsUpdateCheck(action) && checkUpdatesSwitch.checked,
      countdownSeconds: actionSupportsCountdown(action)
        ? Number.parseInt(countdownSecondsRange?.value || String(DEFAULT_SAFE_COUNTDOWN_SECONDS), 10)
        : null
    });
  }
});

changePasswordButton.addEventListener('click', () => {
  showPasswordChangeModal(false);
});

changePasswordLogoutButton.addEventListener('click', async () => {
  changePasswordMessage.textContent = '';
  changePasswordMessage.classList.remove('error', 'success');
  try {
    changePasswordLogoutButton.disabled = true;
    changePasswordLogoutButton.textContent = 'Logging out...';
    await logoutToLogin();
  } catch (error) {
    changePasswordMessage.textContent = error.message;
    changePasswordMessage.classList.add('error');
  } finally {
    changePasswordLogoutButton.disabled = false;
    changePasswordLogoutButton.textContent = 'Log out';
  }
});

changePasswordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  changePasswordMessage.textContent = '';
  changePasswordMessage.classList.remove('error', 'success');

  if (!changePasswordForm.checkValidity()) {
    changePasswordForm.classList.add('was-validated');
    changePasswordMessage.textContent = 'Complete all password fields. New password must be at least 8 characters.';
    changePasswordMessage.classList.add('error');
    return;
  }

  const form = new FormData(changePasswordForm);
  const newPassword = String(form.get('newPassword') || '');
  const confirmNewPassword = String(form.get('confirmNewPassword') || '');
  if (newPassword !== confirmNewPassword) {
    changePasswordMessage.textContent = 'New passwords do not match.';
    changePasswordMessage.classList.add('error');
    return;
  }

  try {
    setPasswordButtonLoading(true);
    await api('/api/auth/password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: form.get('currentPassword'),
        newPassword
      })
    });
    passwordModal.hide();
    changePasswordForm.reset();
    showToast('Password changed', 'Your password was updated.', 'success');
    if (forcingPasswordChange) {
      forcingPasswordChange = false;
      await init();
    }
  } catch (error) {
    changePasswordMessage.textContent = error.message;
    changePasswordMessage.classList.add('error');
  } finally {
    setPasswordButtonLoading(false);
  }
});

createUserButton.addEventListener('click', () => {
  createUserForm.reset();
  createUserForm.classList.remove('was-validated');
  createUserMessage.textContent = '';
  createUserMessage.className = 'portal-message mt-3 mb-0';
  createUserModalInstance.show();
});

createUserForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  createUserMessage.textContent = '';
  createUserMessage.classList.remove('error', 'success');

  if (!createUserForm.checkValidity()) {
    createUserForm.classList.add('was-validated');
    createUserMessage.textContent = 'Enter a username and permission level.';
    createUserMessage.classList.add('error');
    return;
  }

  const form = new FormData(createUserForm);
  try {
    setCreateUserLoading(true);
    const payload = await api('/api/users', {
      method: 'POST',
      body: JSON.stringify({
        username: form.get('username'),
        role: form.get('role')
      })
    });
    createUserModalInstance.hide();
    createUserForm.reset();
    lastInitialPassword = payload.initialPassword || '';
    initialPasswordIntro.textContent = `${payload.user.username} can sign in with this initial password.`;
    initialPasswordCode.textContent = lastInitialPassword;
    initialPasswordModalInstance.show();
    await refreshUsers();
  } catch (error) {
    createUserMessage.textContent = error.message;
    createUserMessage.classList.add('error');
  } finally {
    setCreateUserLoading(false);
  }
});

copyInitialPasswordButton.addEventListener('click', copyInitialPassword);

editUserRoleForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  editUserRoleMessage.textContent = '';
  editUserRoleMessage.classList.remove('error', 'success');

  try {
    saveUserRoleButton.disabled = true;
    await api(`/api/users/${encodeURIComponent(editUserId.value)}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: editUserRole.value })
    });
    editUserRoleModalInstance.hide();
    await refreshUsers();
    showToast('User updated', 'Permission level saved.', 'success');
  } catch (error) {
    editUserRoleMessage.textContent = error.message;
    editUserRoleMessage.classList.add('error');
  } finally {
    saveUserRoleButton.disabled = false;
  }
});

confirmDeleteUserButton.addEventListener('click', async () => {
  if (!pendingDeleteUserId) {
    return;
  }

  deleteUserMessage.textContent = '';
  deleteUserMessage.classList.remove('error', 'success');
  try {
    confirmDeleteUserButton.disabled = true;
    await api(`/api/users/${encodeURIComponent(pendingDeleteUserId)}`, {
      method: 'DELETE',
      body: '{}'
    });
    deleteUserModalInstance.hide();
    pendingDeleteUserId = null;
    await refreshUsers();
    showToast('User deleted', 'Local user removed.', 'success');
  } catch (error) {
    deleteUserMessage.textContent = error.message;
    deleteUserMessage.classList.add('error');
  } finally {
    confirmDeleteUserButton.disabled = false;
  }
});

terminalPanelForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  await submitTerminalCommand(terminalPanelInput);
});

terminalDrawerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  await submitTerminalCommand(terminalDrawerInput);
});

terminalLauncherButton?.addEventListener('click', openTerminalDrawer);
terminalDrawerCloseButton?.addEventListener('click', closeTerminalDrawer);
terminalModeOverlay?.addEventListener('click', closeTerminalDrawer);
rconTabButton?.addEventListener('shown.bs.tab', scheduleTerminalScrollToBottom);
document.addEventListener('keydown', (event) => {
  handleTerminalShortcut(event);
  if (event.key === 'Escape' && terminalDrawerOpen) {
    closeTerminalDrawer();
  }
});

refreshLogsButton.addEventListener('click', refreshLogs);
refreshActivityButton.addEventListener('click', refreshActivity);
refreshServerStatusButton?.addEventListener('click', () => refreshRconStatus({ refresh: true }));
countdownSecondsRange?.addEventListener('input', updateCountdownChoiceLabel);
liveUpdatesSwitch.addEventListener('change', async () => {
  liveUpdatesSwitch.disabled = true;
  try {
    if (liveUpdatesSwitch.checked) {
      await startLivePzDataSource();
    } else {
      await startApiPzDataSource();
    }
  } catch (error) {
    if (!(await handleSessionError(error))) {
      showToast('Live updates', error.message || 'Unable to change live update mode.', 'danger');
    }
    setLiveUpdatesUi(isLivePzDataSource());
  } finally {
    liveUpdatesSwitch.disabled = false;
  }
});
pauseAutoscrollSwitch.addEventListener('change', renderLogLines);
wrapLogsSwitch.addEventListener('change', renderLogLines);
logSourceFilter.addEventListener('change', renderLogLines);
logSearch.addEventListener('input', renderLogLines);
copyLogsButton.addEventListener('click', copyVisibleLogs);

setInterval(runAutomaticRefresh, POLL_MS);

setInterval(renderCountdownTick, 1000);

renderIcons();
initBootstrapWidgets();
initPasswordToggles();
initTheme();
init().catch((error) => {
  actionMessage.textContent = error.message;
  showToast('Management unavailable', error.message, 'danger');
  redirectHome();
});

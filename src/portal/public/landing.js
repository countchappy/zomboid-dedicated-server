'use strict';

const {
  api,
  formatLabel,
  initPasswordToggles,
  initTheme,
  initTooltips,
  renderIcons,
  setStatusBadge,
  setStatusPill
} = window.PortalCommon;

const POLL_MS = 5000;
const MANAGEMENT_PATH = '/manage';

const loginForm = document.getElementById('loginForm');
const externalLogin = document.getElementById('externalLogin');
const loginMessage = document.getElementById('loginMessage');
const publicServerName = document.getElementById('publicServerName');
const publicDescription = document.getElementById('publicDescription');
const publicStatusPill = document.getElementById('publicStatusPill');
const publicStatusText = document.getElementById('publicStatusText');
const publicReadyState = document.getElementById('publicReadyState');
const publicStatusMessage = document.getElementById('publicStatusMessage');
const publicPlayersOnline = document.getElementById('publicPlayersOnline');
const publicZombiesTotal = document.getElementById('publicZombiesTotal');
const publicZombiesKilledToday = document.getElementById('publicZombiesKilledToday');
const publicMetricsFreshness = document.getElementById('publicMetricsFreshness');
const headerStatusPill = document.getElementById('headerStatusPill');
const headerStatusText = document.getElementById('headerStatusText');

let currentPublicStatus = null;
let publicRefreshInFlight = false;

function managementLoginUrl(baseUrl) {
  const url = new URL(baseUrl || '/auth/login', window.location.origin);
  url.searchParams.set('redirect', MANAGEMENT_PATH);
  return `${url.pathname}${url.search}`;
}

function publicStatusSummary(status, stale = false) {
  if (stale) {
    return 'Status refresh failed; showing the last public update.';
  }

  if (!status) {
    return 'Public status is temporarily unavailable.';
  }

  if (status.state === 'online' && status.ready) {
    return 'Server is online and ready for players.';
  }

  if (status.state === 'online') {
    return 'Server is online and still becoming ready.';
  }

  if (status.state === 'starting') {
    return 'Server is starting.';
  }

  if (status.state === 'stopping') {
    return 'Server is stopping.';
  }

  if (status.state === 'offline') {
    return 'Server is offline.';
  }

  if (status.state === 'error') {
    return 'Server status needs admin attention.';
  }

  return 'Server status is unknown.';
}

function setHeaderStatus(state) {
  setStatusPill(headerStatusPill, headerStatusText, state);
}

function setPublicStatusPill(state) {
  setStatusPill(publicStatusPill, publicStatusText, state);
}

function formatMetric(value) {
  if (!Number.isFinite(value)) {
    return 'Unknown';
  }

  return value.toLocaleString([], { maximumFractionDigits: 0 });
}

function formatUpdatedAt(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function renderPublicMetrics(metrics = {}) {
  publicPlayersOnline.textContent = formatMetric(metrics.playersOnline);
  publicZombiesTotal.textContent = formatMetric(metrics.zombiesTotal);
  publicZombiesKilledToday.textContent = formatMetric(metrics.zombiesKilledToday);

  const updatedAt = formatUpdatedAt(metrics.updatedAt);
  publicMetricsFreshness.textContent = updatedAt
    ? `${metrics.stale ? 'Last known' : 'Updated'} ${updatedAt}`
    : '';
  publicMetricsFreshness.classList.toggle('hidden', !updatedAt);
  publicMetricsFreshness.classList.toggle('stale', Boolean(metrics.stale));
}

function renderPublicStatus(status, options = {}) {
  currentPublicStatus = status;
  const stale = Boolean(options.stale);

  publicServerName.textContent = status.serverName || 'Project Zomboid Server';
  publicDescription.textContent = status.description || '';
  publicDescription.classList.toggle('hidden', !status.description);

  setHeaderStatus(status.state);
  setPublicStatusPill(status.state);
  setStatusBadge(
    publicReadyState,
    status.ready ? 'Ready' : 'Not Ready',
    status.ready ? 'success' : status.state === 'online' ? 'warning' : 'secondary',
    status.ready ? 'ready' : 'not-ready'
  );

  publicStatusMessage.textContent = publicStatusSummary(status, stale);
  publicStatusMessage.classList.toggle('error', stale);
  renderPublicMetrics(status.metrics || {});
}

function renderPublicStatusUnavailable() {
  currentPublicStatus = null;
  publicServerName.textContent = 'Project Zomboid Server';
  publicDescription.textContent = '';
  publicDescription.classList.add('hidden');
  setHeaderStatus('unknown');
  setPublicStatusPill('unknown');
  setStatusBadge(publicReadyState, 'Unknown', 'secondary', 'unknown');
  publicStatusMessage.textContent = publicStatusSummary(null);
  publicStatusMessage.classList.add('error');
  renderPublicMetrics({});
}

async function refreshPublicStatus() {
  if (publicRefreshInFlight) {
    return;
  }

  publicRefreshInFlight = true;
  try {
    const status = await api('/api/public/status');
    renderPublicStatus(status);
  } catch (_error) {
    if (currentPublicStatus) {
      renderPublicStatus(currentPublicStatus, { stale: true });
    } else {
      renderPublicStatusUnavailable();
    }
  } finally {
    publicRefreshInFlight = false;
  }
}

function configureAuth(auth) {
  if (auth.local) {
    loginForm.classList.remove('hidden');
    externalLogin.classList.add('hidden');
    return;
  }

  loginForm.classList.add('hidden');
  externalLogin.href = managementLoginUrl(auth.externalLoginUrl);
  externalLogin.classList.remove('hidden');
}

async function initLanding() {
  renderIcons();
  initTooltips();
  initPasswordToggles();
  initTheme();

  try {
    const session = await api('/api/me');
    if (session.authenticated) {
      window.location.replace(MANAGEMENT_PATH);
      return;
    }

    configureAuth(session.auth || { local: true });
    await refreshPublicStatus();
  } catch (error) {
    loginMessage.textContent = error.message;
    loginMessage.classList.add('error');
    renderPublicStatusUnavailable();
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginMessage.textContent = '';
  loginMessage.classList.remove('error', 'success');

  if (!loginForm.checkValidity()) {
    loginForm.classList.add('was-validated');
    loginMessage.textContent = 'Enter your username and password.';
    loginMessage.classList.add('error');
    return;
  }

  const form = new FormData(loginForm);
  try {
    await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: form.get('username'),
        password: form.get('password')
      })
    });
    loginForm.reset();
    loginForm.classList.remove('was-validated');
    window.location.replace(MANAGEMENT_PATH);
  } catch (error) {
    loginMessage.textContent = error.message;
    loginMessage.classList.add('error');
  }
});

setInterval(refreshPublicStatus, POLL_MS);

initLanding();

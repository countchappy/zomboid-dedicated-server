'use strict';

function publicStateFromStatus(status) {
  const preparationState = status?.preparation?.state || '';
  const serverState = status?.server?.state || '';

  if (preparationState === 'error' || serverState === 'errored') {
    return 'error';
  }

  return {
    running: 'online',
    starting: 'starting',
    stopping: 'stopping',
    stopped: 'offline'
  }[serverState] || 'unknown';
}

function publicMetricsFromRconStatus(rconStatus) {
  const summary = rconStatus?.summary || {};

  return {
    playersOnline: Number.isFinite(summary.playersOnline) ? summary.playersOnline : null,
    zombiesTotal: Number.isFinite(summary.zombiesTotal) ? summary.zombiesTotal : null,
    zombiesKilledToday: Number.isFinite(summary.zombiesKilledToday) ? summary.zombiesKilledToday : null,
    updatedAt: rconStatus?.updatedAt || null,
    stale: Boolean(rconStatus?.stale)
  };
}

function buildPublicStatus({ config, status, rconStatus = null, now = () => new Date() }) {
  const publicConfig = config.publicStatus || {};

  return {
    serverName: publicConfig.serverName || 'Project Zomboid Server',
    description: publicConfig.description || null,
    state: publicStateFromStatus(status),
    ready: Boolean(status?.server?.ready),
    metrics: publicMetricsFromRconStatus(rconStatus),
    updatedAt: now().toISOString()
  };
}

module.exports = {
  buildPublicStatus,
  publicMetricsFromRconStatus,
  publicStateFromStatus
};

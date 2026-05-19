'use strict';

const RCON_STATUS_REFRESH_INTERVAL_MS = 30 * 1000;

const STATUS_COMMANDS = [
  { id: 'network', title: 'Network', command: 'stats network all' },
  { id: 'connection', title: 'Connection', command: 'stats connection all' },
  { id: 'performance', title: 'Performance', command: 'stats performance all' },
  { id: 'game', title: 'Game', command: 'stats game all' }
];

const PLAYERS_COMMAND = 'players';

function emptySummary() {
  return {
    playersOnline: null,
    zombiesTotal: null,
    zombiesKilledToday: null,
    fps: null,
    memoryUsed: null,
    memoryMax: null,
    sentBps: null,
    receivedBps: null,
    packetLossLastSecond: null
  };
}

function metricLabel(key) {
  return String(key || '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bBps\b/g, 'BPS')
    .replace(/\bFps\b/g, 'FPS')
    .replace(/\bVoip\b/g, 'VOIP');
}

function parseMetricNumber(rawValue) {
  const value = Number.parseFloat(String(rawValue || '').trim());
  return Number.isFinite(value) ? value : null;
}

function parseStatsOutput(stdout) {
  const metrics = [];
  const values = {};

  for (const line of String(stdout || '').split(/\r?\n/)) {
    const text = line.trim();
    if (!text || text === 'Sent' || text === 'stdout:') {
      continue;
    }

    const match = /^([a-z0-9-]+):\s*(.+)$/i.exec(text);
    if (!match) {
      continue;
    }

    const key = match[1];
    const raw = match[2].trim();
    const value = parseMetricNumber(raw);
    metrics.push({
      key,
      label: metricLabel(key),
      value,
      raw
    });
    values[key] = value;
  }

  return { metrics, values };
}

function parsePlayersOnline(stdout) {
  const match = /Players connected\s*\((\d+)\)\s*:/i.exec(String(stdout || ''));
  if (!match) {
    return null;
  }

  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
}

function parsePlayers(stdout) {
  const text = String(stdout || '');
  const online = parsePlayersOnline(text);
  const names = [];
  let afterHeader = false;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (/Players connected\s*\(\d+\)\s*:/i.test(trimmed)) {
      afterHeader = true;
      continue;
    }

    if (!afterHeader) {
      continue;
    }

    const name = trimmed.replace(/^[-*]\s*/, '').trim();
    if (name) {
      names.push(name);
    }
  }

  return {
    online,
    names
  };
}

function countMetric(value) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : null;
}

function buildRconStatusSnapshot(outputs, now = new Date()) {
  const parsedById = {};
  const sections = STATUS_COMMANDS.map((descriptor) => {
    const parsed = parseStatsOutput(outputs?.[descriptor.id] || '');
    parsedById[descriptor.id] = parsed;
    return {
      id: descriptor.id,
      title: descriptor.title,
      metrics: parsed.metrics
    };
  });

  const game = parsedById.game?.values || {};
  const connection = parsedById.connection?.values || {};
  const performance = parsedById.performance?.values || {};
  const network = parsedById.network?.values || {};
  const players = parsePlayers(outputs?.players);

  return {
    available: true,
    refreshing: false,
    stale: false,
    updatedAt: now.toISOString(),
    error: '',
    summary: {
      ...emptySummary(),
      playersOnline: countMetric(players.online ?? game.players),
      players: players.names,
      zombiesTotal: countMetric(game['zombies-total']),
      zombiesKilledToday: countMetric(connection['zombies-killed-today']),
      fps: performance.fps ?? null,
      memoryUsed: performance['memory-used'] ?? null,
      memoryMax: performance['memory-max'] ?? null,
      sentBps: network['sent-bps'] ?? null,
      receivedBps: network['received-bps'] ?? null,
      packetLossLastSecond: network['packet-loss-last-second'] ?? null
    },
    sections
  };
}

class RconStatusCache {
  constructor(options = {}) {
    this.enabled = options.enabled || (() => false);
    this.runCommand = options.runCommand || (async () => {
      throw new Error('RCON status command runner is not configured.');
    });
    this.now = options.now || (() => new Date());
    this.refreshIntervalMs = options.refreshIntervalMs || RCON_STATUS_REFRESH_INTERVAL_MS;
    this.lastSnapshot = null;
    this.lastError = '';
    this.inFlight = null;
  }

  isEnabled() {
    return typeof this.enabled === 'function' ? Boolean(this.enabled()) : Boolean(this.enabled);
  }

  isExpired(snapshot) {
    if (!snapshot?.updatedAt) {
      return true;
    }

    const updatedAt = new Date(snapshot.updatedAt).getTime();
    return !Number.isFinite(updatedAt) || this.now().getTime() - updatedAt >= this.refreshIntervalMs;
  }

  withState(snapshot, overrides = {}) {
    return {
      ...snapshot,
      refreshing: Boolean(overrides.refreshing),
      stale: Boolean(overrides.stale),
      error: overrides.error || ''
    };
  }

  unavailable(message, refreshing = false) {
    if (this.lastSnapshot) {
      return this.withState(this.lastSnapshot, {
        refreshing,
        stale: true,
        error: message
      });
    }

    return {
      available: false,
      refreshing,
      stale: false,
      updatedAt: null,
      error: message,
      summary: emptySummary(),
      sections: STATUS_COMMANDS.map((descriptor) => ({
        id: descriptor.id,
        title: descriptor.title,
        metrics: []
      }))
    };
  }

  async collectSnapshot() {
    const outputs = {};

    for (const descriptor of STATUS_COMMANDS) {
      const result = await this.runCommand(descriptor.command);
      outputs[descriptor.id] = result?.stdout || '';
    }

    const players = await this.runCommand(PLAYERS_COMMAND);
    outputs.players = players?.stdout || '';
    return buildRconStatusSnapshot(outputs, this.now());
  }

  async refresh() {
    try {
      const snapshot = await this.collectSnapshot();
      this.lastSnapshot = snapshot;
      this.lastError = '';
      return snapshot;
    } catch (error) {
      this.lastError = error.message || 'RCON status refresh failed.';
      return null;
    } finally {
      this.inFlight = null;
    }
  }

  async getStatus(options = {}) {
    if (!this.isEnabled()) {
      return this.unavailable('RCON is not enabled.');
    }

    const force = Boolean(options.refresh);
    const needsRefresh = force || !this.lastSnapshot || this.isExpired(this.lastSnapshot);
    if (!needsRefresh) {
      return this.withState(this.lastSnapshot, {
        refreshing: Boolean(this.inFlight),
        stale: false,
        error: ''
      });
    }

    if (!this.inFlight) {
      this.inFlight = this.refresh();
    }

    const refreshed = await this.inFlight;
    if (refreshed) {
      return this.withState(refreshed);
    }

    return this.unavailable(this.lastError || 'RCON status refresh failed.');
  }
}

module.exports = {
  PLAYERS_COMMAND,
  RCON_STATUS_REFRESH_INTERVAL_MS,
  RconStatusCache,
  STATUS_COMMANDS,
  buildRconStatusSnapshot,
  emptySummary,
  parsePlayers,
  parsePlayersOnline,
  parseStatsOutput
};

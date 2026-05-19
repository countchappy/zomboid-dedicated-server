'use strict';

const { roleAtLeast } = require('./roles');

function isRconLogSource(source) {
  const normalized = String(source || '').trim().toLowerCase();
  return normalized === 'rcon' || normalized.startsWith('rcon:') || normalized.endsWith(':rcon');
}

function canViewLogEntry(entry, role) {
  if (!isRconLogSource(entry?.source)) {
    return true;
  }

  return roleAtLeast(role, 'operator');
}

function filterLogEntriesForRole(entries, role) {
  return (entries || []).filter((entry) => canViewLogEntry(entry, role));
}

module.exports = {
  canViewLogEntry,
  filterLogEntriesForRole,
  isRconLogSource
};

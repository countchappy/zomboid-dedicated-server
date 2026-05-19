'use strict';

const ROLES = ['read_only', 'admin', 'operator'];
const ROLE_RANK = {
  read_only: 0,
  admin: 1,
  operator: 2
};

function normalizeRole(value, fallback = 'read_only') {
  const role = String(value || '').trim().toLowerCase();
  return ROLES.includes(role) ? role : fallback;
}

function roleAtLeast(role, minimum) {
  return ROLE_RANK[normalizeRole(role)] >= ROLE_RANK[normalizeRole(minimum)];
}

function firstMatchingRole(groups, roleGroups, fallback = 'admin') {
  const groupSet = new Set((groups || []).map(String));
  if ((roleGroups.operator || []).some((group) => groupSet.has(group))) {
    return 'operator';
  }

  if ((roleGroups.admin || []).some((group) => groupSet.has(group))) {
    return 'admin';
  }

  if ((roleGroups.readOnly || []).some((group) => groupSet.has(group))) {
    return 'read_only';
  }

  return fallback;
}

module.exports = {
  ROLE_RANK,
  ROLES,
  firstMatchingRole,
  normalizeRole,
  roleAtLeast
};

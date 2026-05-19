(function initPortalCommon(root) {
  'use strict';

  const ICONS = {
    'alert-triangle': '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path>',
    check: '<path d="M20 6 9 17l-5-5"></path>',
    circle: '<circle cx="12" cy="12" r="9"></circle>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle>',
    'eye-off': '<path d="m2 2 20 20"></path><path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58"></path><path d="M9.88 5.09A10.66 10.66 0 0 1 12 5c6.5 0 10 7 10 7a18.54 18.54 0 0 1-2.07 3.08"></path><path d="M6.61 6.61C3.7 8.57 2 12 2 12s3.5 7 10 7a10.9 10.9 0 0 0 5.39-1.61"></path>',
    'key-round': '<path d="M2 18v3h3l11.4-11.4"></path><circle cx="15.5" cy="7.5" r="5.5"></circle>',
    'log-in': '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><path d="m10 17 5-5-5-5"></path><path d="M15 12H3"></path>',
    'log-out': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><path d="m16 17 5-5-5-5"></path><path d="M21 12H9"></path>',
    monitor: '<rect width="20" height="14" x="2" y="3" rx="2"></rect><path d="M8 21h8"></path><path d="M12 17v4"></path>',
    moon: '<path d="M12 3a6 6 0 0 0 9 7 9 9 0 1 1-9-7Z"></path>',
    pencil: '<path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>',
    play: '<path d="m5 3 14 9-14 9V3Z"></path>',
    plus: '<path d="M5 12h14"></path><path d="M12 5v14"></path>',
    'refresh-cw': '<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M3 21v-5h5"></path><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M16 8h5V3"></path>',
    'rotate-ccw': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path>',
    search: '<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path>',
    'shield-alert': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.68 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1v7Z"></path><path d="M12 8v4"></path><path d="M12 16h.01"></path>',
    'shield-check': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.68 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1v7Z"></path><path d="m9 12 2 2 4-4"></path>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"></path><path d="M22 2 11 13"></path>',
    square: '<rect width="14" height="14" x="5" y="5" rx="2"></rect>',
    sun: '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path>',
    terminal: '<path d="m4 17 6-6-6-6"></path><path d="M12 19h8"></path>',
    'trash-2': '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
    'x-circle': '<circle cx="12" cy="12" r="10"></circle><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path>'
  };

  async function api(path, options = {}) {
    const response = await fetch(path, {
      headers: {
        'content-type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });

    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok) {
      const message = typeof body === 'object' ? body.message || body.error : body;
      const error = new Error(message || `Request failed with ${response.status}`);
      error.status = response.status;
      error.body = body;
      throw error;
    }

    return body;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function iconSvg(name) {
    const body = ICONS[name] || ICONS.circle;
    return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }

  function renderIconElement(element, name) {
    if (!element) {
      return;
    }
    element.innerHTML = iconSvg(name || element.dataset.icon);
    element.dataset.icon = name || element.dataset.icon;
  }

  function renderIcons(rootElement = document) {
    rootElement.querySelectorAll('[data-icon]').forEach((element) => {
      renderIconElement(element);
    });
  }

  function formatLabel(value) {
    return String(value || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function statusTone(value) {
    if (value === 'running' || value === 'online' || value === 'complete' || value === 'completed' || value === 'enabled' || value === 'ready') {
      return 'success';
    }
    if (value === 'starting' || value === 'stopping' || value === 'started' || value === 'running-prep' || value === 'not-ready') {
      return 'warning';
    }
    if (value === 'errored' || value === 'error' || value === 'failed') {
      return 'danger';
    }
    return 'secondary';
  }

  function setStatusBadge(element, text, tone, stateClass = '') {
    if (!element) {
      return;
    }
    element.textContent = text;
    element.className = ['status-badge', `status-${tone}`, stateClass ? `status-${stateClass}` : '']
      .filter(Boolean)
      .join(' ');
  }

  function setStatusPill(element, textElement, state) {
    if (!element || !textElement) {
      return;
    }
    const normalized = state || 'unknown';
    const tone = statusTone(normalized);
    textElement.textContent = formatLabel(normalized);
    element.className = `status-pill status-${tone} status-${normalized}`;
  }

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

  function applyTheme(choice) {
    const normalized = normalizeThemeChoice(choice);
    document.documentElement.dataset.bsTheme = resolveTheme(normalized, root.matchMedia.bind(root));
    localStorage.setItem('portal-theme', normalized);

    document.querySelectorAll('[data-theme-choice]').forEach((button) => {
      const active = button.dataset.themeChoice === normalized;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function initTheme() {
    applyTheme(localStorage.getItem('portal-theme') || 'system');

    document.querySelectorAll('[data-theme-choice]').forEach((button) => {
      button.addEventListener('click', () => {
        applyTheme(button.dataset.themeChoice);
      });
    });

    root.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (normalizeThemeChoice(localStorage.getItem('portal-theme')) === 'system') {
        applyTheme('system');
      }
    });
  }

  function initTooltips(rootElement = document) {
    if (!root.bootstrap) {
      return;
    }

    rootElement.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((element) => {
      new root.bootstrap.Tooltip(element);
    });
  }

  function initPasswordToggles(rootElement = document) {
    rootElement.querySelectorAll('.password-toggle').forEach((button) => {
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
        const tooltip = root.bootstrap?.Tooltip.getInstance(button);
        tooltip?.setContent({ '.tooltip-inner': label });
      });
    });
  }

  root.PortalCommon = {
    api,
    applyTheme,
    escapeHtml,
    formatLabel,
    iconSvg,
    initPasswordToggles,
    initTheme,
    initTooltips,
    renderIconElement,
    renderIcons,
    setStatusBadge,
    setStatusPill,
    statusTone
  };
})(window);

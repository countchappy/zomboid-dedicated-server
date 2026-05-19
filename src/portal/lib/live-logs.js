'use strict';

const { URL } = require('node:url');
const { WebSocket, WebSocketServer } = require('ws');
const { canViewLogEntry, filterLogEntriesForRole } = require('./log-visibility');

function rejectUpgrade(socket, statusCode, message) {
  socket.write(
    `HTTP/1.1 ${statusCode} ${message}\r\n` +
      'Connection: close\r\n' +
      'Content-Length: 0\r\n' +
      '\r\n'
  );
  socket.destroy();
}

function sendJson(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function attachPzLiveWebSocket(
  server,
  {
    auth,
    controller,
    path = '/api/server/live',
    legacyPaths = ['/api/server/logs/live'],
    logBatchMs = 100,
    initialLogLimit = 400
  }
) {
  const wss = new WebSocketServer({ noServer: true });
  const allowedPaths = new Set([path, ...legacyPaths]);

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '/', 'http://localhost');
    if (!allowedPaths.has(url.pathname)) {
      socket.destroy();
      return;
    }

    const user = auth.getSessionFromRequest(request);
    if (!user) {
      rejectUpgrade(socket, 401, 'Unauthorized');
      return;
    }

    if (user.mustChangePassword) {
      rejectUpgrade(socket, 403, 'Forbidden');
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, user);
    });
  });

  wss.on('connection', (ws, _request, user) => {
    ws.send(JSON.stringify({
      type: 'connected',
      user: {
        username: user.username,
        provider: user.provider
      }
    }));
    ws.send(JSON.stringify({ type: 'status', status: controller.getStatus() }));
    ws.send(JSON.stringify({
      type: 'logs',
      mode: 'replace',
      replace: true,
      entries: filterLogEntriesForRole(controller.getLogs(initialLogLimit), user.role)
    }));

    let logQueue = [];
    let logFlushTimer = null;
    let closed = false;

    const flushLogs = () => {
      logFlushTimer = null;
      if (logQueue.length === 0) {
        return;
      }

      const entries = logQueue;
      logQueue = [];
      sendJson(ws, {
        type: 'logs',
        mode: 'append',
        replace: false,
        entries
      });
    };

    const queueLog = (entry) => {
      if (!canViewLogEntry(entry, user.role)) {
        return;
      }

      logQueue.push(entry);
      if (!logFlushTimer) {
        logFlushTimer = setTimeout(flushLogs, logBatchMs);
      }
    };

    const unsubscribe = controller.subscribeEvents((event) => {
      if (closed || ws.readyState !== WebSocket.OPEN) {
        return;
      }

      if (event.type === 'log') {
        queueLog(event.entry);
        return;
      }

      sendJson(ws, event);
    });

    const cleanup = () => {
      if (closed) {
        return;
      }

      closed = true;
      unsubscribe();
      if (logFlushTimer) {
        clearTimeout(logFlushTimer);
        logFlushTimer = null;
      }
      logQueue = [];
    };

    ws.on('close', cleanup);
    ws.on('error', cleanup);
  });

  return wss;
}

module.exports = {
  attachPzLiveWebSocket,
  attachLiveLogWebSocket: attachPzLiveWebSocket
};

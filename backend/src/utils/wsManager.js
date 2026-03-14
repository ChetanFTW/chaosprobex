const clients = new Map();

const wsManager = {
  register(sessionId, ws) {
    clients.set(sessionId, ws);
    console.log(`[WS] Client connected: ${sessionId}`);
  },

  unregister(sessionId) {
    clients.delete(sessionId);
    console.log(`[WS] Client disconnected: ${sessionId}`);
  },

  send(sessionId, data) {
    const ws = clients.get(sessionId);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(data));
    }
  },

  emit(sessionId, type, payload) {
    this.send(sessionId, { type, payload, timestamp: Date.now() });
  },

  log(sessionId, level, message, meta = {}) {
    this.emit(sessionId, 'log', { level, message, meta, time: new Date().toISOString() });
  }
};

module.exports = { wsManager };

// history.js - simple in-memory history store
const history = [];

function addToHistory(entry) {
  history.unshift(entry);
  if (history.length > 50) history.pop();
}

function getHistory() {
  return history.map(h => ({
    sessionId: h.sessionId,
    url: h.config?.url,
    method: h.config?.method,
    score: h.result?.summary?.score,
    completedAt: h.completedAt
  }));
}

module.exports = { addToHistory, getHistory };

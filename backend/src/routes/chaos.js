const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { runAllChaos } = require('../chaos/engine');
const { addToHistory } = require('../utils/history');

// Active sessions
const sessions = new Map();

// Start a chaos test
router.post('/run', async (req, res) => {
  const { url, method = 'GET', headers = {}, body = null, scenarios = ['latency', 'load', 'fuzz'], timeout = 8000 } = req.body;

  if (!url) return res.status(400).json({ error: 'URL is required' });

  const sessionId = uuidv4();
  sessions.set(sessionId, { status: 'running', startedAt: Date.now() });

  res.json({ sessionId, message: 'Test started. Connect to WS for live updates.' });

  // Run async
  try {
    const config = { url, method, headers, body, scenarios, timeout };
    const result = await runAllChaos(config, sessionId);
    sessions.set(sessionId, { status: 'done', result, startedAt: sessions.get(sessionId)?.startedAt });
    addToHistory({ sessionId, config, result, completedAt: Date.now() });
  } catch (err) {
    sessions.set(sessionId, { status: 'error', error: err.message });
    console.error(`[Session ${sessionId}] Error:`, err);
  }
});

// Get results for a session
router.get('/results/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

// Get session status
router.get('/status/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ status: session.status });
});

module.exports = router;

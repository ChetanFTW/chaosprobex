const express = require('express');
const cors = require('cors');
const expressWs = require('express-ws');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const chaosRoutes = require('./routes/chaos');
const testRoutes = require('./routes/tests');
const historyRoutes = require('./routes/history');
const integrationRoutes = require('./routes/integrations');
const { wsManager } = require('./utils/wsManager');

const app = express();
expressWs(app);

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// WebSocket endpoint for live streaming
app.ws('/ws/:sessionId', (ws, req) => {
  const { sessionId } = req.params;
  wsManager.register(sessionId, ws);
  ws.on('close', () => wsManager.unregister(sessionId));
  ws.on('error', () => wsManager.unregister(sessionId));
  ws.send(JSON.stringify({ type: 'connected', sessionId }));
});

app.use('/api/chaos', chaosRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/integrations', integrationRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', time: Date.now() }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n  ╔═══════════════════════════════════╗`);
  console.log(`  ║   ChaosProbeX Backend v1.0.0      ║`);
  console.log(`  ║   Running on http://localhost:${PORT}  ║`);
  console.log(`  ╚═══════════════════════════════════╝\n`);
});

module.exports = app;

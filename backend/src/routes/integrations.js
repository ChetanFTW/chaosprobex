const express = require('express');
const router = express.Router();
const safedep = require('../integrations/safedep');
const concierge = require('../integrations/concierge');

// ─── STATUS ──────────────────────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  const conciergeStatus = await concierge.ping();
  res.json({
    safedep: {
      configured: safedep.isConfigured(),
      note: safedep.isConfigured()
        ? 'Connected to SafeDep Insights API'
        : 'Set SAFEDEP_API_KEY + SAFEDEP_TENANT_ID in .env to enable',
    },
    concierge: {
      configured: concierge.isConfigured(),
      ...conciergeStatus,
      note: concierge.isConfigured()
        ? `Connected to ${process.env.CONCIERGE_MCP_URL}`
        : 'Set CONCIERGE_MCP_URL in .env to enable',
    },
  });
});

// ─── SAFEDEP ──────────────────────────────────────────────────────────────────

// Scan a single package
router.post('/safedep/scan-package', async (req, res) => {
  const { ecosystem = 'npm', name, version = 'latest' } = req.body;
  if (!name) return res.status(400).json({ error: 'Package name required' });
  try {
    const result = await safedep.getPackageInsight(ecosystem, name, version);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Scan multiple packages
router.post('/safedep/scan-packages', async (req, res) => {
  const { packages } = req.body;
  if (!packages || !Array.isArray(packages)) {
    return res.status(400).json({ error: 'packages array required' });
  }
  try {
    const results = await safedep.scanPackages(packages);
    const summary = safedep._buildScanSummary(results);
    res.json({ packages: results, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Scan packages extracted from a test config (analyzes body JSON for deps)
router.post('/safedep/scan-config', async (req, res) => {
  try {
    const result = await safedep.analyzeTestConfig(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CONCIERGE ───────────────────────────────────────────────────────────────

// List available tools on the Concierge MCP server
router.get('/concierge/tools', async (req, res) => {
  try {
    const tools = await concierge.listTools();
    res.json({ tools, configured: concierge.isConfigured() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Call a specific tool on the Concierge MCP server
router.post('/concierge/call', async (req, res) => {
  const { tool, args = {} } = req.body;
  if (!tool) return res.status(400).json({ error: 'tool name required' });
  try {
    const result = await concierge.callTool(tool, args);
    res.json({ result, configured: concierge.isConfigured() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Analyze a chaos test summary via Concierge AI
router.post('/concierge/analyze', async (req, res) => {
  const { summary, config } = req.body;
  if (!summary) return res.status(400).json({ error: 'summary required' });
  try {
    const result = await concierge.analyzeChaosResult(summary, config);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

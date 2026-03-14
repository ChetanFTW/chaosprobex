/**
 * Concierge (getconcierge.app) Integration
 * Docs: https://getconcierge.app/docs
 *
 * ─── WHAT YOU NEED FROM CONCIERGE ─────────────────────────────────────────────
 * 1. Install the Concierge SDK:  pip install concierge-sdk
 * 2. Run: concierge init --chatgpt  (creates your MCP server skeleton)
 * 3. Run: concierge deploy          (gets you a live URL like https://<name>.getconcierge.app/mcp)
 * 4. Copy that URL → set as CONCIERGE_MCP_URL in .env
 * 5. (Optional) If your server requires auth, set CONCIERGE_API_KEY in .env
 *
 * NOTE: Concierge is a Python SDK + hosting platform. This Node.js file:
 *   - Calls your deployed Concierge MCP server via HTTP
 *   - Sends test results to it as tool inputs
 *   - Receives AI-enhanced analysis back
 *   - Exposes a /api/concierge/* route from ChaosProbeX backend
 * ──────────────────────────────────────────────────────────────────────────────
 */

const axios = require('axios');

class ConciergeService {
  constructor() {
    this.mcpUrl = process.env.CONCIERGE_MCP_URL || '';
    this.apiKey = process.env.CONCIERGE_API_KEY || '';
    this.configured = !!this.mcpUrl;
  }

  isConfigured() {
    return this.configured;
  }

  _headers() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
    return headers;
  }

  /**
   * List all available tools on the Concierge MCP server
   * MCP protocol: POST /mcp with tools/list method
   */
  async listTools() {
    if (!this.configured) return this._mockTools();
    try {
      const res = await axios.post(
        this.mcpUrl,
        { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
        { headers: this._headers(), timeout: 8000 }
      );
      return res.data?.result?.tools || [];
    } catch (err) {
      console.error('[Concierge] listTools error:', err.message);
      return [];
    }
  }

  /**
   * Call a specific tool on the Concierge MCP server
   * @param {string} toolName - e.g. "analyze_chaos_result"
   * @param {object} args     - tool arguments
   */
  async callTool(toolName, args) {
    if (!this.configured) return this._mockToolCall(toolName, args);
    try {
      const res = await axios.post(
        this.mcpUrl,
        {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: { name: toolName, arguments: args }
        },
        { headers: this._headers(), timeout: 15000 }
      );
      const content = res.data?.result?.content;
      if (Array.isArray(content)) {
        return content.map(c => c.text || '').join('\n');
      }
      return JSON.stringify(res.data?.result || {});
    } catch (err) {
      console.error(`[Concierge] callTool(${toolName}) error:`, err.message);
      throw new Error(`Concierge tool call failed: ${err.message}`);
    }
  }

  /**
   * Send a full ChaosProbeX test summary to Concierge for AI analysis
   * Expects your MCP server to expose an "analyze_chaos_result" tool
   */
  async analyzeChaosResult(summary, config) {
    const payload = {
      url: config?.url || 'unknown',
      method: config?.method || 'GET',
      resilience_score: summary?.score ?? 0,
      avg_latency_ms: summary?.avgBaseline ?? 0,
      p95_latency_ms: summary?.p95 ?? 0,
      baseline_success_rate: summary?.baselineSuccess ?? 0,
      breakpoints: (summary?.breakpoints || []).map(b => b.label),
      failures: (summary?.failures || []).map(f => `[${f.severity}] ${f.title}: ${f.fix}`),
      scores: summary?.scores || {},
    };

    if (!this.configured) return this._mockAnalysis(payload);

    try {
      const result = await this.callTool('analyze_chaos_result', payload);
      return { analysis: result, source: 'concierge', configured: true };
    } catch (err) {
      return { analysis: null, error: err.message, source: 'concierge', configured: true };
    }
  }

  /**
   * Ping the MCP server to check connectivity
   */
  async ping() {
    if (!this.configured) return { ok: false, reason: 'CONCIERGE_MCP_URL not set' };
    try {
      const res = await axios.post(
        this.mcpUrl,
        { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'chaosprobex', version: '1.0.0' } } },
        { headers: this._headers(), timeout: 5000 }
      );
      return { ok: true, serverInfo: res.data?.result?.serverInfo || {} };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }

  // ── Mock / demo responses when not configured ──────────────────────────────

  _mockTools() {
    return [
      { name: 'analyze_chaos_result', description: 'Analyze API chaos test results and suggest fixes (mock)' },
      { name: 'get_api_health_report', description: 'Generate an API health report (mock)' },
    ];
  }

  _mockToolCall(toolName, args) {
    return `[Concierge Mock] Tool "${toolName}" called with: ${JSON.stringify(args, null, 2)}\n\nSet CONCIERGE_MCP_URL in .env to connect your real Concierge MCP server.`;
  }

  _mockAnalysis(payload) {
    const score = payload.resilience_score;
    const bps = payload.breakpoints.length;
    return {
      analysis: `[Concierge Demo Mode — set CONCIERGE_MCP_URL to use real AI analysis]

API: ${payload.url}
Resilience Score: ${score}/100

${score < 60 ? '⚠ Your API has significant resilience issues.' : score < 80 ? 'ℹ Your API has moderate resilience. Some improvements needed.' : '✓ Your API is fairly resilient.'}

${bps > 0 ? `Breakpoints detected (${bps}):\n${payload.breakpoints.map(b => `  → ${b}`).join('\n')}` : '✓ No breakpoints detected.'}

${payload.failures.length > 0 ? `Failures:\n${payload.failures.slice(0, 3).map(f => `  → ${f}`).join('\n')}` : ''}

Recommendations:
  1. Connect your Concierge MCP server for AI-powered analysis
  2. Review all breakpoint thresholds above
  3. Run chaos tests after each deployment
`,
      source: 'concierge-mock',
      configured: false,
    };
  }
}

module.exports = new ConciergeService();

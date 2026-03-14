import React, { useState, useEffect } from 'react';
import './IntegrationsPanel.css';

// ─── SafeDep Package Scanner ──────────────────────────────────────────────────
function SafeDepScanner({ testResults }) {
  const [packages, setPackages] = useState('lodash@4.17.11\naxios@0.21.1\nexpress@4.17.1');
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState(null);
  const [status, setStatus] = useState(null);

  const SEV_COLOR = { CRITICAL: '#e63946', HIGH: '#e67e22', MEDIUM: '#f39c12', LOW: '#3498db', UNKNOWN: '#9090a8' };

  async function runScan() {
    setScanning(true);
    setScanResults(null);
    try {
      const pkgList = packages.trim().split('\n').map(line => {
        const [nameVer, eco] = line.trim().split(' ');
        const atIdx = nameVer.lastIndexOf('@');
        const name = atIdx > 0 ? nameVer.slice(0, atIdx) : nameVer;
        const version = atIdx > 0 ? nameVer.slice(atIdx + 1) : 'latest';
        return { name, version, ecosystem: eco || 'npm' };
      }).filter(p => p.name);

      const res = await fetch('/api/integrations/safedep/scan-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packages: pkgList })
      });
      const data = await res.json();
      setScanResults(data);
    } catch (e) {
      setScanResults({ error: e.message });
    }
    setScanning(false);
  }

  useEffect(() => {
    fetch('/api/integrations/status')
      .then(r => r.json())
      .then(d => setStatus(d.safedep))
      .catch(() => {});
  }, []);

  const summary = scanResults?.summary;

  return (
    <div className="integration-card">
      <div className="int-header">
        <div className="int-logo safedep-logo">SD</div>
        <div>
          <div className="int-name">SafeDep</div>
          <div className="int-desc">OSS supply chain vulnerability scanner</div>
        </div>
        <div className={`int-badge ${status?.configured ? 'connected' : 'demo'}`}>
          {status?.configured ? 'live' : 'demo'}
        </div>
      </div>

      {status && !status.configured && (
        <div className="int-notice">
          <span className="notice-icon">ℹ</span>
          Running in demo mode. <a href="https://app.safedep.io" target="_blank" rel="noreferrer">Get API keys</a> and set <code>SAFEDEP_API_KEY</code> + <code>SAFEDEP_TENANT_ID</code> in <code>backend/.env</code>
        </div>
      )}

      <div className="int-section">
        <label className="int-label">Packages to scan <span className="int-sublabel">name@version per line (ecosystem optional)</span></label>
        <textarea
          className="int-textarea"
          rows={5}
          value={packages}
          onChange={e => setPackages(e.target.value)}
          placeholder="lodash@4.17.11&#10;axios@0.21.1 npm&#10;requests@2.31.0 pypi"
          spellCheck={false}
        />
        <button className="int-btn" onClick={runScan} disabled={scanning}>
          {scanning ? '⟳ Scanning...' : 'Scan packages'}
        </button>
      </div>

      {scanResults?.error && (
        <div className="int-error">{scanResults.error}</div>
      )}

      {summary && (
        <div className="int-summary">
          <div className="summary-row">
            <div className={`summary-status s-${summary.status}`}>{summary.status}</div>
            <span className="summary-meta">{summary.total} packages · {summary.totalVulns} vulns · Risk score: {summary.riskScore}/100</span>
          </div>
          {summary.malicious > 0 && (
            <div className="summary-alert">⚠ {summary.malicious} malicious package{summary.malicious > 1 ? 's' : ''} detected!</div>
          )}
        </div>
      )}

      {scanResults?.packages && (
        <div className="pkg-list">
          {scanResults.packages.map((pkg, i) => (
            <div key={i} className={`pkg-row ${pkg.isMalicious ? 'malicious' : pkg.critical > 0 ? 'critical' : pkg.high > 0 ? 'high' : 'ok'}`}>
              <div className="pkg-name">
                {pkg.isMalicious && <span className="pkg-flag malicious-flag">☠ MALICIOUS</span>}
                <span>{pkg.package}</span>
                {pkg.isMock && <span className="pkg-flag mock-flag">mock</span>}
              </div>
              <div className="pkg-vulns">
                {pkg.vulnerabilities?.length === 0 && <span className="vul-none">✓ clean</span>}
                {[['CRITICAL','#e63946'], ['HIGH','#e67e22'], ['MEDIUM','#f39c12'], ['LOW','#3498db']].map(([sev, col]) => {
                  const count = pkg[sev.toLowerCase()] || 0;
                  return count > 0 ? (
                    <span key={sev} className="vul-badge" style={{ background: col + '22', color: col, border: `1px solid ${col}55` }}>
                      {count} {sev}
                    </span>
                  ) : null;
                })}
              </div>
              {pkg.vulnerabilities?.slice(0, 2).map((v, j) => (
                <div key={j} className="vuln-detail">
                  <span className="vuln-id">{v.id}</span>
                  <span className="vuln-summary">{v.summary}</span>
                  {v.cvss && <span className="vuln-cvss">CVSS {v.cvss}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Concierge MCP Panel ──────────────────────────────────────────────────────
function ConciergePanel({ testResults, testConfig }) {
  const [tools, setTools] = useState([]);
  const [status, setStatus] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState('');
  const [customTool, setCustomTool] = useState('');
  const [customArgs, setCustomArgs] = useState('{}');
  const [toolResult, setToolResult] = useState('');
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    fetch('/api/integrations/status')
      .then(r => r.json())
      .then(d => setStatus(d.concierge))
      .catch(() => {});
    fetch('/api/integrations/concierge/tools')
      .then(r => r.json())
      .then(d => {
        setTools(d.tools || []);
        if (d.tools?.length > 0) setCustomTool(d.tools[0].name);
      })
      .catch(() => {});
  }, []);

  async function runAnalysis() {
    if (!testResults) return;
    setAnalyzing(true);
    setAnalysis('');
    try {
      const res = await fetch('/api/integrations/concierge/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: testResults, config: testConfig })
      });
      const data = await res.json();
      setAnalysis(data.analysis || data.error || 'No analysis returned');
    } catch (e) {
      setAnalysis('Error: ' + e.message);
    }
    setAnalyzing(false);
  }

  async function callCustomTool() {
    setCalling(true);
    setToolResult('');
    try {
      let args = {};
      try { args = JSON.parse(customArgs); } catch (_) {}
      const res = await fetch('/api/integrations/concierge/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: customTool, args })
      });
      const data = await res.json();
      setToolResult(data.result || JSON.stringify(data));
    } catch (e) {
      setToolResult('Error: ' + e.message);
    }
    setCalling(false);
  }

  return (
    <div className="integration-card">
      <div className="int-header">
        <div className="int-logo concierge-logo">C</div>
        <div>
          <div className="int-name">Concierge MCP</div>
          <div className="int-desc">AI-powered analysis via your MCP server</div>
        </div>
        <div className={`int-badge ${status?.ok ? 'connected' : status?.configured ? 'error' : 'demo'}`}>
          {status?.ok ? 'live' : status?.configured ? 'error' : 'demo'}
        </div>
      </div>

      {status && !status.configured && (
        <div className="int-notice">
          <span className="notice-icon">ℹ</span>
          Not connected. Run <code>pip install concierge-sdk &amp;&amp; concierge init --chatgpt &amp;&amp; concierge deploy</code>, then set <code>CONCIERGE_MCP_URL</code> in <code>backend/.env</code>. <a href="https://getconcierge.app/docs" target="_blank" rel="noreferrer">Docs ↗</a>
        </div>
      )}

      {status?.ok && (
        <div className="int-notice connected-notice">
          ✓ Connected to <code>{process.env.CONCIERGE_MCP_URL || status?.serverInfo?.name || 'MCP server'}</code>
        </div>
      )}

      {/* Analyze chaos results */}
      <div className="int-section">
        <div className="int-label">Analyze test results with AI</div>
        <p className="int-hint">Sends your last chaos test summary to Concierge for deep AI analysis and fix recommendations.</p>
        <button
          className="int-btn"
          onClick={runAnalysis}
          disabled={analyzing || !testResults}
        >
          {analyzing ? '⟳ Analyzing...' : testResults ? 'Analyze last test ↗' : 'Run a chaos test first'}
        </button>
        {analysis && (
          <pre className="int-output">{analysis}</pre>
        )}
      </div>

      {/* Tool explorer */}
      {tools.length > 0 && (
        <div className="int-section">
          <div className="int-label">MCP tool explorer</div>
          <div className="tool-list">
            {tools.map((t, i) => (
              <div key={i} className={`tool-item ${customTool === t.name ? 'selected' : ''}`} onClick={() => setCustomTool(t.name)}>
                <span className="tool-name">{t.name}</span>
                <span className="tool-desc">{t.description}</span>
              </div>
            ))}
          </div>
          <label className="int-label" style={{ marginTop: 10 }}>Arguments (JSON)</label>
          <textarea
            className="int-textarea"
            rows={3}
            value={customArgs}
            onChange={e => setCustomArgs(e.target.value)}
            spellCheck={false}
          />
          <button className="int-btn" onClick={callCustomTool} disabled={calling || !customTool}>
            {calling ? '⟳ Calling...' : `Call: ${customTool || 'select a tool'}`}
          </button>
          {toolResult && <pre className="int-output">{toolResult}</pre>}
        </div>
      )}
    </div>
  );
}

// ─── Main IntegrationsPanel ──────────────────────────────────────────────────
export default function IntegrationsPanel({ testResults, testConfig }) {
  const [tab, setTab] = useState('safedep');

  return (
    <div className="integrations-panel">
      <div className="int-tabs">
        <button className={`int-tab ${tab === 'safedep' ? 'active' : ''}`} onClick={() => setTab('safedep')}>
          <span className="tab-dot sd-dot" /> SafeDep
        </button>
        <button className={`int-tab ${tab === 'concierge' ? 'active' : ''}`} onClick={() => setTab('concierge')}>
          <span className="tab-dot cp-dot" /> Concierge
        </button>
      </div>
      <div className="int-body">
        {tab === 'safedep' && <SafeDepScanner testResults={testResults} />}
        {tab === 'concierge' && <ConciergePanel testResults={testResults} testConfig={testConfig} />}
      </div>
    </div>
  );
}

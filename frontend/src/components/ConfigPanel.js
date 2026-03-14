import React, { useState } from 'react';
import './ConfigPanel.css';

const SCENARIOS = [
  { id: 'latency', label: 'Latency injection', color: '#f39c12', desc: '10 delay levels 0–5s' },
  { id: 'load',    label: 'Load ramp',          color: '#e63946', desc: '1→100 concurrent rps' },
  { id: 'fuzz',    label: 'Payload fuzzing',    color: '#9b59b6', desc: '15 fuzz cases' },
  { id: 'headers', label: 'Header chaos',       color: '#3498db', desc: '10 header variations' },
  { id: 'timeout', label: 'Timeout flood',      color: '#1abc9c', desc: 'min viable timeout' },
];

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export default function ConfigPanel({ onStart, status }) {
  const [url, setUrl] = useState('https://jsonplaceholder.typicode.com/posts/1');
  const [method, setMethod] = useState('GET');
  const [headers, setHeaders] = useState('{\n  "Content-Type": "application/json"\n}');
  const [body, setBody] = useState('');
  const [scenarios, setScenarios] = useState(['latency', 'load', 'fuzz']);
  const [error, setError] = useState('');

  const toggleScenario = (id) => {
    setScenarios(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const handleRun = async () => {
    setError('');
    if (!url.trim()) return setError('URL is required');

    let parsedHeaders = {};
    try { parsedHeaders = headers.trim() ? JSON.parse(headers) : {}; }
    catch (e) { return setError('Headers: invalid JSON'); }

    try {
      const res = await fetch('/api/chaos/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), method, headers: parsedHeaders, body: body.trim() || null, scenarios })
      });
      const data = await res.json();
      if (data.sessionId) onStart(data.sessionId, { url: url.trim(), method, headers: parsedHeaders, body: body.trim() || null, scenarios });
      else setError(data.error || 'Failed to start test');
    } catch (e) {
      setError('Cannot connect to backend. Is it running on port 4000?');
    }
  };

  const running = status === 'running';

  return (
    <div className="config-panel">
      <div className="config-section">
        <div className="config-label">TARGET API</div>
        <div className="method-url-row">
          <select className="method-select" value={method} onChange={e => setMethod(e.target.value)} disabled={running}>
            {METHODS.map(m => <option key={m}>{m}</option>)}
          </select>
          <input
            className="url-input"
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://api.example.com/endpoint"
            disabled={running}
          />
        </div>
      </div>

      <div className="config-section">
        <div className="config-label">HEADERS <span className="config-sublabel">JSON</span></div>
        <textarea
          className="code-input"
          rows={3}
          value={headers}
          onChange={e => setHeaders(e.target.value)}
          disabled={running}
          spellCheck={false}
        />
      </div>

      {['POST', 'PUT', 'PATCH'].includes(method) && (
        <div className="config-section">
          <div className="config-label">BODY <span className="config-sublabel">JSON</span></div>
          <textarea
            className="code-input"
            rows={3}
            value={body}
            onChange={e => setBody(e.target.value)}
            disabled={running}
            placeholder='{"key": "value"}'
            spellCheck={false}
          />
        </div>
      )}

      <div className="config-section">
        <div className="config-label">CHAOS SCENARIOS</div>
        <div className="scenario-list">
          {SCENARIOS.map(s => (
            <div
              key={s.id}
              className={`scenario-item ${scenarios.includes(s.id) ? 'active' : ''}`}
              onClick={() => !running && toggleScenario(s.id)}
              style={{ '--s-color': s.color }}
            >
              <div className="scenario-check">
                {scenarios.includes(s.id) && <span className="check-mark">✓</span>}
              </div>
              <div className="scenario-info">
                <span className="scenario-name">{s.label}</span>
                <span className="scenario-desc">{s.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="config-error">{error}</div>}

      <div className="config-actions">
        <button
          className="run-btn"
          onClick={handleRun}
          disabled={running || scenarios.length === 0}
        >
          {running ? (
            <><span className="spin">⟳</span> Running...</>
          ) : (
            <> Run Chaos Test</>
          )}
        </button>
      </div>
    </div>
  );
}

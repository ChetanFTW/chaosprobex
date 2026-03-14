import React from 'react';
import './BreakpointPanel.css';

const SEVERITY_COLOR = { critical: '#e63946', warning: '#f39c12', info: '#3498db' };
const TYPE_ICON = { latency: '⚡', load: '🔥', payload: '📦', timeout: '⏱' };

export default function BreakpointPanel({ results, inline = false }) {
  const breakpoints = results?.breakpoints || [];
  const latencyData = results?.latency?.results || [];
  const loadData    = results?.load?.results    || [];

  if (breakpoints.length === 0 && !inline) {
    return (
      <div style={{ padding: 16, color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        ✓ No breakpoints detected. Your API is resilient across all tested scenarios.
      </div>
    );
  }

  return (
    <div className={`bp-panel ${inline ? 'inline' : ''}`}>
      {breakpoints.length === 0 && (
        <div style={{ padding: '12px 0', color: '#2ecc71', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          ✓ No breakpoints detected across all scenarios.
        </div>
      )}

      {breakpoints.map((bp, i) => (
        <div key={i} className="bp-item" style={{ '--bp-color': SEVERITY_COLOR[bp.severity] || '#9090a8' }}>
          <div className="bp-header">
            <span className="bp-icon">{TYPE_ICON[bp.type] || '⚠'}</span>
            <span className="bp-label">{bp.label}</span>
            <span className="bp-severity">{bp.severity}</span>
          </div>
          {bp.type === 'latency' && latencyData.length > 0 && (
            <div className="bp-mini-chart">
              <BreakpointMiniBar data={latencyData} breakpointVal={bp.value} xKey="delay" yKey="duration" />
            </div>
          )}
          {bp.type === 'load' && loadData.length > 0 && (
            <div className="bp-mini-chart">
              <BreakpointMiniBar data={loadData} breakpointVal={bp.value} xKey="concurrency" yKey="errRate" colorByErr />
            </div>
          )}
        </div>
      ))}

      {!inline && (
        <div className="bp-guide">
          <div className="bp-guide-title">How to fix breakpoints</div>
          {breakpoints.map((bp, i) => (
            <BreakpointFix key={i} bp={bp} />
          ))}
        </div>
      )}
    </div>
  );
}

function BreakpointMiniBar({ data, breakpointVal, xKey, yKey, colorByErr }) {
  const max = Math.max(...data.map(d => d[yKey] || 0)) || 1;

  return (
    <div className="mini-bar-chart">
      {data.map((d, i) => {
        const val = d[yKey] || 0;
        const xVal = d[xKey] || 0;
        const isBp = xVal >= breakpointVal;
        const height = Math.round((val / max) * 48);
        const color = colorByErr
          ? (val > 20 ? '#e63946' : val > 5 ? '#f39c12' : '#2ecc71')
          : (d.ok === false ? '#e63946' : '#3498db');

        return (
          <div key={i} className="mini-bar-col" title={`${xKey}=${xVal} ${yKey}=${val}`}>
            <div
              className="mini-bar"
              style={{ height: height + 'px', background: isBp ? '#e63946' : color, opacity: isBp ? 1 : 0.7 }}
            />
            {isBp && i === data.findIndex(d2 => d2[xKey] >= breakpointVal) && (
              <div className="bp-marker">▲</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BreakpointFix({ bp }) {
  const fixes = {
    latency: [
      'Add retry logic with exponential backoff (e.g., axios-retry)',
      'Set aggressive client-side timeouts to fail fast',
      'Implement circuit breaker pattern (e.g., opossum library)',
      'Add response caching for frequently hit endpoints'
    ],
    load: [
      'Add rate limiting middleware (e.g., express-rate-limit)',
      'Implement connection pooling for DB (pg-pool, mongoose poolSize)',
      'Use a queue (Bull, BullMQ) for non-realtime work',
      'Scale horizontally — add more instances behind a load balancer'
    ],
    payload: [
      'Add request body size limits: app.use(express.json({ limit: "1mb" }))',
      'Validate payload schema with Joi or Zod before processing',
      'Return 413 Payload Too Large with a descriptive error'
    ],
    timeout: [
      'Optimize slow DB queries — add indexes, check EXPLAIN output',
      'Add Redis caching for expensive computations',
      'Move heavy work to async background jobs',
      'Increase client timeout to at least 2x the min viable value'
    ]
  };

  const list = fixes[bp.type] || [];
  if (!list.length) return null;

  return (
    <div className="bp-fix-block">
      <div className="bp-fix-type" style={{ color: SEVERITY_COLOR[bp.severity] }}>{bp.label}</div>
      <ul className="bp-fix-list">
        {list.map((f, i) => <li key={i}>{f}</li>)}
      </ul>
    </div>
  );
}

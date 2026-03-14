import React from 'react';
import './ScoreCard.css';

function ScoreRing({ score }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 75 ? '#2ecc71' : score >= 50 ? '#f39c12' : '#e63946';

  return (
    <svg width="96" height="96" viewBox="0 0 96 96">
      <circle cx="48" cy="48" r={r} fill="none" stroke="#1f1f28" strokeWidth="8" />
      <circle
        cx="48" cy="48" r={r} fill="none"
        stroke={color} strokeWidth="8"
        strokeDasharray={`${fill} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 48 48)"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
      <text x="48" y="52" textAnchor="middle" fill={color} fontSize="18" fontWeight="600" fontFamily="'JetBrains Mono', monospace">
        {score}
      </text>
    </svg>
  );
}

export default function ScoreCard({ results }) {
  const { score, avgBaseline, p95, baselineSuccess, scores = {}, breakpoints = [], failures = [] } = results;
  const crits = failures.filter(f => f.severity === 'critical').length;

  const metrics = [
    { label: 'Avg latency',   value: avgBaseline + 'ms', color: avgBaseline > 1000 ? '#e63946' : avgBaseline > 500 ? '#f39c12' : '#2ecc71' },
    { label: 'p95 latency',   value: p95 + 'ms',         color: p95 > 2000 ? '#e63946' : p95 > 1000 ? '#f39c12' : '#2ecc71' },
    { label: 'Baseline rate', value: baselineSuccess + '%', color: baselineSuccess < 90 ? '#e63946' : baselineSuccess < 98 ? '#f39c12' : '#2ecc71' },
    { label: 'Breakpoints',   value: breakpoints.length, color: breakpoints.length > 2 ? '#e63946' : breakpoints.length > 0 ? '#f39c12' : '#2ecc71' },
    { label: 'Critical fails',value: crits,              color: crits > 0 ? '#e63946' : '#2ecc71' },
  ];

  const bars = [
    { label: 'Reliability',    val: scores.reliability   ?? 80, color: '#2ecc71' },
    { label: 'Performance',    val: scores.performance   ?? 80, color: '#3498db' },
    { label: 'Security',       val: scores.security      ?? 80, color: '#9b59b6' },
    { label: 'Fuzz tolerance', val: scores.fuzzTolerance ?? 80, color: '#f39c12' },
    { label: 'Load handling',  val: scores.loadHandling  ?? 80, color: '#e63946' },
  ];

  return (
    <div className="scorecard">
      <div className="scorecard-left">
        <ScoreRing score={score} />
        <div>
          <div className="score-label">Resilience Score</div>
          <div className="score-sublabel">
            {score >= 75 ? '✓ Good' : score >= 50 ? '⚠ Needs work' : '✗ Critical issues'}
          </div>
        </div>
      </div>

      <div className="scorecard-metrics">
        {metrics.map(m => (
          <div key={m.label} className="sc-metric">
            <span className="sc-val" style={{ color: m.color }}>{m.value}</span>
            <span className="sc-lbl">{m.label}</span>
          </div>
        ))}
      </div>

      <div className="scorecard-bars">
        {bars.map(b => (
          <div key={b.label} className="bar-row">
            <span className="bar-label">{b.label}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: Math.min(100, b.val) + '%', background: b.color }} />
            </div>
            <span className="bar-pct" style={{ color: b.color }}>{Math.round(b.val)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

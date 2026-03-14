import React from 'react';

const SEV_COLOR = { critical: '#e63946', warning: '#f39c12', info: '#3498db' };
const SEV_BG    = { critical: 'rgba(230,57,70,0.08)', warning: 'rgba(243,156,18,0.08)', info: 'rgba(52,152,219,0.08)' };

export default function FailureList({ failures = [] }) {
  if (failures.length === 0) {
    return <div style={{ color: '#2ecc71', fontFamily: 'var(--font-mono)', fontSize: 12, padding: 16 }}>✓ No failures detected.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {failures.map((f, i) => (
        <div key={i} style={{
          background: SEV_BG[f.severity] || 'var(--bg3)',
          border: `1px solid ${SEV_COLOR[f.severity] || 'var(--border)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: '12px 14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: SEV_COLOR[f.severity],
              background: `color-mix(in srgb, ${SEV_COLOR[f.severity]} 15%, transparent)`,
              padding: '2px 7px',
              borderRadius: 4
            }}>{f.severity}</span>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>{f.category}</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>{f.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase' }}>Fix: </strong>
            {f.fix}
          </div>
        </div>
      ))}
    </div>
  );
}

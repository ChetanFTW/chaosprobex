import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

export default function FuzzChart({ results }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  const fuzzData = results?.fuzz?.results || [];

  useEffect(() => {
    if (!ref.current || fuzzData.length === 0) return;
    const ctx = ref.current.getContext('2d');

    const labels = fuzzData.map(r => r.label);
    const durations = fuzzData.map(r => r.duration);
    const statusCodes = fuzzData.map(r => r.status || 0);
    const colors = fuzzData.map(r => {
      if (r.ok) return 'rgba(46,204,113,0.7)';
      if (r.category === 'injection') return 'rgba(230,57,70,1)';
      if (r.category === 'size') return 'rgba(230,57,70,0.8)';
      return 'rgba(243,156,18,0.7)';
    });

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Duration (ms)',
          data: durations,
          backgroundColor: colors,
          borderRadius: 3,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const item = fuzzData[ctx.dataIndex];
                return [
                  `Duration: ${ctx.raw}ms`,
                  `Status: ${item?.status || 'ERR'}`,
                  `Result: ${item?.ok ? 'OK' : 'FAIL'}`,
                  `Category: ${item?.category || 'unknown'}`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Duration (ms)', color: '#55556a', font: { size: 10 } },
            ticks: { color: '#55556a', font: { size: 10 } },
            grid: { color: 'rgba(255,255,255,0.04)' }
          },
          y: {
            ticks: { color: '#9090a8', font: { size: 10 }, autoSkip: false },
            grid: { color: 'rgba(255,255,255,0.04)' }
          }
        }
      }
    });
    return () => chartRef.current?.destroy();
  }, [fuzzData.length]);

  if (fuzzData.length === 0) {
    return <div style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 12, padding: 16 }}>No fuzz test data. Enable the fuzz scenario and re-run.</div>;
  }

  const injectionFails = fuzzData.filter(r => r.category === 'injection' && !r.ok);
  const sizeFails = fuzzData.filter(r => r.category === 'size' && !r.ok);

  return (
    <div>
      {injectionFails.length > 0 && (
        <div style={{ background: 'rgba(230,57,70,0.1)', border: '1px solid rgba(230,57,70,0.3)', color: '#e63946', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          ⚠ {injectionFails.length} injection-type payloads caused failures — check input sanitization
        </div>
      )}
      {sizeFails.length > 0 && (
        <div style={{ background: 'rgba(243,156,18,0.1)', border: '1px solid rgba(243,156,18,0.3)', color: '#f39c12', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          ⚠ {sizeFails.length} large payloads failed — no size limit enforced
        </div>
      )}
      <div style={{ position: 'relative', width: '100%', height: Math.max(300, fuzzData.length * 30) + 'px' }}>
        <canvas ref={ref} />
      </div>
      <div style={{ marginTop: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          <thead>
            <tr style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>Payload</th>
              <th style={{ textAlign: 'center', padding: '4px 8px' }}>Category</th>
              <th style={{ textAlign: 'center', padding: '4px 8px' }}>Status</th>
              <th style={{ textAlign: 'center', padding: '4px 8px' }}>Duration</th>
              <th style={{ textAlign: 'center', padding: '4px 8px' }}>Result</th>
            </tr>
          </thead>
          <tbody>
            {fuzzData.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '4px 8px', color: 'var(--text2)' }}>{r.label}</td>
                <td style={{ padding: '4px 8px', textAlign: 'center', color: 'var(--text3)' }}>{r.category}</td>
                <td style={{ padding: '4px 8px', textAlign: 'center' }}>{r.status || 'ERR'}</td>
                <td style={{ padding: '4px 8px', textAlign: 'center', color: 'var(--text2)' }}>{r.duration}ms</td>
                <td style={{ padding: '4px 8px', textAlign: 'center', color: r.ok ? '#2ecc71' : '#e63946' }}>
                  {r.ok ? '✓' : '✗'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

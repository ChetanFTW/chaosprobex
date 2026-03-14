import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

export default function LoadChart({ results, compact = false }) {
  const ref = useRef(null);
  const chartRef = useRef(null);

  const loadData = results?.load?.results || [];
  const breakpoint = results?.load?.breakpoint;

  useEffect(() => {
    if (!ref.current || loadData.length === 0) return;
    const ctx = ref.current.getContext('2d');

    const labels = loadData.map(w => w.concurrency + ' rps');
    const errRates = loadData.map(w => w.errRate);
    const avgDurs  = loadData.map(w => w.avgDur);
    const timeouts = loadData.map(w => w.timeouts || 0);

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Avg latency (ms)',
            data: avgDurs,
            backgroundColor: loadData.map(w => w.errRate > 20 ? 'rgba(230,57,70,0.6)' : w.errRate > 5 ? 'rgba(243,156,18,0.6)' : 'rgba(52,152,219,0.6)'),
            borderRadius: 3,
            yAxisID: 'y',
          },
          {
            label: 'Error rate (%)',
            data: errRates,
            type: 'line',
            borderColor: '#e63946',
            backgroundColor: 'rgba(230,57,70,0.1)',
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: errRates.map(r => r > 20 ? '#e63946' : r > 5 ? '#f39c12' : '#2ecc71'),
            tension: 0.3,
            fill: true,
            yAxisID: 'y2',
          },
          {
            label: 'Timeouts',
            data: timeouts,
            type: 'line',
            borderColor: '#9b59b6',
            borderWidth: 1.5,
            borderDash: [4, 3],
            pointRadius: 3,
            tension: 0.3,
            fill: false,
            yAxisID: 'y2',
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                if (ctx.dataset.label === 'Avg latency (ms)') return `Avg: ${ctx.raw}ms`;
                if (ctx.dataset.label === 'Error rate (%)') return `Errors: ${ctx.raw}%`;
                return `Timeouts: ${ctx.raw}`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#55556a', font: { size: compact ? 9 : 10 } },
            grid: { color: 'rgba(255,255,255,0.04)' }
          },
          y: {
            position: 'left',
            title: { display: !compact, text: 'Latency (ms)', color: '#55556a', font: { size: 10 } },
            ticks: { color: '#3498db', font: { size: 10 } },
            grid: { color: 'rgba(255,255,255,0.04)' },
            min: 0
          },
          y2: {
            position: 'right',
            title: { display: !compact, text: 'Error rate (%)', color: '#55556a', font: { size: 10 } },
            ticks: { color: '#e63946', font: { size: 10 } },
            grid: { display: false },
            min: 0,
            max: 100
          }
        }
      }
    });

    return () => chartRef.current?.destroy();
  }, [loadData.length]);

  if (loadData.length === 0) {
    return <div style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 12, padding: 16 }}>No load test data. Enable the load scenario and re-run.</div>;
  }

  return (
    <div>
      {!compact && breakpoint && (
        <div style={{ background: 'rgba(230,57,70,0.1)', border: '1px solid rgba(230,57,70,0.3)', color: '#e63946', borderRadius: 6, padding: '6px 10px', marginBottom: 10, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          ⚠ Load breakpoint: API degrades beyond <strong>{breakpoint} concurrent requests</strong>
        </div>
      )}
      {!compact && !breakpoint && (
        <div style={{ background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.3)', color: '#2ecc71', borderRadius: 6, padding: '6px 10px', marginBottom: 10, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          ✓ No load breakpoint — API handled all concurrency levels
        </div>
      )}
      <div style={{ position: 'relative', width: '100%', height: compact ? '160px' : '280px' }}>
        <canvas ref={ref} />
      </div>
      {!compact && (
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>
          <span><span style={{ background: 'rgba(52,152,219,0.6)', display: 'inline-block', width: 10, height: 10, borderRadius: 2, marginRight: 4 }}></span>Avg latency</span>
          <span><span style={{ background: '#e63946', display: 'inline-block', width: 10, height: 4, borderRadius: 1, marginRight: 4, verticalAlign: 'middle' }}></span>Error rate %</span>
          <span><span style={{ background: '#9b59b6', display: 'inline-block', width: 10, height: 4, borderRadius: 1, marginRight: 4, verticalAlign: 'middle' }}></span>Timeouts</span>
        </div>
      )}
    </div>
  );
}

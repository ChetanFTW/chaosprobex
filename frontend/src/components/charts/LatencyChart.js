import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

export default function LatencyChart({ results, compact = false }) {
  const ref = useRef(null);
  const chartRef = useRef(null);

  const latencyData = results?.latency?.results || [];
  const breakpoint = results?.latency?.breakpoint;

  useEffect(() => {
    if (!ref.current || latencyData.length === 0) return;
    const ctx = ref.current.getContext('2d');

    const labels = latencyData.map(r => (r.delay ?? 0) + 'ms');
    const durations = latencyData.map(r => r.duration);
    const colors = latencyData.map(r => r.ok ? 'rgba(52,152,219,0.8)' : 'rgba(230,57,70,0.9)');
    const bpIdx = breakpoint !== null && breakpoint !== undefined
      ? latencyData.findIndex(r => r.delay >= breakpoint)
      : -1;

    const annotations = {};
    if (bpIdx >= 0) {
      annotations.bpLine = {
        type: 'line',
        xMin: bpIdx,
        xMax: bpIdx,
        borderColor: '#e63946',
        borderWidth: 2,
        borderDash: [4, 3],
        label: {
          content: `⚠ Breakpoint: ${breakpoint}ms`,
          display: true,
          position: 'start',
          color: '#e63946',
          font: { size: 10, family: 'JetBrains Mono' },
          backgroundColor: 'rgba(230,57,70,0.1)',
          padding: 4
        }
      };
    }

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Response time (ms)',
            data: durations,
            backgroundColor: colors,
            borderRadius: 3,
          },
          {
            label: 'Trend',
            data: durations,
            type: 'line',
            borderColor: '#f39c12',
            borderWidth: 1.5,
            pointRadius: 2,
            tension: 0.4,
            fill: false,
            backgroundColor: 'transparent',
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
              label: ctx => `${ctx.dataset.label}: ${ctx.raw}ms`
            }
          },
          annotation: Object.keys(annotations).length > 0 ? { annotations } : undefined
        },
        scales: {
          x: {
            title: { display: !compact, text: 'Injected delay', color: '#55556a', font: { size: 10 } },
            ticks: { color: '#55556a', font: { size: compact ? 9 : 10 } },
            grid: { color: 'rgba(255,255,255,0.04)' }
          },
          y: {
            title: { display: !compact, text: 'Actual response (ms)', color: '#55556a', font: { size: 10 } },
            ticks: { color: '#55556a', font: { size: 10 } },
            grid: { color: 'rgba(255,255,255,0.04)' },
            min: 0
          }
        }
      }
    });

    return () => chartRef.current?.destroy();
  }, [latencyData.length]);

  if (latencyData.length === 0) {
    return <div style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 12, padding: 16 }}>No latency test data. Enable the latency scenario and re-run.</div>;
  }

  return (
    <div>
      {!compact && breakpoint !== null && breakpoint !== undefined && (
        <div className="chart-annotation-badge" style={{ background: 'rgba(230,57,70,0.1)', border: '1px solid rgba(230,57,70,0.3)', color: '#e63946', borderRadius: 6, padding: '6px 10px', marginBottom: 10, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          ⚠ Breakpoint detected: API starts failing at <strong>{breakpoint}ms</strong> injected delay
        </div>
      )}
      {!compact && breakpoint === null && (
        <div style={{ background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.3)', color: '#2ecc71', borderRadius: 6, padding: '6px 10px', marginBottom: 10, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          ✓ No latency breakpoint — API survived all delay levels
        </div>
      )}
      <div style={{ position: 'relative', width: '100%', height: compact ? '160px' : '260px' }}>
        <canvas ref={ref} />
      </div>
      {!compact && (
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>
          <span><span style={{ background: 'rgba(52,152,219,0.8)', display: 'inline-block', width: 10, height: 10, borderRadius: 2, marginRight: 4 }}></span>Success</span>
          <span><span style={{ background: 'rgba(230,57,70,0.9)', display: 'inline-block', width: 10, height: 10, borderRadius: 2, marginRight: 4 }}></span>Failure</span>
          <span><span style={{ background: '#f39c12', display: 'inline-block', width: 10, height: 4, borderRadius: 1, marginRight: 4, verticalAlign: 'middle' }}></span>Trend</span>
        </div>
      )}
    </div>
  );
}

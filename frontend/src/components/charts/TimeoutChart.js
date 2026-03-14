import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

export default function TimeoutChart({ results }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  const timeoutData = results?.timeout?.results || [];
  const minViable = results?.timeout?.minViable;

  useEffect(() => {
    if (!ref.current || timeoutData.length === 0) return;
    const ctx = ref.current.getContext('2d');

    const labels = timeoutData.map(r => r.timeoutSetting + 'ms');
    const actual  = timeoutData.map(r => r.duration);
    const success = timeoutData.map(r => r.ok ? 1 : 0);

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Actual duration (ms)',
            data: actual,
            borderColor: '#3498db',
            backgroundColor: 'rgba(52,152,219,0.1)',
            borderWidth: 2,
            pointRadius: 5,
            pointBackgroundColor: timeoutData.map(r => r.timedOut ? '#e63946' : r.ok ? '#2ecc71' : '#f39c12'),
            tension: 0.3,
            fill: true,
            yAxisID: 'y',
          },
          {
            label: 'Success (1=ok)',
            data: success,
            borderColor: '#2ecc71',
            borderWidth: 1.5,
            borderDash: [4, 3],
            pointRadius: 3,
            tension: 0,
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
              label: (ctx) => {
                const item = timeoutData[ctx.dataIndex];
                if (ctx.dataset.label === 'Success (1=ok)') return null;
                return [
                  `Timeout limit: ${item?.timeoutSetting}ms`,
                  `Actual: ${item?.duration}ms`,
                  item?.timedOut ? '⚡ TIMED OUT' : `HTTP ${item?.status}`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Timeout setting (ms)', color: '#55556a', font: { size: 10 } },
            ticks: { color: '#55556a', font: { size: 10 } },
            grid: { color: 'rgba(255,255,255,0.04)' }
          },
          y: {
            position: 'left',
            title: { display: true, text: 'Actual duration (ms)', color: '#55556a', font: { size: 10 } },
            ticks: { color: '#3498db', font: { size: 10 } },
            grid: { color: 'rgba(255,255,255,0.04)' },
            min: 0
          },
          y2: {
            position: 'right',
            title: { display: true, text: 'Success', color: '#55556a', font: { size: 10 } },
            ticks: { color: '#2ecc71', font: { size: 10 }, stepSize: 1 },
            grid: { display: false },
            min: 0, max: 1.2
          }
        }
      }
    });
    return () => chartRef.current?.destroy();
  }, [timeoutData.length]);

  if (timeoutData.length === 0) {
    return <div style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 12, padding: 16 }}>No timeout test data. Enable the timeout scenario and re-run.</div>;
  }

  return (
    <div>
      {minViable && (
        <div style={{ background: 'rgba(52,152,219,0.1)', border: '1px solid rgba(52,152,219,0.3)', color: '#3498db', borderRadius: 6, padding: '6px 10px', marginBottom: 10, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          ℹ Minimum viable timeout: <strong>{minViable}ms</strong> — set your client timeout at least 2x this value
        </div>
      )}
      <div style={{ position: 'relative', width: '100%', height: '280px' }}>
        <canvas ref={ref} />
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#2ecc71', marginRight: 4 }}></span>Success</span>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#e63946', marginRight: 4 }}></span>Timed out</span>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#f39c12', marginRight: 4 }}></span>Error</span>
      </div>
    </div>
  );
}

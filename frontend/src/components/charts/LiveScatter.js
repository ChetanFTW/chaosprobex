import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

const PHASE_COLORS = {
  baseline: '#3498db',
  latency:  '#f39c12',
  load:     '#e63946',
  fuzz:     '#9b59b6',
  headers:  '#1abc9c',
  timeout:  '#e67e22',
};

export default function LiveScatter({ points = [], height = 260 }) {
  const ref = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const ctx = ref.current.getContext('2d');

    chartRef.current = new Chart(ctx, {
      type: 'scatter',
      data: { datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.raw.phase || ''} · ${ctx.raw.y}ms · HTTP ${ctx.raw.status || 'ERR'}`
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Request #', color: '#55556a', font: { size: 10 } },
            ticks: { color: '#55556a', font: { size: 10 } },
            grid: { color: 'rgba(255,255,255,0.04)' },
          },
          y: {
            title: { display: true, text: 'Duration (ms)', color: '#55556a', font: { size: 10 } },
            ticks: { color: '#55556a', font: { size: 10 } },
            grid: { color: 'rgba(255,255,255,0.04)' },
            min: 0,
          }
        }
      }
    });

    return () => chartRef.current?.destroy();
  }, []);

  useEffect(() => {
    if (!chartRef.current || points.length === 0) return;

    // Group by phase
    const byPhase = {};
    points.forEach((p, i) => {
      const phase = p.phase || 'baseline';
      if (!byPhase[phase]) byPhase[phase] = [];
      byPhase[phase].push({
        x: i,
        y: Math.round(p.duration || p.avgDur || 0),
        status: p.status,
        phase,
        ok: p.ok
      });
    });

    chartRef.current.data.datasets = Object.entries(byPhase).map(([phase, pts]) => ({
      label: phase,
      data: pts,
      backgroundColor: pts.map(p => p.ok
        ? (PHASE_COLORS[phase] || '#3498db') + 'cc'
        : '#e63946cc'
      ),
      pointRadius: 4,
      pointHoverRadius: 6,
    }));

    // Breakpoint annotations: vertical lines where failures spike
    const failX = points.map((p, i) => (!p.ok ? i : null)).filter(x => x !== null);
    if (failX.length > 0) {
      // Draw failure band overlay as dataset
      const existingBands = chartRef.current.data.datasets.find(d => d.label === '__failures');
      if (!existingBands) {
        chartRef.current.data.datasets.push({
          label: '__failures',
          data: failX.map(x => ({ x, y: 0 })),
          backgroundColor: 'rgba(230,57,70,0.15)',
          pointRadius: 0,
          type: 'bar',
          barThickness: 2,
          yAxisID: 'y',
        });
      }
    }

    chartRef.current.update('none');
  }, [points]);

  return (
    <div style={{ position: 'relative', height: height + 'px', width: '100%' }}>
      <canvas ref={ref} />
    </div>
  );
}

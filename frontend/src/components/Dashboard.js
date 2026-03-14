import React, { useState } from 'react';
import ScoreCard from './ScoreCard';
import LatencyChart from './charts/LatencyChart';
import LoadChart from './charts/LoadChart';
import FuzzChart from './charts/FuzzChart';
import TimeoutChart from './charts/TimeoutChart';
import BreakpointPanel from './BreakpointPanel';
import FailureList from './FailureList';
import LiveScatter from './charts/LiveScatter';
import './Dashboard.css';

const TABS = ['overview', 'latency', 'load', 'fuzz', 'timeout', 'breakpoints', 'failures'];

export default function Dashboard({ status, results, livePoints, progress }) {
  const [tab, setTab] = useState('overview');

  if (status === 'idle') {
    return (
      <div className="dashboard-empty">
        <div className="empty-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" stroke="#1f1f28" strokeWidth="2"/>
            <circle cx="24" cy="24" r="12" stroke="#2a2a38" strokeWidth="1.5" strokeDasharray="4 3"/>
            <path d="M20 24L24 20L28 24L24 28Z" fill="#2a2a38"/>
            <circle cx="24" cy="24" r="3" fill="#1f1f28"/>
          </svg>
        </div>
        <p className="empty-title">No test running</p>
        <p className="empty-sub">Configure your API and select chaos scenarios, then hit Run.</p>
      </div>
    );
  }

  if (status === 'running' && !results) {
    return (
      <div className="dashboard-running">
        <div className="running-header">
          <span className="running-label">Live data stream</span>
          <span className="running-pct">{progress.pct}%</span>
        </div>
        <LiveScatter points={livePoints} />
        <div className="running-stats">
          <div className="rstat">
            <span className="rstat-val">{livePoints.length}</span>
            <span className="rstat-lbl">requests sent</span>
          </div>
          <div className="rstat">
            <span className="rstat-val" style={{ color: '#2ecc71' }}>
              {livePoints.filter(p => p.ok).length}
            </span>
            <span className="rstat-lbl">successful</span>
          </div>
          <div className="rstat">
            <span className="rstat-val" style={{ color: '#e63946' }}>
              {livePoints.filter(p => !p.ok).length}
            </span>
            <span className="rstat-lbl">failed</span>
          </div>
          <div className="rstat">
            <span className="rstat-val">
              {livePoints.length
                ? Math.round(livePoints.reduce((a, b) => a + (b.duration || 0), 0) / livePoints.length)
                : 0}ms
            </span>
            <span className="rstat-lbl">avg latency</span>
          </div>
        </div>
      </div>
    );
  }

  if (!results) return null;

  return (
    <div className="dashboard">
      {/* Score row */}
      <ScoreCard results={results} />

      {/* Tab nav */}
      <div className="dash-tabs">
        {TABS.map(t => (
          <button key={t} className={`dash-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="dash-content">
        {tab === 'overview'    && <OverviewTab results={results} livePoints={livePoints} />}
        {tab === 'latency'     && <LatencyChart results={results} />}
        {tab === 'load'        && <LoadChart results={results} />}
        {tab === 'fuzz'        && <FuzzChart results={results} />}
        {tab === 'timeout'     && <TimeoutChart results={results} />}
        {tab === 'breakpoints' && <BreakpointPanel results={results} />}
        {tab === 'failures'    && <FailureList failures={results.failures || []} />}
      </div>
    </div>
  );
}

function OverviewTab({ results, livePoints }) {
  return (
    <div className="overview-grid">
      <div className="chart-card full-width">
        <div className="chart-card-title">Response latency — all requests (live scatter)</div>
        <LiveScatter points={livePoints} height={200} />
      </div>
      <div className="chart-card">
        <div className="chart-card-title">Latency injection curve</div>
        <LatencyChart results={results} compact />
      </div>
      <div className="chart-card">
        <div className="chart-card-title">Load ramp error rate</div>
        <LoadChart results={results} compact />
      </div>
      <div className="chart-card full-width">
        <div className="chart-card-title">Breakpoints detected</div>
        <BreakpointPanel results={results} inline />
      </div>
    </div>
  );
}

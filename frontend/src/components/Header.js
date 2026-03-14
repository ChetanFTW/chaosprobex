import React from 'react';
import './Header.css';

export default function Header({ status, progress, rightPanel, setRightPanel }) {
  return (
    <header className="header">
      <div className="header-logo">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle cx="11" cy="11" r="9" stroke="#e63946" strokeWidth="1.5"/>
          <path d="M8 11L11 8L14 11L11 14Z" fill="#e63946"/>
          <circle cx="11" cy="11" r="2" fill="#0a0a0f"/>
          <circle cx="11" cy="11" r="0.8" fill="#e63946"/>
        </svg>
        <span className="header-brand">ChaosProbeX</span>
        <span className="header-version">v1.0</span>
      </div>
      <div className="header-center">
        {status === 'running' && (
          <div className="header-progress">
            <div className="progress-track">
              <div className="progress-bar-fill" style={{ width: progress.pct + '%' }} />
            </div>
            <span className="progress-label">{progress.label}</span>
            <span className="progress-pct">{progress.pct}%</span>
          </div>
        )}
      </div>
      <div className="header-right">
        {setRightPanel && (
          <div className="header-nav">
            <button
              className={`nav-btn ${rightPanel === 'dashboard' ? 'active' : ''}`}
              onClick={() => setRightPanel('dashboard')}
            >Dashboard</button>
            <button
              className={`nav-btn ${rightPanel === 'integrations' ? 'active' : ''}`}
              onClick={() => setRightPanel('integrations')}
            >
              <span className="nav-dots">
                <span className="ndot sd" />
                <span className="ndot cp" />
              </span>
              Integrations
            </button>
          </div>
        )}
        <span className={`status-dot status-${status}`} />
        <span className="status-text">{status}</span>
      </div>
    </header>
  );
}

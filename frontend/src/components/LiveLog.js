import React, { useEffect, useRef } from 'react';
import './LiveLog.css';

const LEVEL_COLOR = {
  ok:    '#2ecc71',
  info:  '#3498db',
  warn:  '#f39c12',
  error: '#e63946',
};

export default function LiveLog({ logs }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="livelog">
      <div className="livelog-header">
        <span className="livelog-title">LIVE LOG</span>
        <span className="livelog-count">{logs.length} entries</span>
      </div>
      <div className="livelog-body">
        {logs.length === 0 && (
          <div className="livelog-empty">Waiting for test to start...</div>
        )}
        {logs.map((log, i) => (
          <div key={i} className="log-line">
            <span className="log-ts">{log.time?.slice(11, 19) || ''}</span>
            <span className="log-msg" style={{ color: LEVEL_COLOR[log.level] || '#9090a8' }}>
              {log.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

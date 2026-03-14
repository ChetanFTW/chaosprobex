import React, { useState, useCallback } from 'react';
import ConfigPanel from './components/ConfigPanel';
import Dashboard from './components/Dashboard';
import LiveLog from './components/LiveLog';
import Header from './components/Header';
import IntegrationsPanel from './components/IntegrationsPanel';
import './App.css';

export default function App() {
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | running | done | error
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState({ pct: 0, label: '' });
  const [results, setResults] = useState(null);
  const [livePoints, setLivePoints] = useState([]);
  const [testConfig, setTestConfig] = useState(null);
  const [rightPanel, setRightPanel] = useState('dashboard'); // dashboard | integrations

  const addLog = useCallback((log) => {
    setLogs(prev => [...prev.slice(-200), log]);
  }, []);

  const handleTestStart = useCallback((sid, cfg) => {
    setSessionId(sid);
    setStatus('running');
    setLogs([]);
    setResults(null);
    setLivePoints([]);
    setProgress({ pct: 0, label: 'Connecting...' });
    if (cfg) setTestConfig(cfg);

    const ws = new WebSocket(`ws://localhost:4000/ws/${sid}`);

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'log') {
        addLog(msg.payload);
      } else if (msg.type === 'progress') {
        setProgress(msg.payload);
      } else if (msg.type === 'result') {
        setLivePoints(prev => [...prev, { ...msg.payload, ts: Date.now() }]);
      } else if (msg.type === 'summary') {
        setResults(msg.payload);
        setStatus('done');
      }
    };

    ws.onerror = () => {
      setStatus('error');
      addLog({ level: 'error', message: 'WebSocket connection failed', time: new Date().toISOString() });
    };
  }, [addLog]);

  return (
    <div className="app-layout">
      <Header status={status} progress={progress} rightPanel={rightPanel} setRightPanel={setRightPanel} />
      <div className="app-body">
        <aside className="app-sidebar">
          <ConfigPanel onStart={handleTestStart} status={status} />
          <LiveLog logs={logs} />
        </aside>
        <main className="app-main">
          {rightPanel === 'integrations' ? (
            <IntegrationsPanel testResults={results} testConfig={testConfig} />
          ) : (
            <Dashboard
              status={status}
              results={results}
              livePoints={livePoints}
              progress={progress}
            />
          )}
        </main>
      </div>
    </div>
  );
}

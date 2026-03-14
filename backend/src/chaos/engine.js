const axios = require('axios');
const { wsManager } = require('../utils/wsManager');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeRequest(url, method, headers, body, timeoutMs = 8000) {
  const start = Date.now();
  try {
    const response = await axios({
      method: method.toLowerCase(),
      url,
      headers,
      data: ['get', 'head', 'delete'].includes(method.toLowerCase()) ? undefined : body,
      timeout: timeoutMs,
      validateStatus: () => true,
      maxRedirects: 3
    });
    const duration = Date.now() - start;
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      duration,
      size: JSON.stringify(response.data || '').length,
      headers: response.headers,
      timedOut: false,
      error: null
    };
  } catch (err) {
    const duration = Date.now() - start;
    const isTimeout = err.code === 'ECONNABORTED' || err.message.includes('timeout');
    const isConnErr = err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND';
    return {
      ok: false,
      status: isTimeout ? 0 : isConnErr ? -1 : 0,
      duration,
      size: 0,
      timedOut: isTimeout,
      connectionError: isConnErr,
      error: err.message
    };
  }
}

// ─── BASELINE TEST ─────────────────────────────────────────────────────────────
async function runBaseline(config, sessionId) {
  const { url, method, headers, body } = config;
  const results = [];

  wsManager.log(sessionId, 'info', '▶ Baseline test starting (10 requests)');

  for (let i = 0; i < 10; i++) {
    const r = await makeRequest(url, method, headers, body);
    results.push({ seq: i + 1, ...r, phase: 'baseline' });
    wsManager.emit(sessionId, 'result', { phase: 'baseline', seq: i + 1, ...r });
    wsManager.log(sessionId, r.ok ? 'ok' : 'error',
      `  Baseline [${i + 1}/10]: ${r.status || 'ERR'} — ${r.duration}ms`);
    await sleep(200);
  }

  const avg = Math.round(results.reduce((a, b) => a + b.duration, 0) / results.length);
  const successRate = Math.round((results.filter(r => r.ok).length / results.length) * 100);
  wsManager.log(sessionId, 'info', `  Baseline done — avg ${avg}ms, ${successRate}% success`);
  return { results, avg, successRate };
}

// ─── LATENCY INJECTION ──────────────────────────────────────────────────────────
async function runLatencyTest(config, sessionId) {
  const { url, method, headers, body } = config;
  const results = [];
  const delays = [0, 100, 300, 600, 1000, 1500, 2000, 3000, 4000, 5000];

  wsManager.log(sessionId, 'warn', '⚡ Latency injection test starting');

  for (const delay of delays) {
    await sleep(delay);
    const r = await makeRequest(url, method, headers, body, 8000);
    const point = { delay, ...r, phase: 'latency' };
    results.push(point);
    wsManager.emit(sessionId, 'result', point);
    wsManager.log(sessionId, r.ok ? 'ok' : 'warn',
      `  Latency [delay=${delay}ms]: ${r.status || 'ERR'} — actual=${r.duration}ms`);
  }

  // Find breakpoint where failures start
  let breakpoint = null;
  for (const r of results) {
    if (!r.ok && breakpoint === null) {
      breakpoint = r.delay;
    }
  }
  if (breakpoint !== null) {
    wsManager.log(sessionId, 'error', `  ⚠ Latency breakpoint detected at ${breakpoint}ms delay`);
  }
  return { results, breakpoint };
}

// ─── LOAD TEST ─────────────────────────────────────────────────────────────────
async function runLoadTest(config, sessionId) {
  const { url, method, headers, body } = config;
  const waves = [1, 5, 10, 20, 30, 50, 75, 100];
  const waveResults = [];

  wsManager.log(sessionId, 'warn', '🔥 Load test starting — ramping up concurrency');

  for (const concurrency of waves) {
    const batch = Array.from({ length: concurrency }, () =>
      makeRequest(url, method, headers, body, 6000)
    );
    const settled = await Promise.allSettled(batch);
    const batchResults = settled.map(s => s.status === 'fulfilled' ? s.value : { ok: false, status: -1, duration: 6000, timedOut: true });

    const successes = batchResults.filter(r => r.ok).length;
    const avgDur = Math.round(batchResults.reduce((a, b) => a + b.duration, 0) / batchResults.length);
    const errRate = Math.round(((concurrency - successes) / concurrency) * 100);
    const timeouts = batchResults.filter(r => r.timedOut).length;

    const wave = { concurrency, successes, errRate, avgDur, timeouts, results: batchResults, phase: 'load' };
    waveResults.push(wave);
    wsManager.emit(sessionId, 'result', wave);
    wsManager.log(sessionId, errRate > 20 ? 'error' : errRate > 5 ? 'warn' : 'ok',
      `  Load [${concurrency} rps]: ${successes}/${concurrency} ok, err=${errRate}%, avg=${avgDur}ms`);

    await sleep(500);
  }

  // Find concurrency breakpoint
  let breakpoint = null;
  for (const w of waveResults) {
    if (w.errRate > 15 && breakpoint === null) {
      breakpoint = w.concurrency;
    }
  }
  if (breakpoint) wsManager.log(sessionId, 'error', `  ⚠ Load breakpoint: fails at ${breakpoint} concurrent requests`);
  return { results: waveResults, breakpoint };
}

// ─── PAYLOAD FUZZ TEST ─────────────────────────────────────────────────────────
async function runFuzzTest(config, sessionId) {
  const { url, method, headers } = config;
  const results = [];

  wsManager.log(sessionId, 'warn', '🎲 Payload fuzzing starting');

  const payloads = [
    { label: 'Valid payload',    body: config.body || '{}', category: 'normal' },
    { label: 'Null body',        body: null,                              category: 'null' },
    { label: 'Empty string',     body: '',                                category: 'empty' },
    { label: 'Empty object',     body: '{}',                              category: 'empty' },
    { label: 'Large payload',    body: JSON.stringify({ data: 'X'.repeat(100000) }), category: 'size' },
    { label: 'Very large payload', body: JSON.stringify({ data: 'X'.repeat(500000) }), category: 'size' },
    { label: 'Invalid JSON',     body: '{invalid: json}',                 category: 'malformed' },
    { label: 'Array body',       body: '[1,2,3]',                         category: 'type' },
    { label: 'Deep nested',      body: JSON.stringify({ a: { b: { c: { d: { e: { f: 'deep' } } } } } }), category: 'structure' },
    { label: 'SQL injection',    body: JSON.stringify({ id: "1; DROP TABLE users;" }), category: 'injection' },
    { label: 'XSS payload',      body: JSON.stringify({ name: '<script>alert(1)</script>' }), category: 'injection' },
    { label: 'Unicode bombs',    body: JSON.stringify({ text: '𝕳𝖊𝖑𝖑𝖔'.repeat(1000) }), category: 'encoding' },
    { label: 'Negative numbers', body: JSON.stringify({ id: -999999 }),   category: 'boundary' },
    { label: 'Zero values',      body: JSON.stringify({ count: 0, id: 0 }), category: 'boundary' },
    { label: 'Boolean as string',body: JSON.stringify({ active: 'true' }), category: 'type' },
  ];

  for (const p of payloads) {
    const r = await makeRequest(url, method, headers, p.body, 5000);
    const point = { ...p, ...r, phase: 'fuzz' };
    results.push(point);
    wsManager.emit(sessionId, 'result', point);
    wsManager.log(sessionId, r.ok ? 'ok' : 'warn',
      `  Fuzz [${p.label}]: ${r.status || 'ERR'} ${r.duration}ms`);
    await sleep(150);
  }

  return { results };
}

// ─── HEADER CHAOS TEST ─────────────────────────────────────────────────────────
async function runHeaderTest(config, sessionId) {
  const { url, method, body } = config;
  const baseHeaders = config.headers || {};
  const results = [];

  wsManager.log(sessionId, 'warn', '🔑 Header chaos test starting');

  const variations = [
    { label: 'All headers (baseline)', headers: baseHeaders },
    { label: 'No Authorization',       headers: { ...baseHeaders, Authorization: undefined } },
    { label: 'No Content-Type',        headers: { ...baseHeaders, 'Content-Type': undefined } },
    { label: 'Malformed Auth token',   headers: { ...baseHeaders, Authorization: 'BadToken123' } },
    { label: 'Empty Authorization',    headers: { ...baseHeaders, Authorization: '' } },
    { label: 'Expired Bearer',         headers: { ...baseHeaders, Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired.sig' } },
    { label: 'No headers at all',      headers: {} },
    { label: 'Extra junk headers',     headers: { ...baseHeaders, 'X-Chaos': 'true', 'X-Override-Auth': 'admin', 'X-Admin': '1' } },
    { label: 'Wrong Content-Type',     headers: { ...baseHeaders, 'Content-Type': 'text/plain' } },
    { label: 'Accept: nothing',        headers: { ...baseHeaders, 'Accept': 'application/x-chaos' } },
  ];

  for (const v of variations) {
    const cleanHeaders = Object.fromEntries(Object.entries(v.headers).filter(([, val]) => val !== undefined));
    const r = await makeRequest(url, method, cleanHeaders, body, 5000);
    const point = { ...v, headers: cleanHeaders, ...r, phase: 'headers' };
    results.push(point);
    wsManager.emit(sessionId, 'result', point);
    wsManager.log(sessionId, r.ok ? 'ok' : 'warn',
      `  Header [${v.label}]: ${r.status || 'ERR'} ${r.duration}ms`);
    await sleep(150);
  }

  return { results };
}

// ─── TIMEOUT FLOOD ────────────────────────────────────────────────────────────
async function runTimeoutTest(config, sessionId) {
  const { url, method, headers, body } = config;
  const results = [];
  const timeouts = [100, 200, 500, 800, 1000, 1500, 2000, 3000, 5000];

  wsManager.log(sessionId, 'warn', '⏱  Timeout flood test starting');

  for (const t of timeouts) {
    const r = await makeRequest(url, method, headers, body, t);
    const point = { timeoutSetting: t, ...r, phase: 'timeout' };
    results.push(point);
    wsManager.emit(sessionId, 'result', point);
    wsManager.log(sessionId, r.timedOut ? 'error' : r.ok ? 'ok' : 'warn',
      `  Timeout [limit=${t}ms]: ${r.timedOut ? 'TIMED OUT' : r.status} — actual ${r.duration}ms`);
    await sleep(200);
  }

  // Find minimum viable timeout
  const minViable = results.find(r => r.ok)?.timeoutSetting ?? null;
  if (minViable) wsManager.log(sessionId, 'info', `  Minimum viable timeout: ${minViable}ms`);
  return { results, minViable };
}

// ─── MAIN RUNNER ──────────────────────────────────────────────────────────────
async function runAllChaos(config, sessionId) {
  const { scenarios } = config;
  const allResults = {};
  const t0 = Date.now();

  wsManager.log(sessionId, 'info', `═══════════════════════════════`);
  wsManager.log(sessionId, 'info', `  ChaosProbeX Test Session`);
  wsManager.log(sessionId, 'info', `  Target: ${config.url}`);
  wsManager.log(sessionId, 'info', `  Method: ${config.method}`);
  wsManager.log(sessionId, 'info', `  Scenarios: ${scenarios.join(', ')}`);
  wsManager.log(sessionId, 'info', `═══════════════════════════════`);

  wsManager.emit(sessionId, 'progress', { pct: 0, label: 'Starting...' });

  // Always run baseline
  wsManager.emit(sessionId, 'progress', { pct: 5, label: 'Baseline test...' });
  allResults.baseline = await runBaseline(config, sessionId);

  const steps = scenarios.length;
  let step = 0;

  for (const scenario of scenarios) {
    const pct = Math.round(10 + (step / steps) * 85);
    wsManager.emit(sessionId, 'progress', { pct, label: `Running ${scenario}...` });

    if (scenario === 'latency') allResults.latency = await runLatencyTest(config, sessionId);
    else if (scenario === 'load')    allResults.load    = await runLoadTest(config, sessionId);
    else if (scenario === 'fuzz')    allResults.fuzz    = await runFuzzTest(config, sessionId);
    else if (scenario === 'headers') allResults.headers = await runHeaderTest(config, sessionId);
    else if (scenario === 'timeout') allResults.timeout = await runTimeoutTest(config, sessionId);

    step++;
  }

  wsManager.emit(sessionId, 'progress', { pct: 100, label: 'Analysis complete' });

  // Build summary
  const summary = buildSummary(allResults, config);
  wsManager.emit(sessionId, 'summary', summary);
  wsManager.log(sessionId, 'info', `\n  ✓ All tests complete in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  wsManager.log(sessionId, 'info', `  Resilience Score: ${summary.score}/100`);

  return { allResults, summary };
}

function buildSummary(results, config) {
  const all = [];
  if (results.baseline) all.push(...results.baseline.results);
  if (results.latency) all.push(...results.latency.results);

  const baselineDurations = results.baseline?.results.map(r => r.duration) || [];
  const avgBaseline = baselineDurations.length ? Math.round(baselineDurations.reduce((a, b) => a + b, 0) / baselineDurations.length) : 0;
  const p95 = baselineDurations.length ? Math.round([...baselineDurations].sort((a, b) => a - b)[Math.floor(baselineDurations.length * 0.95)] || 0) : 0;
  const baselineSuccess = results.baseline?.successRate ?? 100;

  const failures = [];
  let score = 100;

  if (results.latency?.breakpoint !== null && results.latency?.breakpoint !== undefined) {
    failures.push({ severity: 'critical', category: 'Latency', title: `Fails under ${results.latency.breakpoint}ms latency`, fix: 'Add retry logic with exponential backoff, set appropriate timeout thresholds' });
    score -= 20;
  }

  if (results.load?.breakpoint) {
    failures.push({ severity: 'critical', category: 'Load', title: `Breaks at ${results.load.breakpoint} concurrent requests`, fix: 'Implement rate limiting, connection pooling, horizontal scaling, or a queue' });
    score -= 25;
  }

  const fuzzFails = results.fuzz?.results.filter(r => !r.ok && r.category !== 'normal') || [];
  if (fuzzFails.some(r => r.category === 'injection')) {
    failures.push({ severity: 'critical', category: 'Security', title: 'Injection payloads not sanitized', fix: 'Validate and sanitize all input fields server-side, use parameterized queries' });
    score -= 20;
  }
  if (fuzzFails.some(r => r.category === 'size')) {
    failures.push({ severity: 'warning', category: 'Payload', title: 'No payload size limits enforced', fix: 'Add request body size limits (e.g., express limit: "1mb")' });
    score -= 10;
  }
  if (fuzzFails.some(r => r.category === 'malformed')) {
    failures.push({ severity: 'warning', category: 'Validation', title: 'Malformed JSON not gracefully handled', fix: 'Add JSON parse error middleware, return 400 with clear error message' });
    score -= 5;
  }

  if (results.timeout?.minViable && results.timeout.minViable > 2000) {
    failures.push({ severity: 'warning', category: 'Performance', title: `Min viable timeout is ${results.timeout.minViable}ms (too slow)`, fix: 'Optimize DB queries, add caching (Redis), reduce blocking I/O' });
    score -= 10;
  }

  if (baselineSuccess < 95) {
    failures.push({ severity: 'critical', category: 'Reliability', title: `Only ${baselineSuccess}% success rate on baseline`, fix: 'Fix underlying API errors before chaos testing' });
    score -= 15;
  }

  score = Math.max(0, score);

  const breakpoints = [];
  if (results.latency?.breakpoint !== null && results.latency?.breakpoint !== undefined) {
    breakpoints.push({ type: 'latency', value: results.latency.breakpoint, label: `Latency: fails at ${results.latency.breakpoint}ms`, severity: 'critical' });
  }
  if (results.load?.breakpoint) {
    breakpoints.push({ type: 'load', value: results.load.breakpoint, label: `Load: breaks at ${results.load.breakpoint} rps`, severity: 'critical' });
  }
  const sizeFail = results.fuzz?.results.find(r => r.category === 'size' && !r.ok);
  if (sizeFail) {
    breakpoints.push({ type: 'payload', value: sizeFail.body?.length || 0, label: `Payload: fails at ~${Math.round((sizeFail.body?.length || 0) / 1000)}KB`, severity: 'warning' });
  }
  const minTimeout = results.timeout?.minViable;
  if (minTimeout) {
    breakpoints.push({ type: 'timeout', value: minTimeout, label: `Timeout: needs >${minTimeout}ms`, severity: 'info' });
  }

  return {
    score,
    avgBaseline,
    p95,
    baselineSuccess,
    totalRequests: all.length,
    failures,
    breakpoints,
    scores: {
      reliability: Math.min(100, baselineSuccess),
      performance: Math.max(0, 100 - Math.round(avgBaseline / 50)),
      security: results.fuzz?.results.some(r => r.category === 'injection' && !r.ok) ? 40 : 80,
      fuzzTolerance: results.fuzz ? Math.round(results.fuzz.results.filter(r => r.ok || r.category === 'normal').length / results.fuzz.results.length * 100) : 80,
      loadHandling: results.load ? Math.max(0, 100 - (results.load.breakpoint ? Math.round((results.load.breakpoint / 100) * 30) : 0)) : 80
    }
  };
}

module.exports = { runAllChaos };

"""
ChaosProbeX — Concierge MCP Server
=====================================
Deploy this to Concierge and paste the URL into backend/.env as CONCIERGE_MCP_URL

Setup:
  pip install concierge-sdk openai
  concierge deploy
  → copy the printed URL into backend/.env: CONCIERGE_MCP_URL=https://...getconcierge.app/mcp

Tools exposed:
  - analyze_chaos_result    : AI-powered analysis of a chaos test summary
  - get_api_health_report   : Structured health report from raw test data
  - suggest_fixes           : Targeted fix suggestions per breakpoint type
  - compare_results         : Compare two test summaries (before/after)
"""

import json
import os
from concierge import Concierge
from pydantic import Field
from typing import Optional

mcp = Concierge("chaosprobex-analyzer", stateless_http=True)

# ─── Tool 1: Analyze Chaos Result ─────────────────────────────────────────────

@mcp.tool()
async def analyze_chaos_result(
    url: str                          = Field(description="The API URL that was tested"),
    method: str                       = Field(default="GET", description="HTTP method"),
    resilience_score: int             = Field(description="Overall resilience score 0-100"),
    avg_latency_ms: int               = Field(description="Average response time in ms"),
    p95_latency_ms: int               = Field(description="p95 response time in ms"),
    baseline_success_rate: int        = Field(description="Baseline success rate as percent"),
    breakpoints: list                 = Field(default=[], description="List of detected breakpoints"),
    failures: list                    = Field(default=[], description="List of detected failures with severity"),
    scores: dict                      = Field(default={}, description="Dimension scores dict"),
) -> str:
    """
    Analyze a ChaosProbeX test result and provide AI-powered root cause analysis,
    prioritized fix recommendations, and architecture improvement suggestions.
    """
    # Build a structured prompt
    bp_text = "\n".join(f"  - {b}" for b in breakpoints) if breakpoints else "  None detected"
    fail_text = "\n".join(f"  - {f}" for f in failures) if failures else "  None"
    score_text = "\n".join(f"  {k}: {v}%" for k, v in scores.items()) if scores else "  Not available"

    analysis = f"""
=== ChaosProbeX API Resilience Report ===

Target: {method} {url}
Overall Score: {resilience_score}/100

Metrics:
  Avg latency:           {avg_latency_ms}ms
  p95 latency:           {p95_latency_ms}ms
  Baseline success rate: {baseline_success_rate}%

Dimension Scores:
{score_text}

Breakpoints Detected:
{bp_text}

Failures:
{fail_text}

=== Root Cause Analysis ===
"""

    # Score-based analysis
    if resilience_score >= 85:
        analysis += "\n✓ Your API is highly resilient. Minor optimizations possible.\n"
    elif resilience_score >= 65:
        analysis += "\n⚠ Moderate resilience. Address the listed breakpoints before production load increases.\n"
    else:
        analysis += "\n✗ Critical resilience issues. This API is not production-ready under load.\n"

    # Latency analysis
    if avg_latency_ms > 2000:
        analysis += f"\n• High average latency ({avg_latency_ms}ms) suggests blocking I/O, unindexed DB queries, or synchronous external calls.\n"
    elif avg_latency_ms > 800:
        analysis += f"\n• Elevated latency ({avg_latency_ms}ms). Consider Redis caching for hot paths.\n"
    else:
        analysis += f"\n• Latency is acceptable ({avg_latency_ms}ms avg).\n"

    if p95_latency_ms > avg_latency_ms * 3:
        analysis += f"\n• p95 ({p95_latency_ms}ms) is {round(p95_latency_ms/max(avg_latency_ms,1),1)}x the average — suggests tail latency issues (GC pauses, lock contention, or slow DB queries on some requests).\n"

    # Breakpoint analysis
    has_load_bp = any("Load" in b or "rps" in b for b in breakpoints)
    has_lat_bp  = any("Latency" in b or "delay" in b.lower() for b in breakpoints)
    has_payload = any("Payload" in b or "KB" in b for b in breakpoints)
    has_timeout = any("Timeout" in b or "needs" in b for b in breakpoints)

    analysis += "\n=== Priority Fixes ===\n"
    priority = 1

    if has_load_bp:
        analysis += f"\n{priority}. [CRITICAL] Load breakpoint\n"
        analysis += "   → Add express-rate-limit: npm install express-rate-limit\n"
        analysis += "   → Use pg-pool or mongoose poolSize for DB connection limits\n"
        analysis += "   → Consider BullMQ queue for non-realtime workloads\n"
        analysis += "   → Scale horizontally with PM2 cluster mode\n"
        priority += 1

    if has_lat_bp:
        analysis += f"\n{priority}. [HIGH] Latency breakpoint\n"
        analysis += "   → Add axios-retry with exponential backoff on the client\n"
        analysis += "   → Implement circuit breaker (npm: opossum)\n"
        analysis += "   → Cache responses: redis.set(key, val, 'EX', 60)\n"
        priority += 1

    if has_payload:
        analysis += f"\n{priority}. [MEDIUM] Payload size limit\n"
        analysis += "   → Add: app.use(express.json({ limit: '1mb' }))\n"
        analysis += "   → Validate with Zod: z.string().max(10000)\n"
        priority += 1

    if has_timeout:
        analysis += f"\n{priority}. [INFO] Timeout threshold\n"
        analysis += f"   → Set client timeout to at least {p95_latency_ms * 2}ms (2x p95)\n"
        analysis += "   → Add keepAlive HTTP agent for persistent connections\n"
        priority += 1

    if baseline_success_rate < 95:
        analysis += f"\n{priority}. [CRITICAL] Low baseline success rate ({baseline_success_rate}%)\n"
        analysis += "   → Fix underlying errors before running chaos tests\n"
        analysis += "   → Check application logs and error tracking (Sentry/Datadog)\n"
        priority += 1

    analysis += "\n=== Architecture Recommendations ===\n"
    if resilience_score < 70:
        analysis += """
• Implement the Retry Pattern:
    const retry = require('async-retry');
    await retry(async bail => {
      const res = await fetch(url);
      if (res.status >= 500) throw new Error('Server error');
      return res;
    }, { retries: 3, minTimeout: 200, factor: 2 });

• Add Circuit Breaker (opossum):
    const CircuitBreaker = require('opossum');
    const breaker = new CircuitBreaker(myAsyncFn, {
      timeout: 3000, errorThresholdPercentage: 50,
      resetTimeout: 30000
    });

• Use Helmet for security headers:
    app.use(require('helmet')());
"""
    else:
        analysis += """
• Add distributed tracing (OpenTelemetry) to identify slowest spans
• Consider response compression (compression middleware)
• Add /health and /readyz endpoints for load balancer probes
"""

    return analysis.strip()


# ─── Tool 2: Get API Health Report ────────────────────────────────────────────

@mcp.tool()
async def get_api_health_report(
    url: str         = Field(description="API URL tested"),
    score: int       = Field(description="Resilience score 0-100"),
    breakpoints: list = Field(default=[], description="Detected breakpoints"),
    failures: list    = Field(default=[], description="Detected failures"),
) -> dict:
    """
    Return a structured JSON health report for the given API test results.
    Useful for CI/CD integration, storing reports, or feeding other tools.
    """
    grade = "A" if score >= 90 else "B" if score >= 75 else "C" if score >= 60 else "D" if score >= 40 else "F"
    status = "healthy" if score >= 80 else "degraded" if score >= 55 else "critical"

    crits = [f for f in failures if "CRITICAL" in f.upper() or "critical" in f]
    warns = [f for f in failures if "WARNING" in f.upper() or "warning" in f or "MEDIUM" in f.upper()]

    return {
        "api": url,
        "grade": grade,
        "score": score,
        "status": status,
        "breakpoints_count": len(breakpoints),
        "critical_failures": len(crits),
        "warnings": len(warns),
        "breakpoints": breakpoints,
        "critical_details": crits,
        "production_ready": score >= 75 and len(crits) == 0,
        "recommendation": (
            "Ready for production" if score >= 80
            else "Address critical failures before deploying"
            if crits else "Monitor closely and fix warnings"
        )
    }


# ─── Tool 3: Suggest Fixes ────────────────────────────────────────────────────

@mcp.tool()
async def suggest_fixes(
    breakpoint_type: str  = Field(description="Type: latency | load | payload | timeout | auth | fuzz"),
    severity: str         = Field(default="high", description="Severity: critical | high | medium | low"),
    language: str         = Field(default="nodejs", description="Language/framework: nodejs | python | java | go"),
) -> str:
    """
    Get targeted, language-specific fix suggestions for a specific breakpoint type.
    """
    fixes = {
        "latency": {
            "nodejs": """
# Fix: Latency Breakpoint — Node.js

1. Retry with backoff (axios-retry):
   npm install axios-retry
   const axiosRetry = require('axios-retry');
   axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

2. Circuit Breaker (opossum):
   npm install opossum
   const CircuitBreaker = require('opossum');
   const breaker = new CircuitBreaker(asyncFn, { timeout: 3000, errorThresholdPercentage: 50 });
   breaker.fallback(() => ({ cached: true, data: null }));

3. Redis cache hot paths:
   const redis = require('redis');
   const cached = await redis.get(cacheKey);
   if (cached) return JSON.parse(cached);
   const data = await fetchData();
   await redis.setEx(cacheKey, 300, JSON.stringify(data));
""",
            "python": """
# Fix: Latency Breakpoint — Python

1. Retry with tenacity:
   pip install tenacity
   from tenacity import retry, stop_after_attempt, wait_exponential
   @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=0.2, max=10))
   async def fetch_data(): ...

2. Cache with Redis (aioredis):
   import aioredis
   redis = aioredis.from_url("redis://localhost")
   cached = await redis.get(key)
   if not cached:
       data = await fetch()
       await redis.setex(key, 300, json.dumps(data))
""",
        },
        "load": {
            "nodejs": """
# Fix: Load Breakpoint — Node.js

1. Rate limiting (express-rate-limit):
   npm install express-rate-limit
   const rateLimit = require('express-rate-limit');
   app.use('/api/', rateLimit({ windowMs: 60000, max: 100, message: 'Too many requests' }));

2. PM2 cluster mode:
   npm install -g pm2
   pm2 start server.js -i max  # uses all CPU cores

3. DB connection pool (pg):
   const { Pool } = require('pg');
   const pool = new Pool({ max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 2000 });

4. Job queue (BullMQ):
   npm install bullmq
   const { Queue, Worker } = require('bullmq');
   const queue = new Queue('tasks', { connection: redisClient });
   queue.add('process', { data });
""",
            "python": """
# Fix: Load Breakpoint — Python/FastAPI

1. Rate limiting (slowapi):
   pip install slowapi
   from slowapi import Limiter
   from slowapi.util import get_remote_address
   limiter = Limiter(key_func=get_remote_address)
   @app.get("/api/data")
   @limiter.limit("100/minute")
   async def get_data(request: Request): ...

2. Async workers (Celery):
   pip install celery redis
   from celery import Celery
   app = Celery('tasks', broker='redis://localhost:6379/0')
   @app.task
   def process_data(data): ...
""",
        },
        "payload": {
            "nodejs": """
# Fix: Payload Size Breakpoint — Node.js

1. Body size limit:
   app.use(express.json({ limit: '1mb' }));
   app.use(express.urlencoded({ extended: true, limit: '1mb' }));

2. Schema validation (Zod):
   npm install zod
   const { z } = require('zod');
   const schema = z.object({ name: z.string().max(255), data: z.any() });
   const parsed = schema.safeParse(req.body);
   if (!parsed.success) return res.status(400).json({ error: parsed.error });

3. Multer for file uploads with size limit:
   const multer = require('multer');
   const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB
""",
        },
        "timeout": {
            "nodejs": """
# Fix: Timeout Threshold — Node.js

1. Set axios timeout properly:
   const client = axios.create({ timeout: 5000, httpAgent: new http.Agent({ keepAlive: true }) });

2. AbortController for fetch:
   const controller = new AbortController();
   const timer = setTimeout(() => controller.abort(), 5000);
   const res = await fetch(url, { signal: controller.signal });
   clearTimeout(timer);

3. Express timeout middleware:
   npm install connect-timeout
   app.use(timeout('5s'));
   app.use((req, res, next) => { if (!req.timedout) next(); });
""",
        },
        "auth": {
            "nodejs": """
# Fix: Auth Chaos Failures — Node.js

1. JWT validation middleware:
   npm install jsonwebtoken
   const jwt = require('jsonwebtoken');
   const authMiddleware = (req, res, next) => {
     const token = req.headers.authorization?.split(' ')[1];
     if (!token) return res.status(401).json({ error: 'Missing token' });
     try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
     catch (e) { return res.status(401).json({ error: 'Invalid token' }); }
   };

2. Helmet security headers:
   npm install helmet
   app.use(require('helmet')());
""",
        },
        "fuzz": {
            "nodejs": """
# Fix: Fuzz Test Failures — Node.js

1. Input sanitization (validator):
   npm install validator
   const validator = require('validator');
   if (!validator.isJSON(body)) return res.status(400).json({ error: 'Invalid JSON' });

2. SQL injection prevention (parameterized queries):
   // BAD:  db.query(`SELECT * FROM users WHERE id = ${id}`)
   // GOOD: db.query('SELECT * FROM users WHERE id = $1', [id])

3. XSS prevention (DOMPurify on client, sanitize-html on server):
   npm install sanitize-html
   const clean = sanitizeHtml(dirtyInput, { allowedTags: [], allowedAttributes: {} });
""",
        }
    }

    lang_fixes = fixes.get(breakpoint_type, {}).get(language)
    if not lang_fixes:
        lang_fixes = fixes.get(breakpoint_type, {}).get("nodejs", f"No specific fix for {breakpoint_type}/{language} yet.")

    return f"[Severity: {severity.upper()}] Fixes for breakpoint type '{breakpoint_type}' ({language}):\n{lang_fixes}"


# ─── Tool 4: Compare Results ───────────────────────────────────────────────────

@mcp.tool()
async def compare_results(
    before_score: int         = Field(description="Resilience score from first test"),
    after_score: int          = Field(description="Resilience score from second test"),
    before_latency: int       = Field(description="Avg latency from first test (ms)"),
    after_latency: int        = Field(description="Avg latency from second test (ms)"),
    before_breakpoints: list  = Field(default=[], description="Breakpoints from first test"),
    after_breakpoints: list   = Field(default=[], description="Breakpoints from second test"),
) -> str:
    """
    Compare two ChaosProbeX test runs (before/after a fix) and summarize improvement or regression.
    """
    score_delta  = after_score  - before_score
    latency_delta = after_latency - before_latency
    bp_delta     = len(after_breakpoints) - len(before_breakpoints)

    result = f"""
=== Before vs After Comparison ===

Resilience Score:  {before_score} → {after_score}  ({'+' if score_delta >= 0 else ''}{score_delta})
Avg Latency:       {before_latency}ms → {after_latency}ms  ({'+' if latency_delta >= 0 else ''}{latency_delta}ms)
Breakpoints:       {len(before_breakpoints)} → {len(after_breakpoints)}  ({'+' if bp_delta >= 0 else ''}{bp_delta})

Verdict:
"""
    if score_delta >= 10 and latency_delta <= 0:
        result += "✓ Significant improvement. Good fix deployed."
    elif score_delta > 0 and latency_delta <= 100:
        result += "~ Mild improvement. Continue optimizing."
    elif score_delta < -5 or latency_delta > 500:
        result += "✗ Regression detected! Review recent changes."
    else:
        result += "→ No significant change. Try a different fix strategy."

    fixed = [b for b in before_breakpoints if b not in after_breakpoints]
    new   = [b for b in after_breakpoints  if b not in before_breakpoints]
    if fixed:
        result += f"\n\nFixed breakpoints:\n" + "\n".join(f"  ✓ {b}" for b in fixed)
    if new:
        result += f"\n\nNew breakpoints (regression):\n" + "\n".join(f"  ✗ {b}" for b in new)

    return result.strip()


# ─── Entry point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    app_instance = mcp.streamable_http_app()
    uvicorn.run(app_instance, host="0.0.0.0", port=8000)

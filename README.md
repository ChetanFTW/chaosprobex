# ChaosProbeX 

> API Chaos Testing · Observability · Supply Chain Security · AI Analysis

A full-stack local platform to probe APIs with chaos engineering scenarios, visualize
breakpoints in real time, scan dependencies for vulnerabilities via **SafeDep**, and get
AI-powered fix suggestions via **Concierge MCP**.

---

## Quick Start (no credentials needed)

```bash
cd chaosprobex
chmod +x start.sh && ./start.sh
```

Open **http://localhost:3000** — works in demo mode immediately.

---

## Project Structure

```
chaosprobex/
│
├── backend/
│   ├── .env.example                ← copy to .env, fill in keys
│   └── src/
│       ├── server.js
│       ├── chaos/engine.js
│       ├── routes/
│       │   ├── chaos.js
│       │   ├── integrations.js     ← /api/integrations/*
│       │   ├── tests.js
│       │   └── history.js
│       ├── integrations/
│       │   ├── safedep.js          ← SafeDep Insights API client
│       │   └── concierge.js        ← Concierge MCP client
│       └── utils/
│           ├── wsManager.js
│           └── history.js
│
├── frontend/
│   └── src/
│       ├── App.js
│       └── components/
│           ├── Header.js           ← Dashboard | Integrations nav
│           ├── ConfigPanel.js
│           ├── Dashboard.js
│           ├── IntegrationsPanel.js ← SafeDep + Concierge UI
│           ├── LiveLog.js
│           ├── ScoreCard.js
│           ├── BreakpointPanel.js
│           ├── FailureList.js
│           └── charts/
│               ├── LiveScatter.js
│               ├── LatencyChart.js
│               ├── LoadChart.js
│               ├── FuzzChart.js
│               └── TimeoutChart.js
│
├── concierge-mcp/                  ← Python MCP server (deploy to Concierge)
│   ├── main.py                     ← 4 AI analysis tools
│   ├── requirements.txt
│   └── settings.json
│
├── package.json
├── start.sh
└── README.md
```

---

## Integration Setup

Both integrations work in **demo mode** without any credentials. Real mode activates when you add env vars.

---

### SafeDep — Dependency Vulnerability Scanner

SafeDep scans npm / PyPI / Go / RubyGems packages for CVEs, malicious packages, and supply chain risks.

**Step 1 — Get your keys (free tier available):**

```
1. Sign up at https://app.safedep.io
2. Go to: Settings → API Keys → Create New Key
3. Copy your:
     API Key    → this is your SAFEDEP_API_KEY
     Tenant ID  → this is your SAFEDEP_TENANT_ID
```

**Step 2 — Add to .env:**

```bash
# backend/.env
SAFEDEP_API_KEY=your-api-key-here
SAFEDEP_TENANT_ID=your-tenant-id-here
```

**Demo mode:** Shows mock CVE data for lodash/axios so you can test the UI immediately.
**Live mode:** Calls `https://api.safedep.io` via ConnectRPC, returns real vulnerability data.

---

### Concierge — AI-Powered Analysis via MCP

Concierge hosts your Python MCP server in the cloud. ChaosProbeX sends test results to it and receives deep AI analysis back.

**Step 1 — Deploy the MCP server (one-time, free):**

```bash
pip install concierge-sdk

cd chaosprobex/concierge-mcp
concierge deploy
```

Concierge prints:
```
Deployed: https://chaosprobex-analyzer.getconcierge.app/mcp
```

**Step 2 — Add the URL to .env:**

```bash
# backend/.env
CONCIERGE_MCP_URL=https://chaosprobex-analyzer.getconcierge.app/mcp
```

**Step 3 — Restart backend:**

```bash
cd backend && npm run dev
```

**Demo mode:** Returns locally-generated analysis based on score and breakpoints.
**Live mode:** Calls your deployed MCP server which runs 4 AI analysis tools.

**MCP tools in `concierge-mcp/main.py`:**

| Tool | Description |
|---|---|
| `analyze_chaos_result` | Root cause analysis + prioritized fixes |
| `get_api_health_report` | Structured JSON health report (CI/CD-friendly) |
| `suggest_fixes` | Language-specific code snippets per breakpoint type |
| `compare_results` | Before/after comparison to verify a fix worked |

---

## .env Reference

```bash
# Copy: cp backend/.env.example backend/.env

PORT=4000

# SafeDep — https://app.safedep.io → Settings → API Keys
SAFEDEP_API_KEY=
SAFEDEP_TENANT_ID=

# Concierge — pip install concierge-sdk && cd concierge-mcp && concierge deploy
CONCIERGE_MCP_URL=
# CONCIERGE_API_KEY=   # only if your MCP server requires auth
```

---

## API Reference

### Chaos Engine

```
POST   /api/chaos/run                → { sessionId }
GET    /api/chaos/results/:sid       → full test results
GET    /api/chaos/status/:sid        → { status }
WS     ws://localhost:4000/ws/:sid   → live event stream
```

### Integrations

```
GET    /api/integrations/status
POST   /api/integrations/safedep/scan-package
POST   /api/integrations/safedep/scan-packages
POST   /api/integrations/safedep/scan-config
GET    /api/integrations/concierge/tools
POST   /api/integrations/concierge/call
POST   /api/integrations/concierge/analyze
```

---

## Data Flow

```
Browser
  |
  |-- Dashboard tab -------> /api/chaos/*
  |                              --> chaos engine (real HTTP to target API)
  |                              --> WS stream (live logs + scatter plot)
  |
  |-- Integrations tab
        |
        |-- SafeDep tab -----> /api/integrations/safedep/scan-packages
        |                          --> safedep.js
        |                              --> https://api.safedep.io (ConnectRPC)
        |                                  <-- CVE + malicious package data
        |
        |-- Concierge tab ---> /api/integrations/concierge/analyze
                                   --> concierge.js
                                       --> CONCIERGE_MCP_URL (JSON-RPC 2.0 MCP)
                                           --> concierge-mcp/main.py (your hosted server)
                                               <-- AI analysis + code fix suggestions
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 18 · Express · express-ws · axios · dotenv |
| Frontend | React 18 · Chart.js 4 · CSS Modules |
| Realtime | WebSockets (express-ws) |
| SafeDep | ConnectRPC over HTTPS (Insights API v2) |
| Concierge | JSON-RPC 2.0 MCP · Python 3.11 · concierge-sdk |

---

## Requirements

- Node.js v18+, npm v9+
- Python 3.11+ (only for Concierge deploy step)
- Ports 3000 and 4000 free


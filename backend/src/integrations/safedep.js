/**
 * SafeDep Insights API Integration
 * Docs: https://docs.safedep.io/vet/guides/insights-api-using-typescript
 *
 * ─── WHAT YOU NEED FROM SAFEDEP ───────────────────────────────────────────────
 * 1. Sign up at https://app.safedep.io
 * 2. Go to Settings → API Keys → Create API Key
 * 3. Copy your API Key  → set as SAFEDEP_API_KEY in .env
 * 4. Copy your Tenant ID → set as SAFEDEP_TENANT_ID in .env
 * ──────────────────────────────────────────────────────────────────────────────
 */

const axios = require('axios');

const SAFEDEP_API_BASE = 'https://api.safedep.io';

// Ecosystem map: npm package name patterns → ecosystem string
const ECOSYSTEM_MAP = {
  npm:   'NPM',
  pypi:  'PYPI',
  rubygems: 'RUBYGEMS',
  go:    'GO',
};

class SafeDepService {
  constructor() {
    this.apiKey    = process.env.SAFEDEP_API_KEY    || '';
    this.tenantId  = process.env.SAFEDEP_TENANT_ID  || '';
    this.configured = !!(this.apiKey && this.tenantId);
  }

  isConfigured() {
    return this.configured;
  }

  _headers() {
    return {
      'authorization': this.apiKey,
      'x-tenant-id':   this.tenantId,
      'content-type':  'application/json',
    };
  }

  /**
   * Get security insights for a single package version
   * Uses SafeDep Insights API v2 (ConnectRPC over HTTP/1.1)
   */
  async getPackageInsight(ecosystem, name, version) {
    if (!this.configured) {
      return this._mockInsight(name, version);
    }

    try {
      const res = await axios.post(
        `${SAFEDEP_API_BASE}/safedep.services.insights.v2.InsightService/GetPackageVersionInsight`,
        {
          packageVersion: {
            package: {
              ecosystem: ECOSYSTEM_MAP[ecosystem] || 'NPM',
              name,
            },
            version,
          }
        },
        {
          headers: {
            ...this._headers(),
            'connect-protocol-version': '1',
          },
          timeout: 10000,
        }
      );

      return this._parseInsightResponse(name, version, res.data);
    } catch (err) {
      console.error(`[SafeDep] Error for ${name}@${version}:`, err.message);
      return {
        package: `${name}@${version}`,
        ecosystem,
        error: err.message,
        vulnerabilities: [],
        scorecard: null,
        licenses: [],
        isMalicious: false,
      };
    }
  }

  /**
   * Scan multiple packages (e.g. extracted from package.json body or headers)
   */
  async scanPackages(packages) {
    const results = [];
    for (const pkg of packages) {
      const insight = await this.getPackageInsight(
        pkg.ecosystem || 'npm',
        pkg.name,
        pkg.version || 'latest'
      );
      results.push(insight);
    }
    return results;
  }

  /**
   * Analyze a test config object for risky dependencies
   * Extracts package names from the Authorization headers and body JSON
   */
  async analyzeTestConfig(config) {
    const packages = this._extractPackagesFromConfig(config);
    if (packages.length === 0) return { packages: [], summary: null };

    const insights = await this.scanPackages(packages);
    const summary = this._buildScanSummary(insights);
    return { packages: insights, summary };
  }

  /**
   * Extract likely package names from API body payload
   * Looks for common package manager patterns in the body
   */
  _extractPackagesFromConfig(config) {
    const packages = [];
    try {
      const body = typeof config.body === 'string' ? JSON.parse(config.body || '{}') : (config.body || {});
      // Common patterns: { dependencies: {}, packages: [] }
      if (body.dependencies) {
        Object.entries(body.dependencies).forEach(([name, version]) => {
          packages.push({ name, version: version.replace(/[\^~>=]/g, '') || 'latest', ecosystem: 'npm' });
        });
      }
      if (body.packages && Array.isArray(body.packages)) {
        body.packages.forEach(p => {
          if (p.name) packages.push({ name: p.name, version: p.version || 'latest', ecosystem: p.ecosystem || 'npm' });
        });
      }
    } catch (_) {}
    return packages;
  }

  _parseInsightResponse(name, version, data) {
    const vulns = data.vulnerabilities || [];
    const licenses = (data.licenses || []).map(l => l.id || l.name || l);
    const scorecard = data.scorecard || null;
    const isMalicious = data.isMalicious || false;

    return {
      package: `${name}@${version}`,
      name,
      version,
      ecosystem: 'npm',
      isMalicious,
      vulnerabilities: vulns.map(v => ({
        id: v.id || v.cveId,
        severity: v.severity || 'UNKNOWN',
        summary: v.summary || v.title,
        cvss: v.cvss || null,
      })),
      licenses,
      scorecard: scorecard ? {
        score: scorecard.overallScore,
        checks: scorecard.checks || [],
      } : null,
      critical: vulns.filter(v => v.severity === 'CRITICAL').length,
      high:     vulns.filter(v => v.severity === 'HIGH').length,
      medium:   vulns.filter(v => v.severity === 'MEDIUM').length,
      low:      vulns.filter(v => v.severity === 'LOW').length,
    };
  }

  _buildScanSummary(insights) {
    const total = insights.length;
    const malicious = insights.filter(i => i.isMalicious).length;
    const withCritical = insights.filter(i => i.critical > 0).length;
    const withHigh = insights.filter(i => i.high > 0).length;
    const totalVulns = insights.reduce((a, b) => a + (b.vulnerabilities?.length || 0), 0);
    const riskScore = Math.max(0, 100 - malicious * 40 - withCritical * 20 - withHigh * 10);

    return {
      total,
      malicious,
      withCritical,
      withHigh,
      totalVulns,
      riskScore,
      status: malicious > 0 ? 'CRITICAL' : withCritical > 0 ? 'HIGH' : withHigh > 0 ? 'MEDIUM' : 'SAFE',
    };
  }

  // Mock data for when API keys aren't configured (demo mode)
  _mockInsight(name, version) {
    const isMock = true;
    const mockVulns = name.includes('lodash') ? [
      { id: 'CVE-2019-10744', severity: 'CRITICAL', summary: 'Prototype pollution in lodash', cvss: 9.8 }
    ] : name.includes('axios') ? [
      { id: 'CVE-2023-45857', severity: 'MEDIUM', summary: 'CSRF vulnerability', cvss: 6.5 }
    ] : [];

    return {
      package: `${name}@${version}`,
      name,
      version,
      ecosystem: 'npm',
      isMalicious: false,
      isMock,
      vulnerabilities: mockVulns,
      licenses: ['MIT'],
      scorecard: { score: 7.5, checks: [] },
      critical: mockVulns.filter(v => v.severity === 'CRITICAL').length,
      high:     0,
      medium:   mockVulns.filter(v => v.severity === 'MEDIUM').length,
      low:      0,
    };
  }
}

module.exports = new SafeDepService();

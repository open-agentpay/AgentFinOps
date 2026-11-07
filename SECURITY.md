# Security Policy

## Reporting Security Issues

The AgentFinOps team takes the security of autonomous AI cost governance and financial gateway infrastructure seriously. Because AgentFinOps controls organizational budgets, quotas, and API access, we appreciate your efforts to responsibly disclose any vulnerabilities.

### Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

### How to Report a Vulnerability

**Please DO NOT file public GitHub issues for security vulnerabilities.**

If you believe you have discovered a vulnerability related to:
* API key exposure or authentication bypasses
* Policy Engine bypasses (budget limit circumvention, whitelist evasion, rate limit breaches)
* Idempotency flaws, replay vulnerabilities, or double-deduction in quota settlement workflows
* Privilege escalation or tenant isolation breaches in RBAC management

Please report it privately to our security team via GitHub Security Advisories or by emailing:
* **security@agentfinops.dev** (or contact the repository maintainers directly)

Please provide:
1. Detailed description of the vulnerability.
2. Reproduction steps or a minimal proof of concept (POC).
3. Potential impact on tenants, agents, or merchants.

### Response Time

We strive to acknowledge receipt of security reports within **24 hours** and provide regular status updates as we investigate and remediate the issue.

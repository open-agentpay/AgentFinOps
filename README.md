# AgentFinOps 🚀
### Enterprise AI Agent Gateway & FinOps Financial Governance Platform

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat&logo=docker)](https://www.docker.com)
[![Go Version](https://img.shields.io/badge/Go-1.21%2B-00ADD8?style=flat&logo=go)](https://golang.org)

> **AgentFinOps** is an enterprise-grade AI Agent Gateway and LLM Cost Governance (FinOps) platform.
> It delivers sub-millisecond Token metering, intelligent failover routing, multi-tenant department budget enforcement, and autonomous circuit breakers to prevent runaway LLM costs.

---

## 🌟 Core Capabilities

- ⚡ **High-Performance AI Gateway**: Go-based reverse proxy capable of handling 10,000+ concurrent agent requests with sub-millisecond route resolution.
- 📊 **Sub-Millisecond Token Metering**: Precise tracking of Prompt and Completion tokens per department, project, session, and agent tool invocation.
- 🏢 **Multi-Tenant Budget Governance**: Strict organizational isolation with hard budget caps, sliding 24-hour limits, and automatic billing circuit breakers.
- 🛑 **Runaway Agent Circuit Breaker**: Powered by `agent-core-sdk`, automatically detects and neutralizes infinite tool-calling loops and recursive LLM hallucinations before bills escalate.
- 🔀 **Intelligent Fallback Routing**: Dynamic model downgrade and upstream provider load balancing based on latency, cost, and availability.
- 🔒 **Enterprise Security & Audit**: Full end-to-end request audit trails, upstream Master API Key masking, and granular Role-Based Access Control (RBAC).
- 🇨🇳 **100% Domestic Cloud Compliance**: Pure contract quota and postpaid enterprise accounting with zero cryptocurrency or offshore dependencies.

---

## 🏛️ Policy & Financial Governance Strategy

AgentFinOps integrates the **`agent-core-sdk`** financial policy engine to establish a zero-trust financial perimeter:

```
[Agent Tool Call] ──► [AgentFinOps Gateway]
                            │
                            ▼
              ┌───────────────────────────┐
              │ 1. Administrative Check   │ ──► [Tenant Active?]
              │ 2. Circuit Breaker (RPM)  │ ──► [Loop Detected? Halt!]
              │ 3. Single-Call Cap Check  │ ──► [Exceeds Limit? Block!]
              │ 4. Quota Balance Check    │ ──► [Deduct Credits/Tokens]
              └───────────────────────────┘
                            │ (Approved)
                            ▼
              [Upstream LLM / API Provider]
```

1. **Pre-Invocation Verification**: Every agent action is audited before the request touches the network.
2. **QuotaAdapter Settlement**: Balances are managed via an enterprise high-performance ledger (`CREDITS` / `TOKENS`).
3. **Automated Cooldown & Recovery**: If an agent trips the circuit breaker, the system enforces an administrative cooldown period before permitting half-open probe requests.

---

## 🛠️ Quickstart

### Production Deployment via Docker Compose

```bash
# 1. Clone the repository and configure environment variables
cp .env.example .env

# 2. Launch Gateway, Console, and Database services
docker compose -f docker-compose.caddy.yml up -d
```

### Accessing the Web Services

- **FinOps Management Console**: `https://console.your-domain.com` (Default port: 8080)
- **API Gateway Edge**: `https://gate.your-domain.com` (Default port: 8000)

---

## 📚 Documentation & SDK

- [FinOps Architecture Guide](docs/finops/architecture.md)
- [Enterprise Deployment Guide](docs/deployment/docker.md)
- [Python & TypeScript Client SDK](https://github.com/open-agentpay/agent-core-sdk)

---

## License

Apache License 2.0. See [LICENSE](LICENSE) for details.

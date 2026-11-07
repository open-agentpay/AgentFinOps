# Contributing to AgentFinOps

Thank you for your interest in contributing to **AgentFinOps**! AgentFinOps is an open-source enterprise AI API Gateway, Financial Firewall, and Quota Settlement Platform for autonomous AI Agents.

We welcome contributions from developers of all skill levels, from fixing typos in documentation to implementing core gateway and console features.

---

## Table of Contents

1. [Code of Conduct](#1-code-of-conduct)
2. [Repository Architecture](#2-repository-architecture)
3. [Development Setup](#3-development-setup)
4. [Development Workflow & Make Targets](#4-development-workflow--make-targets)
5. [Core Architectural Invariants](#5-core-architectural-invariants)
6. [Git & Pull Request Guidelines](#6-git--pull-request-guidelines)
7. [Reporting Security Issues](#7-reporting-security-issues)

---

## 1. Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free environment for all contributors. Please treat fellow maintainers and community members with mutual respect and professionalism.

---

## 2. Repository Architecture

The AgentFinOps repository is structured as a cloud-native enterprise monorepo:

```text
AgentFinOps/
├── services/
│   └── gateway/             # Go High-Performance AI API Gateway & FinOps Kernel
│       ├── cmd/gateway/     # Gateway daemon entrypoint
│       ├── configs/         # Gateway configuration YAML files
│       └── internal/        # Internal gateway packages
├── apps/
│   ├── console/             # Vue 3 + Element Plus Enterprise FinOps Management Console
│   └── marketplace-web/     # Next.js 14 Developer Hub & Service Marketplace
├── infra/
│   └── postgres/            # PostgreSQL DDL schema & migrations
└── docs/                    # Architecture documentation & guides
```

---

## 3. Development Setup

### Prerequisites

* **Go**: 1.21 or later
* **Node.js**: 20 or later
* **pnpm**: 9.x or later
* **PostgreSQL**: 15 or later

### Environment Initialization

```bash
# Clone the repository
git clone https://github.com/agentfinops/AgentFinOps.git
cd AgentFinOps

# Install frontend dependencies
pnpm install

# Start PostgreSQL service via Docker
docker compose up -d postgres
```

---

## 4. Development Workflow & Make Targets

AgentFinOps provides root-level `Make` targets to orchestrate builds, tests, and formatting:

| Target | Description |
| :--- | :--- |
| `make gateway-build` | Compiles the Go Gateway binary (`./services/gateway/bin/gateway`). |
| `make gateway-test` | Runs all unit and integration test suites for the Go Gateway. |
| `make console-dev` | Launches the Vue 3 Enterprise Management Console in development mode. |
| `make console-build` | Builds production assets for the Enterprise Management Console. |
| `make console-test` | Runs Vitest unit and component test suites for the Console. |

---

## 5. Core Architectural Invariants

All pull requests must respect the following non-negotiable architectural boundaries:

1. **Enterprise Compliance & Pure Quota Settlement**:
   AgentFinOps is designed for enterprise AI cost governance and financial management. All billing operates through organization virtual accounts, corporate quota pools, and fiat/bank transfer channels.

2. **Zero-Trust Policy Firewall**:
   All upstream routing must pass local policy verification (per-request budget, rolling window budget, and domain whitelist) prior to outbound execution.

3. **Strict RBAC & Tenant Isolation**:
   Every resource belongs to an explicit tenant and project. Cross-tenant reads or writes are strictly prevented at both the database and gateway levels.

4. **Idempotency & Replay Protection**:
   All ledger credit deductions and adjustments require mandatory idempotency keys to ensure at-most-once financial settlement.

---

## 6. Git & Pull Request Guidelines

### Commit Convention

We follow conventional commits:
* `feat(gateway): add Prometheus metrics for quota consumption`
* `fix(console): resolve currency formatting in billings table`
* `docs(readme): update quickstart deployment instructions`
* `test(gateway): add race detector verification for hold manager`

### Pull Request Checklist

Before submitting a PR:
- [ ] Run `make gateway-test` to ensure all Go backend tests pass.
- [ ] Run `make console-test` to ensure all frontend unit tests pass.
- [ ] Ensure formatting and lint checks pass cleanly.
- [ ] Include clear description and issue links.

---

## 7. Reporting Security Issues

Please report security issues responsibly. See [SECURITY.md](SECURITY.md) for full disclosure guidelines.

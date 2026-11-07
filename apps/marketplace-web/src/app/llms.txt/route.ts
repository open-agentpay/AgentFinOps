import {
  PUBLIC_CONSOLE_URL,
  PUBLIC_GATEWAY_URL,
  PUBLIC_SITE_URL,
  formatCreditsPrice,
  getMarketplaceRoutes,
} from '@/lib/marketplace';

export const dynamic = 'force-dynamic';

export async function GET() {
  const routes = await getMarketplaceRoutes();

  const routeLines = routes
    .map((r) => {
      const priceStr = formatCreditsPrice(r.price_base_units);
      const summary =
        r.summary ||
        r.description_md.split('\n').find((line) => line.trim() && !line.trim().startsWith('#')) ||
        r.title;
      return `- **[${r.title}](${PUBLIC_SITE_URL}/hub/${r.slug})** (Slug: \`${r.slug}\`)
  - **Summary:** ${summary}
  - **Endpoint:** \`${PUBLIC_GATEWAY_URL}${r.path_pattern}\` (\`${(r.methods || ['GET', 'POST']).join('/')}\`)
  - **Price:** \`${priceStr} Credits / req\`
  - **Gateway 24h SLA:** \`${r.sla.success_rate_24h}% 200 OK\` | P95 \`${r.sla.p95_latency_ms}ms\` | \`${r.sla.paid_calls_24h.toLocaleString()}\` paid calls | Status: \`${r.sla.health_status.toUpperCase()}\`
  - **Machine Spec:** ${PUBLIC_SITE_URL}/hub/${r.slug}/llms.txt`;
    })
    .join('\n\n');

  const content = `# AgentFinOps — Financial Firewall & Autonomous Payment Infrastructure for AI Agents

> **Canonical Site:** ${PUBLIC_SITE_URL}  
> **Documentation:** ${PUBLIC_SITE_URL}/docs/  
> **Gateway Core:** ${PUBLIC_GATEWAY_URL}  
> **Management Console:** ${PUBLIC_CONSOLE_URL}  
> **License:** Apache-2.0 Open Source  
> **Protocol Standards:** HTTP 402 Payment Required (x402), Credits Micro-Payments

---

## 1. Executive Summary & Philosophy

**AgentFinOps** is an open-source, non-custodial financial firewall and autonomous micro-payment gateway designed specifically for AI Agents (LLMs, LangChain, CrewAI, AutoGen, MCP tools).

As autonomous agents execute complex multi-step reasoning, they increasingly invoke paid external APIs, proprietary datasets, and GPU compute. The x402 protocol answers *"how does an agent pay for an HTTP resource?"* AgentFinOps answers the more crucial question:

> **"Should this agent be allowed to pay, how much, to whom, and what happens when something goes wrong?"**

### The Core Architectural Rule
**An LLM may *propose* a payment, but it can never *authorize* one.**  
Every single transaction passes through a deterministic, non-LLM policy engine outside the prompt context that enforces spending caps, rolling budgets, and circuit breakers before any money moves.

---

## 2. Seven Critical Risks Solved by AgentFinOps

| Risk | What Goes Wrong in Production | How AgentFinOps Solves It |
| :--- | :--- | :--- |
| **1. Runaway Loops** | A buggy reasoning loop calls the same paid tool hundreds of times per second. | **Circuit Breaker**: Automatically trips from \`CLOSED\` to \`OPEN\` on abnormal RPM spikes; enforces strict rolling 24h budget limits. |
| **2. Prompt Injection** | An adversarial prompt tricks the agent into paying an attacker's address or an inflated fee. | **Zero-Trust Firewall**: Payee, asset, and network whitelists + hard \`max_per_tx\` cap evaluated completely outside the LLM context. |
| **3. Private Key Exposure** | Sensitive private keys or master API keys leak into logs or prompt contexts. | **Non-Custodial Local Signer**: Private credentials 100% stay in the buyer's local environment/KMS and are never transmitted across the network. |
| **4. Double Charging** | Network timeouts are mistaken for failures, prompting retries and double deductions. | **Tri-State Decoupled State Machine**: Idempotency keys + independent modeling of intent, settlement, and fulfillment (*Timeout ≠ Failure*). |
| **5. Budget Race Conditions** | Concurrent agent threads check balance simultaneously and overspend beyond quota. | **Atomic Two-Phase Reservations**: SQLite/PostgreSQL ACID transactions (\`reserve -> commit\` or \`reserve -> release\`). |
| **6. Multi-Tenant Leakage** | Tenant A accesses or tampers with Tenant B's keys, routes, or balances. | **Strict Tenant Isolation**: Row-level tenant partitioning, server-side RBAC, and cryptographically verified agent identities. |
| **7. Rogue Agent Control** | An agent malfunctions or behaves unexpectedly in production. | **Instant Kill Switch**: Suspend agent or revoke keys; gateway halts downstream requests within milliseconds. |

---

## 3. Supported Payment Architectures

AgentFinOps provides deterministic payment support:

### Rail A: Virtual Wallet & Ledger (Enterprise / Team Sub-Accounts)
- Ideal for organizations managing internal agent fleets, allocating department budgets, and keeping audit ledgers.
- **Workflow:** \`Agent Request (Bearer apk_live_...)\` -> \`Gateway Policy Check\` -> \`Wallet HOLD\` -> \`Forward to Upstream\` -> \`2xx: CAPTURE\` / \`4xx: RELEASE\` / \`5xx or Timeout: HOLD & Mark Needs Review\` (Never auto-double charge).

### Rail B: x402 Protocol (Autonomous Inter-Agent Economy)
- Ideal for permissionless machine-to-machine trade without pre-existing accounts or credit cards.
- **Workflow:**
  1. Agent sends standard HTTP request to gateway endpoint.
  2. Gateway responds with \`HTTP 402 Payment Required\` (including price, payee address, and challenge nonce).
  3. Buyer client local policy engine validates budget and atomically reserves quota.
  4. Local client signs the challenge payload.
  5. Agent replays request with \`PAYMENT-SIGNATURE\` header.
  6. Gateway validates signature and forwards request to upstream service.

---

## 4. SDK Quickstart (Python & TypeScript)

### Python SDK

\`\`\`bash
pip install agentpay-core-sdk
\`\`\`

\`\`\`python
import os
# 从顶层 agentpay_core 直接导入 AgentPayClient
from agentpay_core import AgentPayClient, PolicyConfig, SQLitePolicyEngine

# 1. 策略防火墙：仅配置预算和白名单域名
policy = SQLitePolicyEngine.create_in_memory(
    PolicyConfig(
        id="weather_agent",
        max_per_tx_base_units=250000,  # 0.25 Credits
        rolling_budget_24h_base_units=5000000,  # 5.00 Credits
        whitelist_domains={"gate.aipmedia.cn"},
    )
)

# 2. 客户端直接传入 api_key，自动开启虚拟钱包模式与 402 自动握手
client = AgentPayClient(
    api_key=os.getenv("AGENT_API_KEY", "apk_live_xxx"),
    policy=policy,
)

# 3. 正常发起调用
response = client.get(
    "https://gate.aipmedia.cn/api/v1/simple-weather",
    params={"city": "北京"}
)
print("Response:", response.json())
\`\`\`

### TypeScript / Node.js SDK

\`\`\`bash
npm install agentpay-core-sdk
\`\`\`

\`\`\`typescript
import { AgentPayClient, PolicyConfig, SQLitePolicyEngine } from 'agentpay-core-sdk';

// 1. 策略防火墙配置
const policy = SQLitePolicyEngine.createInMemory(
  new PolicyConfig({
    id: 'weather_agent',
    maxPerTxBaseUnits: 250000n,
    rollingBudget24hBaseUnits: 5000000n,
    whitelistDomains: ['gate.aipmedia.cn'],
  })
);

// 2. 客户端直接传入 apiKey
const client = new AgentPayClient({
  apiKey: process.env.AGENT_API_KEY ?? 'apk_live_xxx',
  policy,
});

// 3. 正常发起调用
const response = await client.get('https://gate.aipmedia.cn/api/v1/simple-weather', {
  params: { timeframe: '24h' },
});
console.log('Response:', await response.json());
\`\`\`

---

## 5. Verified Live X402 API Directory (${routes.length} Active Verified Endpoints)

The following public endpoints are officially listed in the AgentFinOps Marketplace (${PUBLIC_SITE_URL}/marketplace) to test and validate end-to-end SDK payments:

${routeLines}

---

## 6. Machine & Crawler Integration Guidelines

- To fetch machine-readable Markdown for any route: send \`Accept: text/markdown\` header to \`${PUBLIC_SITE_URL}/hub/<slug>\` or access \`${PUBLIC_SITE_URL}/hub/<slug>/llms.txt\`.
- All pages embed Schema.org \`WebAPI\` and \`Product\` JSON-LD structured data with live SLA telemetry.
`;

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      'X-Robots-Tag': 'all',
    },
  });
}

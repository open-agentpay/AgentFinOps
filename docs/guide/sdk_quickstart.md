# AgentFinOps Client SDK Quickstart Guide

This guide explains how AI agent developers integrate with **AgentFinOps Gateway** using the neutral **`agent-core-sdk`**.

---

## 1. Installation

### Python
```bash
pip install agentpay-core-sdk
```

### TypeScript / Node.js
```bash
npm install agentpay-core-sdk
```

---

## 2. Architecture & Quota Model

AgentFinOps uses an enterprise FinOps model based on **Pre-allocated Quotas and Token Credits**:
- **Zero Cryptocurrency / Zero Gas**: Authentication is handled via API Keys and JWT tokens.
- **Quota Accounting**: Balances are denominated in `CREDITS` (1 Credit = 100 base units) or direct Model Tokens.
- **Active Client-Side Guardrail**: The SDK evaluates spending and rate limits locally before dispatching requests to the gateway.

---

## 3. SDK 零摩擦调用代码 (Python & TypeScript)

### Python (agentpay-core-sdk)

```python
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
```

### TypeScript / Node.js (agentpay-core-sdk)

```typescript
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
```

---

## 4. Runaway Agent Protection

When an agent enters a recursive hallucination loop, the local `circuit_max_rpm` rule triggers automatically:
1. Status switches from `CLOSED` to `OPEN`.
2. All outgoing HTTP requests are halted instantly in $O(1)$ memory time.
3. Zero tokens or credits are lost during runaway loops.

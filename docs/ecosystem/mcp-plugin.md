# MCP (Model Context Protocol) 协议原生支付中间件与金融防火墙

> **版本**：v1.0.0  
> **适用范围**：Anthropic MCP Server / Client、AgentPay Go Gateway、Python & TypeScript SDK  
> **关联规划**：Master Roadmap v2.0.0 模块四（4.1 MCP 原生支持）

---

## 1. 架构背景与痛点

Anthropic 提出的 **Model Context Protocol (MCP)** 正在成为大模型连接外部工具（Tools）、数据资源（Resources）与提示词（Prompts）的行业事实标准。然而，当开发者将带有金钱消费或高成本 API（例如企查查接口、短信通道、专有行业研报）封装为 MCP Tool 时，面临两大核心安全风险：

1. **缺失统一的工具标价机制**：MCP 协议原生没有计费标准，工具作者无法声明 Tool 的调用价格与计费币种。
2. **缺乏客户端资金防火墙**：大模型自主决定调用哪些 MCP Tools，一旦陷入死循环、提示词注入（Prompt Injection）或误操作，会无节制调用付费 Tool，导致企业资产瞬间损失。

AgentPay 为 MCP 提供了**双向原生扩展**：
- **MCP Server 端（计费中间件）**：为任意 MCP 工具提供一键标价能力；
- **MCP Client 端（金融防火墙插件）**：在本地原子拦截 Tool Call，进行单笔与日预算预检、人在回路（HITL）协同审批。

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        MCP Client (Agent 运行时)                       │
│                                                                        │
│   ┌────────────────────┐     Tool Call 提议     ┌──────────────────┐   │
│   │ LLM (Claude/GPT-4) │ ──────────────────────>│ AgentPay Firewall│   │
│   └────────────────────┘                        │ • 额度预检       │   │
│                                                 │ • 预算与熔断     │   │
│                                                 │ • HITL 审批挂起  │   │
│                                                 └────────┬─────────┘   │
└──────────────────────────────────────────────────────────┼─────────────┘
                                                           │ 通过/已审批
                                                           ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       MCP Server (付费工具提供方)                      │
│                                                                        │
│   ┌──────────────────────┐   元数据自动注入     ┌──────────────────┐   │
│   │ tools/call Handler   │ <─────────────────── │ AgentPay Pricing │   │
│   │ (执行企查查/万方接口)│                      │ price_base_units │   │
│   └──────────────────────┘                      └──────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. MCP Server 端：标价插件规范

在 MCP 规范中，`tools/list` 接口返回各 Tool 的描述与 `inputSchema`。AgentPay 在 Tool 定义的 `metadata` 扩展字段中注入 `agentpay` 计费契约：

```json
{
  "name": "enterprise_credit_report",
  "description": "查询企业全国工商与司法涉诉深度征信报告",
  "inputSchema": {
    "type": "object",
    "properties": {
      "company_name": { "type": "string", "description": "企业全称" }
    },
    "required": ["company_name"]
  },
  "metadata": {
    "agentpay": {
      "version": "1.0",
      "price_base_units": 5000000,
      "asset": "CNY",
      "currency_symbol": "¥",
      "pricing_model": "per_call",
      "description": "0.50 元/次 (含司法征信与经营异常查询)"
    }
  }
}
```

### TypeScript MCP Server 接入示例

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { withAgentPayPricing } from "agentpay-core-sdk/mcp";

const server = new Server(
  { name: "enterprise-tools", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// 为工具绑定标价与网关鉴权
withAgentPayPricing(server, {
  name: "enterprise_credit_report",
  priceBaseUnits: 5000000n, // 5000000 微单位 = 0.50 元
  asset: "CNY",
  handler: async (args) => {
    // 业务实现：调用底层企查查接口
    return { content: [{ type: "text", text: "..." }] };
  }
});
```

---

## 3. MCP Client 端：金融防火墙中间件

在 MCP Client 中包装 `Client.callTool`，在向 MCP Server 发送网络请求前，强制执行本地策略评估：

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { AgentPayFirewall, PolicyConfig } from "agentpay-core-sdk";
import { withAgentPayFirewall } from "agentpay-core-sdk/mcp";

const client = new Client(
  { name: "copilot-agent", version: "1.0.0" },
  { capabilities: {} }
);

// 装载金融防火墙策略
const firewall = new AgentPayFirewall(
  new PolicyConfig({
    maxPerTxBaseUnits: 10000000n,       // 单笔上限 1.00 元
    rollingBudget24hBaseUnits: 50000000n, // 日预算上限 5.00 元
    circuitBreakerMaxRpm: 30,             // 防死循环 30 次/分钟熔断
    hitlThresholdBaseUnits: 2000000n,     // 超过 0.20 元触发飞书审批
  })
);

// 注入防火墙到 MCP Client
const guardedClient = withAgentPayFirewall(client, firewall);

// LLM 触发工具调用时，自动进行安全校验与扣减
const result = await guardedClient.callTool({
  name: "enterprise_credit_report",
  arguments: { company_name: "北京某科技有限公司" }
});
```

---

## 4. 关键防御指标

1. **零延迟本地拦截**：命中单笔超额、日预算超额或死循环熔断时，$O(1)$ 内存时间直接在端侧拦截，不产生网络开销与上游付费；
2. **402 异步挂起无缝转换**：当 Tool 价格触发 `hitlThresholdBaseUnits` 时，Client 自动挂起并返回 `APPROVAL_REQUIRED`，通知管理员企业微信/飞书审批；
3. **不可抵赖审计流水**：每次 Tool 调用精确记录入参哈希、执行耗时、扣减金额及对应的 LLM Session ID，保障等保 2.0 合规。

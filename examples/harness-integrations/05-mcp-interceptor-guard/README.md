# 场景五：MCP (Model Context Protocol) 协议级拦截与计费

> **适用场景**：Anthropic Claude Desktop、Cursor、腾讯 WorkBuddy 或企业自建 MCP 工具生态；跨进程 stdio / SSE RPC 工具调用。  
> **模型感知度**：**部分感知**（基于 MCP Tool Schema 自动注入 `@withPrice` 价格元数据）  
> **核心机制**：**生命周期两阶段拦截（`evaluate -> reserve -> commit/release`）**  
> **文档章节**：[AI Harness 与 Agent 框架集成指南](../../docs/ecosystem/harness-integration.md#场景五mcp-model-context-protocol-协议级拦截与计费)

---

## 核心设计

1. **MCP Server 端标价**：通过 `withPrice` 装饰原始 MCP Tool，向客户端广播单次调用单价（如 `0.10 CNY`）；
2. **MCP Client 端前置拦截**：在客户端发起 `tools/call` RPC 之前自动检查单笔限额与每日预算，并原子预留 Quota；
3. **失败自动冲正（Release on Failure）**：若工具执行崩溃或网络超时，拦截器捕获异常并自动调用 `afterCallFailure` 释放预留额度，**绝不因为上游崩溃而吞掉企业资金**！

---

## 运行方式

```bash
node examples/harness-integrations/05-mcp-interceptor-guard/main.mjs
```

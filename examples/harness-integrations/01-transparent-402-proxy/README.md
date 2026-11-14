# 场景一：同步按次计费 API（隐式 402 代理模式）

> **适用场景**：纯 REST/HTTP 接口访问；存量业务代码零修改；Agent 像访问普通免费接口一样调用即可。  
> **模型感知度**：**完全无感（0 Prompt Token 消耗）**  
> **延迟开销**：极低（传输层毫秒级握手重试）  
> **文档章节**：[AI Harness 与 Agent 框架集成指南](../../docs/ecosystem/harness-integration.md#场景一同步按次计费-api隐式-402-代理模式)

---

## 运行方式

### Python 运行
```bash
python examples/harness-integrations/01-transparent-402-proxy/main.py
```

若连接线上真实网关 `gate.aipmedia.cn`：
```bash
USE_LIVE_GATEWAY=true python examples/harness-integrations/01-transparent-402-proxy/main.py
```

### Node.js / TypeScript 运行
```bash
node examples/harness-integrations/01-transparent-402-proxy/main.mjs
```

---

## 架构时序

```text
[业务代码 / Agent]              [AgentPay Transport 拦截器]             [AgentPay Gateway]
       │                                     │                                     │
       │ 1. GET /api/v1/simple-weather       │                                     │
       │────────────────────────────────────>│ 2. 发起首次 HTTP 请求                │
       │                                     │────────────────────────────────────>│
       │                                     │ 3. 402 Payment Required (挑战需0.25元)│
       │                                     │<────────────────────────────────────│
       │                                     │ 4. 本地策略校验单笔限额 & 冻结 Quota  │
       │                                     │ 5. 附带 Authorization 重放请求      │
       │                                     │────────────────────────────────────>│
       │                                     │ 6. 200 OK + 扣费确认 (Captured)      │
       │                                     │<────────────────────────────────────│
       │ 7. 收到 200 OK 天气数据             │                                     │
       │<────────────────────────────────────│                                     │
(业务代码完全无需处理 402，零修改感知)
```

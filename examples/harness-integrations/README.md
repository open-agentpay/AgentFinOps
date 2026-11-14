# AgentFinOps × AI Harness & Agent 框架集成实战示例库

> **版本**：v1.0.0  
> **配套文档**：[`docs/ecosystem/harness-integration.md`](../../docs/ecosystem/harness-integration.md)  
> **统一网关**：`https://gate.aipmedia.cn`  
> **默认体验 Key**：`apk_live_guest_35f4d15ea0ea3dd5e26e7c6b9bb7c35d`（内置 ¥5.00 匿名体验额度）

本目录包含与 [AI Harness 与 Agent 框架集成指南](../../docs/ecosystem/harness-integration.md) 严格对齐的 **5 个独立可运行（Self-Contained & Ready-to-Run）实战 Demo**。

所有示例均设计为**零门槛开箱即跑**：
- **离线/开箱模式**：无需预先充值或申请商业 Key，脚本内置轻量级高保真状态机与策略引擎，直接运行即可查看彩色终端时序与拦截全过程；
- **在线真实网关模式**：配置环境变量 `USE_LIVE_GATEWAY=true`，脚本自动携带匿名试用 Key 发起对 `https://gate.aipmedia.cn` 的真实网络调用，亲眼见证 HTTP 402 自动协商与扣费。

---

## 示例清单与选型对照

| 示例目录 | 框架生态 | 接入模式 | 核心演示能力 | 运行命令 |
| :--- | :--- | :--- | :--- | :--- |
| **[`01-transparent-402-proxy/`](./01-transparent-402-proxy/)** | REST / 原生 Python / TS | **隐式透明 402 代理** | 业务代码零侵入；底层 Transport 自动捕获 402 挑战并完成虚拟钱包扣费与重放。 | `python 01-transparent-402-proxy/main.py` |
| **[`02-langchain-explicit-polling/`](./02-langchain-explicit-polling/)** | LangChain / LangGraph | **显式意图工具** | Agent 主动调用 `agentpay_pay` 下单，并通过 `agentpay_get_payment` 轮询异步任务对账交付。 | `python 02-langchain-explicit-polling/main.py` |
| **[`03-openai-function-guard/`](./03-openai-function-guard/)** | OpenAI Agents SDK / FC | **前置守卫中间件** | 使用 `@protect_openai_function` 拦截单笔超限高危算力函数，执行前 Dry-run 毫秒级阻断并反馈 Observation。 | `python 03-openai-function-guard/main.py` |
| **[`04-crewai-role-isolation/`](./04-crewai-role-isolation/)** | CrewAI 多 Agent 协同 | **多角色权限隔离** | Researcher 持有商业支付工具，Analyst 零资金权限；杜绝多智能体共用 Master Key 越权扣费。 | `python 04-crewai-role-isolation/main.py` |
| **[`05-mcp-interceptor-guard/`](./05-mcp-interceptor-guard/)** | Model Context Protocol | **MCP 协议拦截器** | `@withPrice` 工具标价与前置配额守卫；演示成功调用原子提交与上游崩溃自动 Release 退款。 | `node 05-mcp-interceptor-guard/main.mjs` |

---

## 快速开始

### 1. 环境准备

Python 3.10+ 与 Node.js 18+ 即可运行全部示例：

```bash
# 进入示例根目录
cd examples/harness-integrations

# 运行场景一：隐式 402 代理
python 01-transparent-402-proxy/main.py

# 运行场景二：LangChain 异步对账轮询
python 02-langchain-explicit-polling/main.py

# 运行场景三：OpenAI 前置守卫
python 03-openai-function-guard/main.py

# 运行场景四：CrewAI 权限隔离
python 04-crewai-role-isolation/main.py

# 运行场景五：MCP 拦截器 (Node.js)
node 05-mcp-interceptor-guard/main.mjs
```

### 2. 体验真实网关调用

若希望连接线上真实生产网关 `https://gate.aipmedia.cn`，只需设置环境变量：

```bash
export USE_LIVE_GATEWAY=true
export AGENTPAY_API_KEY=apk_live_guest_35f4d15ea0ea3dd5e26e7c6b9bb7c35d

python 01-transparent-402-proxy/main.py
```

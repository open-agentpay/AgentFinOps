# AgentFinOps × Agent Harness 架构结合与 MCP 借势运营方案

> **版本**：v1.0.0  
> **制定日期**：2026-11-09  
> **核心定位**：基于“30% 核心研发 + 70% 平台运营”双轮驱动战略（参见 [30/70 战略执行规划](./2026-11-08-agentpay-30-70-operations-and-code-plan.md)），以 **MCP（Model Context Protocol）与 OpenAI 兼容网关** 为最大公约数，低成本适配 [DeepSeek Harness (`dsh`)](https://github.com/deepseek-ai/deepseek-harness)、[腾讯 WorkBuddy](https://www.workbuddy.cn/) 等行业热点 Agent Harness。  
> **关联规范**：[企业级系统架构规范](../architecture/index.md) | [安全与威胁模型规范](../architecture/security-model.md) | [MCP 原生支付中间件规范](../ecosystem/mcp-plugin.md)

---

## 1. 核心概念界定：什么是 Agent Harness？为什么亟需 AgentFinOps？

### 1.1 Agent Harness 的定义与核心解剖

在 AI 工程领域，**Agent Harness（智能体运行框架/控制套具）** 是包裹在大语言模型（LLM）外层的确定性运行时基础设施，行业通行公式为 **`Agent = Model + Harness`**（[Martin Fowler: Harness Engineering](https://martinfowler.com/articles/harness-engineering.html)）。如果将 LLM 视为负责推理与输出意图的“大脑”，那么 Agent Harness 就是赋予其感知、记忆、工具执行与安全边界的“躯干与运行环境”（[Thoughtworks: What is an AI agent harness?](https://www.thoughtworks.com/insights/blog/machine-learning-and-ai/ai-agent-harness)）。

单纯的语言模型只是一个开环（Open-loop）的单次文本生成器，而 [Agent Harness](https://www.databricks.com/blog/ai-harness) 通过以下五大核心层将其转化为闭环（Closed-loop）的自主工作引擎（[Arize AI](https://arize.com/blog/what-is-an-agent-harness/)、[Microsoft Learn](https://learn.microsoft.com/en-us/agent-framework/concepts/harness)）：

1. **执行控制循环（Control Loop）**：驱动“推理（Reason）$\to$ 行动（Act）$\to$ 观察结果（Observe）$\to$ 迭代修正”的多步闭环，直至达成目标或触发终止条件（[Thunai AI](https://www.thunai.ai/blog/ai-harness-vs-ai-agent)）。
2. **上下文与记忆编排（Context & Memory）**：动态组装系统指令、历史会话、外部文档与工具返回结果，并通过上下文压缩（Compaction）防止窗口溢出（[NN/G: Agent Harness Definition](https://www.nngroup.com/articles/agent-harness/)）。
3. **工具路由与沙箱执行（Tool Routing & Sandbox）**：拦截模型的工具调用提议，校验权限并在受控环境（容器、进程外守护进程）中执行真实操作（[Snowflake: Agent Harness](https://www.snowflake.com/en/artificial-intelligence/agents/harness/)）。
4. **安全护栏与人在回路（Guardrails & HITL）**：像控制论中的“调速器（Cybernetic Governor）”一样约束模型的不确定性输出，并在高风险操作前挂起任务等待人工审批（[Martin Fowler](https://martinfowler.com/articles/harness-engineering.html)）。
5. **全链路可观测性与评测（Observability & Evals）**：记录每一步的 Prompt、工具出入参、耗时与 Token 消耗，支撑回放审计与持续的 [Harness Engineering](https://www.dawiso.com/glossary/agent-harness-engineering) 迭代（[LangChain: The Anatomy of an Agent Harness](https://www.langchain.com/blog/the-anatomy-of-an-agent-harness)）。

### 1.2 传统 Agent Harness 的财务盲区与 AgentFinOps 的卡位

研究表明，自主智能体高达 60% 以上的成本消耗在多轮循环重试与异常处理上，失控的循环任务甚至会比单轮对话多消耗上千倍的 Token 与外部 API 费用（[Thunai AI](https://www.thunai.ai/blog/ai-harness-vs-ai-agent)）。

传统 Agent Harness 聚焦于“如何让任务跑通”，但在企业生产环境中普遍缺失**“财务调速器（Financial Governor）”**：
- **缺乏硬性资金电闸**：仅依赖固定步数上限（`max_iterations`），无法按实时消费金额或高频速率（RPM）秒级熔断。
- **缺乏多级预算隔离与防悬挂记账**：多个智能体共享上游商业模型或付费数据源的 Master Key，一旦单个 Harness 失控即可穿透整个部门预算，且网络超时极易引发资金悬挂（参见 [安全与威胁模型规范 N1–N6](../architecture/security-model.md)）。
- **缺乏财务级语义反馈**：普通网关仅返回 `500` 或超时错误，模型无法区分“接口临时故障（应当重试）”与“超出单笔预算上限（禁止重试，应当切换低成本方案）”。

**AgentFinOps (AgentPay)** 的核心定位正是嵌入或代理各类 Agent Harness 的**企业级财务安全护栏层（Financial Guardrail Layer）**。

---

## 2. AgentFinOps 与 Agent Harness 的五大通用结合切面

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              Agent = Model + Agent Harness                             │
│                                                                                        │
│   ┌──────────────┐    1. 推理与工具提议    ┌───────────────────────────────────────┐   │
│   │  LLM 大模型  │ ──────────────────────> │             Agent Harness             │   │
│   └──────────────┘                         │  • Control Loop  • Context & Memory   │   │
│          ▲                                 │  • Tool Router   • Session Log        │   │
│          │ 5. 注入财务 Observation         └───────────────────┬───────────────────┘   │
└──────────┼─────────────────────────────────────────────────────┼───────────────────────┘
           │                                                     │ 2. OpenAI 路由 / MCP 调用
           │                                                     ▼
┌──────────┴─────────────────────────────────────────────────────────────────────────────┐
│                    AgentFinOps (企业级 AI 行为审计与资金防火墙网关)                    │
│                                                                                        │
│  [北向：模型计费代理 (/v1/chat/completions)]     [南向：MCP 协议计费网关 (SSE / Stdio)]│
│  • 四级树状配额锁 (租户->部门->项目->Agent)      • 三态防悬挂状态机 (Hold/Capture/Rel) │
│  • 滑动窗口 RPM 死循环秒级熔断                   • HTTP 402 异步挂起 + 飞书/企微审批   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

| Agent Harness 核心层 | 结合方式与职责分工 | 对应 AgentFinOps 模块与机制 | 解决的核心生产风险 |
| :--- | :--- | :--- | :--- |
| **1. 工具调用层（Tool Execution）** | 用 `AgentPayClient` 替换 Harness 内部工具的原生请求，或将 MCP 工具流量统一指向网关 | `agentpay-core-sdk` + [Go Gateway](../../services/gateway) + [MCP 插件](../ecosystem/mcp-plugin.md) | 收敛上游商业模型与付费 API 的 Master Key（AES-256-GCM 加密托管），防止宿主环境泄露密钥（N1 威胁） |
| **2. 循环控制层（Loop Governor）** | 在 Harness 每轮发起工具/模型调用前执行双层滑动窗口校验，超频或超额时物理切断循环 | 端侧 `SQLitePolicyEngine` + 网关级联配额校验器 | 毫秒级识别失控递归（`CIRCUIT_MAX_RPM_EXCEEDED`），3 秒内冻结钱包，防止死循环刷爆账单（N3 威胁） |
| **3. 观察与反馈层（Observation Feedback）** | 将网关拦截原因（402 挑战、单笔超限、熔断状态）封装为结构化 Observation 喂回模型上下文 | 金融防火墙错误码（如 `SINGLE_TX_CAP_EXCEEDED`） | 让 LLM 感知“预算边界”，在被拒后主动放弃昂贵接口、切换低成本方案或向用户汇报，而非盲目重试 |
| **4. 审批挂起层（HITL Checkpoint）** | 当模型请求高价值工具触发阈值时，Harness 捕获 `402` 响应并挂起当前执行协程，等待审批回调后自动重放 | [402 异步挂起引擎](./2026-11-07-hitl-approval-architecture.md) + 飞书/企微审批卡片 + Nonce 幂等重放 | 实现“小额毫秒级自动放行、中大额手机端一键审批、超额硬阻断”的三级风控梯次 |
| **5. 状态与可观测层（State & Tracing）** | Harness 在请求头注入 `trace_id` 与组织上下文，网关执行原子记账并将真实成本回写至追踪看板 | 防悬挂三态状态机（`Hold/Capture/Release`）+ [Langfuse 协同](../ecosystem/langfuse.md) | 隔离模型“自报声明（Declared）”与网关“客观事实（Observed）”，杜绝超时悬挂扣款（N4 威胁）并实现部门级成本核算 |

---

## 3. 典型标杆方案：DeepSeek Harness 与腾讯 WorkBuddy 架构对接

[DeepSeek Harness (`dsh`)](https://github.com/deepseek-ai/deepseek-harness) 与 [腾讯 WorkBuddy](https://www.workbuddy.cn/) 分别代表了当前最受关注的两类 Agent Harness 架构范式：**开源白盒插件化微内核**与**商业闭盒协议扩展工作台**。

### 3.1 两类标杆 Harness 的架构特征对比

| 对比维度 | [DeepSeek Harness (`dsh`)](https://www.deepseek.com/zh/harness/) | [腾讯 WorkBuddy](https://www.workbuddy.cn/) / [Enterprise](https://www.workbuddy.cn/docs/enterprise/) |
| :--- | :--- | :--- |
| **核心架构范式** | 基于 Cordis 框架的“万物皆插件（Everything is a Plugin）”微内核（[Eigent AI](https://www.eigent.ai/blog/deepseek-harness-agent-runtime)） | 多 Agent 并行协作的全场景桌面客户端与企业托管平台（[腾讯云 WorkBuddy](https://cloud.tencent.com/product/workbuddy)） |
| **控制循环可见性** | **完全白盒**：Agent Loop、Router、Tool Registry、Session Log 均为可热插拔组件（[MindStudio 架构解析](https://www.mindstudio.ai/blog/deepseek-harness-plugin-architecture)） | **受控黑盒**：主规划循环由平台托管，官方提示自定义模型持续触发调用时需用户自行关注第三方账户费用（[WorkBuddy 模型配置](https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Model)） |
| **核心扩展接口** | Cordis 插件生命周期钩子、前置代码门控（Gate）、任务授权票据（Mandate）及 OpenAI 兼容端点（[MindStudio](https://www.mindstudio.ai/blog/deepseek-harness-plugin-architecture)） | [自定义模型配置 (`models.json`)](https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Model)、[MCP 配置 (`mcp.json`)](https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/MCP-Guide)、[连接器 (Connector)](https://open.workbuddy.cn/docs/connector) 与 [Skills 技能包](https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Skills-Market) |
| **AgentFinOps 结合策略** | **内核级插件注入（`dsh-plugin-finops`）+ MCP/模型双路网关** | **协议边界代理（模型自定义协议代理 + MCP 网关）+ 财务感知 Skill** |

### 3.2 与 DeepSeek Harness (`dsh`) 的四层结合设计

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 没有固定的特权核心，连驱动智能体的主循环（Loop）、工具注册表（Tool Registry）和权限模块都是通过 Cordis 进行时空组合（Spatiotemporal Composability）的插件（[MindStudio](https://www.mindstudio.ai/blog/deepseek-harness-plugin-architecture)）。AgentFinOps 可通过 **“协议接入（零代码）+ 轻量 Cordis 插件（可选增强）”** 结合：

1. **前置门控与票据层（Gate & Mandate 预算绑定）**：
   - **DSH 机制**：在 DSH 的 Super Agent 架构中，外部触发事件进入模型推理前会先经过纯代码门控（Gate），并生成记录发起人、规则与执行边界的授权票据 `Mandate`（[MindStudio](https://www.mindstudio.ai/blog/deepseek-harness-plugin-architecture)）。
   - **结合方案**：在 Gate 阶段对接 AgentFinOps 网关校验发起人所属部门/项目的可用余额，并将单次任务的预算硬顶（Task Budget Cap）和滑动窗口频率限制写入 `Mandate` 上下文（或透传 `X-AgentPay-Mandate-Cap` 请求头）。
2. **主循环与多级路由层（Loop & Router 动态降级）**：
   - **DSH 机制**：DSH 将轻量级编排路由器（Router）与实际执行编码/分析的 Worker Agent 分离（[MindStudio](https://www.mindstudio.ai/blog/deepseek-harness-plugin-architecture)）。
   - **结合方案**：当任务消耗接近预算阈值的 80% 时，根据网关返回的剩余配额信号动态调整 Router 的模型路由策略，将后续边缘推理从旗舰模型平滑降级至轻量模型；一旦触发死循环阈值，利用 Cordis 的时间可组合性（Temporal Composability）干净卸载当前 Worker。
3. **工具注册表与沙箱拦截层（Tool Registry & MCP 402 HITL）**：
   - **DSH 机制**：支持接入外部工具、MCP 服务与本地沙箱（[OpenDesign](https://open-design.ai/agents/deepseek-harness-design/)）。
   - **结合方案**：将 DSH 的外部付费工具统一挂载到 AgentFinOps 的 MCP 网关下。当 Worker 调用高价值 API 触发 `HTTP 402 Payment Required` 时，挂起当前 Session 并通过飞书/企微推送审批卡片，批准后携带幂等凭证恢复执行。
4. **会话日志与三态账本对账层（Session Log & Ledger Sync）**：
   - **结合方案**：将 DSH 的 Session Log `trace_id` 与网关端通过 `Hold -> Capture -> Release` 三态状态机确认的客观扣费流水双向绑定，实现按插件/子智能体（Subagent）维度的精准成本核算。

### 3.3 与腾讯 WorkBuddy 的三切面零侵入结合设计

[腾讯 WorkBuddy](https://www.workbuddy.cn/docs/workbuddy/Overview) 支持一句话拆解复杂任务并由多 Agent 并行推进（[腾讯云 WorkBuddy](https://cloud.tencent.com/product/workbuddy)）。由于其内部主循环闭源且多 Agent 并行会成倍放大调用频次，AgentFinOps 可直接利用其官方开放的**三大标准配置切面**实现零代码修改的外部治理闭环：

1. **模型底座切面：通过“自定义模型 + 自定义协议”接入 Go 网关**：
   - **WorkBuddy 机制**：允许在本地 `workbuddy/models.json` 或图形界面中配置第三方大模型，并提供**“自定义协议”开关**——开启后针对经过网关或代理层封装的非标准 URL 直接发起请求，跳过路径校验（[WorkBuddy 模型配置文档](https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Model)）。
   - **结合方案**：企业员工不在本地保存上游大模型的真实 Master Key，而是统一在 WorkBuddy 中填入 AgentFinOps Go 网关地址及受控的员工级/项目级 `apk_live_xxx` 密钥。多 Agent 并行产生的所有 LLM 推理流量全部流经网关，由网关流式解析 SSE 响应计算真实 Token 成本，并通过四级树状配额实时拦截超支请求。
2. **工具调用切面：通过 `mcp.json` / 连接器挂载 AgentFinOps MCP 网关**：
   - **WorkBuddy 机制**：通过 `~/.workbuddy/mcp.json`（支持 SSE 与本地模式）及开放平台 [连接器（Connector）](https://open.workbuddy.cn/docs/connector) 扩展外部业务系统、数据库与企微机器人能力（[WorkBuddy MCP 指南](https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/MCP-Guide)）。
   - **结合方案**：在 AgentFinOps 网关上暴露标准 **MCP SSE 代理端点**。WorkBuddy 发起的每一次付费 MCP Tool Call 均先经过网关的 `Hold -> Capture -> Release` 三态预占与滑动窗口限流；若上游超时，网关自动 Release 预留资金，保障多 Agent 并行调用时账本零误差。
3. **认知与审批切面：发布配套的“财务感知 Skill”与企微闭环**：
   - **WorkBuddy 机制**：[连接器规范](https://open.workbuddy.cn/docs/connector) 与 [Skills 系统](https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Skills-Market) 使用 `skills/` 目录下的 `Markdown + YAML Frontmatter` 文档指导 AI 理解何时以及如何使用工具（[自定义技能实践](https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Practice-Cases/Practice-Eight)）。
   - **结合方案**：随附一份 `AgentFinOps-Governance Skill`：
     - **异常语义引导**：在 Skill 规则中明确声明当收到 `SINGLE_TX_CAP_EXCEEDED`（单笔超限）或 `CIRCUIT_BREAKER_OPEN`（频率超限）时，禁止原地重试，必须停止当前子任务或改用低成本替代工具。
     - **企微原生审批联动**：WorkBuddy 原生深度集成企业微信生态（[WorkBuddy MCP 指南](https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/MCP-Guide)），当大额调用触发网关 `402` 挂起时，AgentFinOps 直接向负责人企业微信推送审批卡片，批准后由 Skill 引导 WorkBuddy 完成幂等重放。

---

## 4. 面向“蹭热点运营”的最小化研发与内容矩阵规划

为了契合“30% 核心研发 + 70% 平台运营”策略，研发侧不必为每个外部工具单独开发重度插件，而是用**“1 套网关通用协议层 + N 份热点工具配置模板”**撬动最大的社区声量。

### 4.1 研发侧最小化支撑清单（围绕 MCP 路线图）

1. **Go 网关 MCP 透明代理路由（MCP SSE Proxy）**：
   - 在现有 [MCP 插件规范](../ecosystem/mcp-plugin.md) 基础上，支持在 `gateway.yaml` 中直接为上游 MCP Server 配置工具级价格（`price_base_units`），使任何仅支持 `mcp.json` 配置的闭盒客户端（如 WorkBuddy、Cursor、Claude Desktop）无需编写 SDK 代码即可接入。
2. **结构化财务拦截提示（LLM-Friendly Denial Formatter）**：
   - 当网关触发限额或 `402` 挂起时，除了返回 HTTP 状态码外，在 MCP Tool Result 或 OpenAI 兼容响应中自动附带结构化的中文/英文引导提示（告知模型当前剩余配额、被拒原因及建议动作），确保任何 Harness 的主循环都能平滑理解。
3. **热点工具一键配置模板库（`examples/harnesses/`）**：
   - 预置 `deepseek-harness/` 与 `tencent-workbuddy/` 两个示例目录，仅包含现成的 `mcp.json`、`models.json`、`gateway.yaml` 和 `SKILL.md` 模板，方便读者 3 分钟复制体验。

### 4.2 运营侧借势热点选题矩阵（公众号 / 掘金 / 知乎 / B站）

| 阶段 | 借势热点关键词 | 拟定爆款标题 | 核心痛点钩子与视觉演示物料 |
| :--- | :--- | :--- | :--- |
| **第一波：概念卡位** | `Harness Engineering`<br/>`Loop Engineering`<br/>`Agent 账单失控` | 《从 Prompt Engineering 到 Harness Engineering：为什么你的 Agent 缺一个“财务调速器”？》 | 引用 [Martin Fowler 控制论调速器观点](https://martinfowler.com/articles/harness-engineering.html) 与 [60% 循环重试成本数据](https://www.thunai.ai/blog/ai-harness-vs-ai-agent)，展示“裸奔 Harness Loop”与“挂载 AgentFinOps 的企业级 Harness”架构对比图 |
| **第二波：办公热点** | `腾讯 WorkBuddy`<br/>`多 Agent 并行`<br/>`MCP 配置实战`<br/>`企业微信审批` | 《当团队用上腾讯 WorkBuddy 多 Agent 并行，企业如何用 MCP 网关管住 API 账单与密钥安全？》 | 紧扣 [WorkBuddy 官方模型与技能文档中的费用提醒](https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Model)，演示通过 `mcp.json` 挂载 AgentFinOps 后，多 Agent 并发调用触发企微 `402` 手机卡片审批的动图 |
| **第三波：极客热点** | `DeepSeek Harness`<br/>`万物皆插件 (Cordis)`<br/>`Coding Agent 安全` | 《拆解 DeepSeek Harness 万物皆插件架构：如何基于 MCP 与三态账本构建零信任企业 Agent？》 | 剖析 [DeepSeek Harness (`dsh`)](https://github.com/deepseek-ai/deepseek-harness) 的 `Gate/Mandate` 机制（[MindStudio](https://www.mindstudio.ai/blog/deepseek-harness-plugin-architecture)），演示如何用 `Hold/Capture/Release` 三态状态机与四级预算锁补齐开源 Coding Agent 的政企合规拼图 |

# AgentFinOps 官方开发与技术架构文档 🚀

> **定位**：企业级 AI 行为审计与资金防火墙网关 (AI Agent Gateway & FinOps)  
> **核心使命**：为政企与生产级 AI Agent 提供金融级安全防火墙、组织树状配额切分、无人值守自治预算信封与不可篡改审计  
> **官方主线基线**：对齐 Master Roadmap v2.0.0 架构规范

---

## 平台愿景与核心壁垒 (Vision & Moat)

在企业级大模型与智能体规模化落地过程中，底层的支付与结算通道（微信支付、支付宝、企业对公转账、银企直联）是可插拔的基础设施。AgentPay / AgentFinOps 最核心且不可替代的壁垒在于：

> **架设在“AI 智能与推理”与“外部资金与数据资源”之间的「金融防火墙（Financial Firewall）」、「防悬挂三态状态机（Hold/Capture/Release）」以及「不可篡改行为审计黑匣子」。**

```text
                               ┌────────────────────────────────────────────────────────┐
                               │     AgentPay: 企业级 AI 行为审计与资金防火墙网关 (FinOps) │
                               └───────────────────────────┬────────────────────────────┘
              ┌────────────────────────────┬───────────────┴───────────────┬────────────────────────────┐
              ▼                            ▼                               ▼                            ▼
     【模块一：企业内控与安全】      【模块二：FinOps与财务闭环】    【模块三：微计费与高并发清算】   【模块四：生态与全栈开发】
     • 自主预算信封物理阻断          • 租户/部门/项目树状预算切分      • 毫秒级 Token 流式微计费       • MCP 协议原生支付中间件
     • 独立进程外 Sidecar 防御       • 微信/支付宝企业预付充值        • 高频批量记账缓冲与聚合落盘     • 与 Langfuse 深度联动共生
     • 云端 KMS / 国密 HSM 硬件签名  • 严防“二清”持牌合规分账         • 分布式集群与多节点一致性       • Java/Spring Boot Starter
     • 行为异动实时检测与自适应熔断  • 数电发票与对账单流水导出       • 五重对账巡检与自动平账调度     • 推进行业行为审计协议标准
```

---

## 核心产品定位与企业价值

| 维度 | **企业级 AI 行为审计与资金防火墙 (Enterprise FinOps Gateway)** |
| :--- | :--- |
| **核心定位** | **AI Agent Gateway & FinOps Financial Firewall** |
| **主要客群** | 接入生产环境的政企客户、Agent 开发者、SaaS 服务商、企业内部 IT 与财务平台 |
| **解决痛点** | 预防 Agent 死循环刷爆预算、财务分摊一团烂账、合规审计定责困难、失控调用造成资产损失 |
| **资金通道** | 人民币预付虚拟账本（6 位微单位）、企业对公汇款凭证审核、微信支付/支付宝对接、数电发票直连 |

---

## 核心技术特性

- ⚡ **反向代理与微支付网关**：基于 Go 语言构建的极速网关，流式解析 LLM 响应，原生支持 HTTP 402 协议握手与挑战重放。
- 🛡️ **秒级防死循环熔断**：滑动窗口 RPM 监控，当智能体发生非受控递归或 Prompt 注入攻击时，毫秒级掐断网络出入口，杜绝天价账单。
- 🛡️ **单笔限额物理阻断与零资损解冻**：单笔调用超过预算硬顶时，网关立即阻断并瞬间释放预扣额度 (Release)，实现零资金损失与大模型自主结构化自救。
- 🏢 **四级树状多层预算切分**：**租户 $\to$ 事业群/部门 $\to$ 项目组 $\to$ 具体 Agent**，支持父节点总预算硬顶 + 子节点月度配额划拨与级联约束。
- ⚖️ **防悬挂三态状态机**：严格遵循 `Hold`（事前冻结）$\to$ `Capture`（事后确认扣费）$\to$ `Release`（未消耗额度原子返还），极端异常永不发生悬挂扣款。
- 📊 **不可篡改行为黑匣子**：全链路审计时间线，记录 Agent 的每一次 Tool Call 入参、响应耗时、Session ID 与扣款凭单，符合等保 2.0 规范。
- 🤝 **与 Langfuse 联合共生**：Langfuse 管“大脑”（Prompt 调试与评估），AgentPay 管“双手”（金钱拦截与物理熔断），Trace ID 跨服务无缝透传。
- 🔌 **MCP 协议原生集成**：为 Anthropic MCP Server 提供标价插件，为 MCP Client 提供端侧金融防火墙。

---

## 快速导航

### 1. 战略规划与架构决策
- [核心任务全景规划与技术演进路线图 (Master Roadmap v2.0.0)](/roadmap/)
- [Master 落地实施计划与 Phase 1 (P0) 执行分解](/roadmap/execution-plan)
- [系统全景架构与系统拓扑规范](/architecture/)
- [企业安全与 N1-N6 威胁模型](/architecture/security-model)
- [ADR-001: x402 协议架构决策](/architecture/adr-001)

### 2. FinOps 成本治理与合规财务
- [企业级 AI 行为审计与资金防火墙战术框架](/finops/)
- [树状组织多层配额模型与预算控制体系](/finops/budget-control)
- [内部虚拟钱包与只追加不可变账本](/finops/wallet-ledger)
- [国内合规在线充值与防“二清”机制](/finops/fiat-topup)

### 3. 行为安全与不可篡改审计
- [Agent 身份黑匣子与不可篡改行为审计流](/security-hitl/agent-audit)
- [消费与操作审计事件契约规范](/security-hitl/audit-events)

### 4. 核心微支付协议与模型
- [防悬挂三态状态机规范 (Hold / Capture / Release)](/protocol/state-machine)
- [跨语言协议一致性规范与统一错误码表](/protocol/consistency)
- [动态路由策略发布与 RCU 原子生效规范](/protocol/config-publishing)

### 5. 开放生态与开发者接入
- [AI Harness 与多框架集成指南 (LangChain / OpenAI / CrewAI)](/ecosystem/harness-integration)
- [MCP (Model Context Protocol) 协议原生支付中间件与防火墙](/ecosystem/mcp-plugin)
- [与 Langfuse 深度共生：打造企业级 AI 运维双子星](/ecosystem/langfuse)
- [客户端 SDK 接入指南 (Python & TypeScript)](/guide/sdk_quickstart)
- [企业管理控制台操作指南](/guide/console_guide)
- [快速安装与 Docker Compose 部署](/deployment/quickstart)

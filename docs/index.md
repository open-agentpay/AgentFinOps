# AgentFinOps 官方开发与运营文档 🚀

欢迎使用 **AgentFinOps** —— 面向企业级大模型与 AI Agent 时代打造的统一路由网关与财务成本治理（FinOps）平台。

---

## 核心价值

- ⚡ **统一智能网关**：基于 Go 语言构建的极速反向代理，毫秒级流式转发，完全兼容 OpenAI / DeepSeek / 通义千问等协议规范。
- 📊 **毫秒级 Token 计量**：精准统计单次会话及全生命周期的 Prompt / Completion Token 消耗与核算。
- 🏢 **多租户与组织预算**：支持企业多部门、多项目组隔离，提供部门预算配额硬封顶与欠费自动熔断。
- 🔀 **模型智能降级路由**：根据成本、延迟和可用性，智能路由不同复杂度的 Agent 任务，显著降低算力采购成本。
- 🔒 **企业级合规与审计**：全链路请求审计流水，核心上游 Master API Key 集中加密管控，绝不落地泄露。

---

## 快速导航
- [快速开始与安装部署](deployment/quickstart.md)
- [FinOps 成本治理与预算控制](finops/budget-control.md)
- [客户端 SDK 接入指南](guide/sdk_quickstart.md)

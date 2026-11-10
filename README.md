<div align="center">

# AgentFinOps 🚀
### 企业级 AI Agent 行为审计与资金防火墙网关 (AI Agent Gateway & FinOps)

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat&logo=docker)](https://www.docker.com)
[![Go Version](https://img.shields.io/badge/Go-1.21%2B-00ADD8?style=flat&logo=go)](https://golang.org)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D?style=flat&logo=vue.js)](https://vuejs.org)
[![Element Plus](https://img.shields.io/badge/Element--Plus-2.9-409EFF?style=flat)](https://element-plus.org)
[![Domestic Compliance](https://img.shields.io/badge/国内合规-100%25微单位资金-success.svg)](#-国内合规资金与企业财务闭环)

**[在线官方文档](https://aipmedia.cn/docs/)** | **[管理控制台](https://console.aipmedia.cn)** | **[核心 SDK 仓库](https://github.com/open-agentpay/agent-core-sdk)** | **[English Readme](README_en.md)**

</div>

---

## 💡 为什么需要 AgentFinOps？

在生成式 AI 与自主智能体（Autonomous Agents）从“玩具”迈向“政企业务生产环境”的过程中，企业技术负责人与财务总监普遍面临三大严峻挑战：

1. 🛑 **Agent 死循环狂刷商业 API**：智能体由于 Prompt 幻觉或逻辑缺陷陷入递归循环调用，**数分钟内刷爆万元额度**，传统网关事后告警已无济于事；
2. 🏢 **多部门财务分摊一团烂账**：大模型调用费用全部混在一起，**缺乏自上而下的树状配额切分**（企业 $\to$ 事业群 $\to$ 项目组 $\to$ Agent），无法精准核算成本归属；
3. ⚖️ **大额关键动作缺乏事中风控**：要么全放行（事后看账单痛哭），要么全拦截（阻断正常高价值业务），**缺乏人在回路（HITL）审批兜底与不可篡改审计定责**。

> **AgentFinOps** 定位于架设在**“AI 智能与推理”**与**“外部资金与数据资源”**之间的**企业级金融防火墙（Financial Firewall）、防悬挂状态机（Hold/Capture/Release）与全链路黑匣子**。

---

## 🏛️ 系统架构全景

```text
                               ┌────────────────────────────────────────────────────────┐
                               │       AgentFinOps: 企业级 AI 行为审计与资金防火墙网关      │
                               └───────────────────────────┬────────────────────────────┘
              ┌────────────────────────────┬───────────────┴───────────────┬────────────────────────────┐
              ▼                            ▼                               ▼                            ▼
     【模块一：协同安全与内控】      【模块二：FinOps与财务闭环】    【模块三：微支付与协议引擎】     【模块四：生态联动与观测】
     • 飞书/企微/钉钉 HITL 审批      • 4级组织树状配额切分           • HTTP 402/x402 异步挂起         • Langfuse 全链路 Trace 穿透
     • 移动端一键放行与凭证核销      • 6位微单位无浮点数存储         • 防悬挂三态机 (Hold/Capture)   • MCP 协议原生标价与防火墙
     • 单笔硬顶与滑动窗口限额        • 内部虚拟钱包与流水账本        • RCU 高性能动态热更新路由       • Python / TS / Java SDK
     • Agent 异常熔断安全沙箱        • 微信/支付宝/对公预付充值      • 10,000+ 并发毫秒级路由代理     • Spring Boot Starter 驱动
```

---

## 🌟 核心特性与功能矩阵

### 1. 办公协同与人在回路（HITL）三级风控
- **三级风控梯度**：
  - **小额**（$\le$ 阈值）：本地策略毫秒级极速放行；
  - **中大额**：触发 **HTTP 402 异步挂起**，后台向负责人的**飞书 / 企业微信 / 钉钉**推送富文本审批卡片，手机端一键放行；
  - **超大额**：单笔硬顶阻断（`SINGLE_TX_CAP_EXCEEDED`），杜绝极端失误。
- **402 防长连接阻塞**：网关返回 `402 Payment Required` 与 `approval_id` 并断开连接，避免几分钟的人工审批耗尽服务器文件描述符与连接池。
- **单次使用防重放核销**：审批放行凭证严格绑定 Agent、项目与金额，履约扣款后自动标记 `consumed`，严防重复消费。

### 2. 四级树状成本中心与级联配额
- **组织拓扑切分**：**租户（企业） $\to$ 事业群/部门 $\to$ 项目组 $\to$ 具体 Agent**。
- **级联硬顶熔断**：任何一笔请求扣款，必须同时满足 Agent 单笔上限、项目月度预算、祖先各级部门月度总额及企业总账户余额，任一层超限立即精准阻断。

### 3. 国内合规资金与企业财务闭环
- **无加密货币、零海外牌照风险**：资金进出国内合规对公账户与企业收银台，换算为内部不可跨租户互转、不可提现的虚拟账本微单位，纯属于算力预售，符合国内合规监管。
- **6 位微单位严格避免浮点数**：入账边界严格执行 $\text{amount\_base\_units} = \text{payment\_minor\_amount} \times 10,000$（1 元 = 1,000,000 微单位），数据库与网关底层全程整型计数，严禁浮点数。
- **双层幂等防重复入账**：`external_ref` 与流水唯一索引组合，防御第三方支付渠道重试 Webhook 造成的重复入账。

### 4. 深度联动 Langfuse 全链路 Trace
- **双剑合璧**：Langfuse 负责大脑监控（Prompt 追踪、Token 质量、打分评估），AgentPay 负责双手防火墙（配额控制、金额拦截、合规平账）。
- **全链路穿透**：网关自动持久化 `X-Langfuse-Trace-Id` 与 `X-Langfuse-Span-Id`，控制台支持一键跳转对应 Trace 详情排查。

---

## 📊 传统 API 网关 vs AgentFinOps 对比

| 维度 | 传统 API 网关 (Kong / APISIX / Nginx) | AgentFinOps (企业 AI 资金防火墙) |
| :--- | :--- | :--- |
| **计费单位** | 仅按 HTTP 请求次数 (QPS / RPM) | **Prompt/Completion Token 流式精准微计量** |
| **风控深度** | IP/API Key 黑白名单、粗粒度限流 | **单笔金额、24h 预算、三级风控审批拦截** |
| **协同办公** | 需侵入业务代码或自行开发 Webhook | **开箱即用飞书/企微/钉钉移动端一键放行卡片** |
| **长连接处理** | 人工审批需长挂连接，易耗尽连接池 | **HTTP 402 异步挂起 + 客户端自动探测自愈重放** |
| **组织架构** | 仅支持平铺式 API Key | **租户 $\to$ 部门 $\to$ 项目 $\to$ Agent 四级树状配额治理** |
| **防悬挂保证** | 接口超时后往往造成扣款与履约不一致 | **Hold $\to$ Capture $\to$ Release 资金三态防悬挂** |

---

## 🛠️ 5 分钟极速上手 (Quickstart)

### 1. 启动全套服务 (Docker Compose)

```bash
# 1. 克隆代码仓库
git clone https://github.com/open-agentpay/AgentFinOps.git
cd AgentFinOps

# 2. 配置环境变量 (包含数据库密码与 JWT 密钥)
cp .env.example .env

# 3. 一键启动网关、控制台与 PostgreSQL
docker compose up -d
```

启动完成后访问：
- **FinOps 企业控制台**：`http://localhost:8080`（默认管理员体验登录）
- **网关代理边缘入口**：`http://localhost:8000`
- **在线文档中心**：`http://localhost:8000/docs/`

---

### 2. 客户端接入示例 (Python)

```bash
pip install agentpay-core-sdk
```

```python
from agentpay_core import AgentPayClient

# 初始化 Agent 客户端 (自动配置资金防火墙)
client = AgentPayClient(
    gateway_url="http://localhost:8000",
    api_key="apk_test_secret_key_123456",
    auto_poll_hitl=True # 遇到 402 审批自动进入友好等待并在手机放行后自动重试
)

# 发起高价值工具调用或大模型推理
response = client.post(
    path="/v1/chat/completions",
    json={
        "model": "deepseek-r1",
        "messages": [{"role": "user", "content": "生成 2026 年 Q4 智能体运营与财报分析"}]
    }
)

print("推理结果:", response.json())
```

---

## 🖥️ 控制台界面一览

| 树状部门与成本中心治理 | 实时概览与大盘监控 |
| :---: | :---: |
| 树状架构划拨月度预算硬顶，实时掌控各部门消耗进度 | 毫秒级监控并发路由、组织账户流水与各 Agent 活动 |

---

## 🗺️ 官方技术演进路线图

本项目严格遵循 [《AgentPay 核心任务全景规划与技术演进路线图 (Master Roadmap) v2.0.0》](https://aipmedia.cn/docs/roadmap/) 演进：
- **Phase 1 (当前主线)**：树状部门组织与级联配额引擎、飞书/企微人在回路 (HITL) 审批、国内合规在线充值、MCP 协议支付中间件、Langfuse 深度共生。
- **Phase 2 (重要演进)**：毫秒级 Token 流式微计费与批量落盘、Java / Spring Boot Starter SDK (`@AgentPayGuard`)。
- **Phase 3 (硬件与集群)**：进程外隔离 Sidecar 守护进程、云端 KMS 与国密硬件 HSM 签名、分布式网关集群与五重对账平账调度器。

---

## 🤝 开发者社区与交流

如果您在企业内部落地 AI Agent、多智能体协同、Token 计费分摊或资金安全防护方面有任何问题与见解，欢迎通过以下渠道交流：

- **官方文档**：[https://aipmedia.cn/docs/](https://aipmedia.cn/docs/)
- **微信公众号**：关注微信公众号「**杰哥AI运营**」
- **社群助理微信**：添加助理微信 `jie125846` 备注「**智能体防火墙**」拉入技术交流群
- **技术交流邮箱**：[julywhj@163.com](mailto:julywhj@163.com)
- **问题反馈与建议**：欢迎提交 [GitHub Issues](https://github.com/open-agentpay/AgentFinOps/issues) 或 Pull Request 参与共建。
- **技术讨论区**：欢迎在 [GitHub Discussions](https://github.com/open-agentpay/AgentFinOps/discussions) 发起提问与方案讨论。

---

## 📄 开源许可证

本项目基于 [Apache License 2.0](LICENSE) 开源发布。

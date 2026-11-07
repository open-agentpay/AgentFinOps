# AgentFinOps 开发与协作规范指南

## 项目定位与核心架构

AgentFinOps 是面向自主 AI Agent 的企业级成本治理平台、API 网关与“财务防火墙”，基于纯净的通用配额与内部企业账本结算体系。

### 核心能力与组件划分

1. **企业财务防火墙（Financial Firewall & Policy Engine）**：买方本地前置核验，支持单笔限额、24小时滑动窗口预算、上游域名白名单、熔断与高频死循环拦截。
2. **企业虚拟账本与配额核销（Quota & Ledger Settlement）**：两阶段 `Hold -> Fulfill -> Capture/Release` 资金预留与扣款机制，杜绝超额消费与失败计费。
3. **企业自托管网关（Go Cloud-Native Gateway）**：支持企业组织账户结算模式，具备 RCU 零停机配置热更新、多租户 RBAC、上游凭证 AES-256-GCM 加密与 SSRF 防护。
4. **控制台与开发者市场（Console & Marketplace）**：
   - `apps/console`：Vue 3 + Element Plus 企业租户控制台、账本调账、路由管理与双人双控审批。
   - `apps/marketplace-web`：Next.js 14 API 开发者生态展示、快速接入体验与机器规格文档（`/llms.txt`）。

### 仓库目录结构

```text
AgentFinOps/
├── services/
│   └── gateway/                      Go 云原生网关服务
├── apps/
│   ├── console/                      Vue 3 企业管理控制台
│   └── marketplace-web/              Next.js 14 开发者服务市场
├── infra/
│   └── postgres/                     PostgreSQL DDL 模式与迁移
└── docs/                             架构设计、合规规范与操作指南
```

---

## 常用命令速查

### 1. Go 网关构建与测试
```bash
# 编译网关二进制
make gateway-build

# 执行网关单元测试与集成测试
make gateway-test
```

### 2. 前端控制台 (Vue 3)
```bash
# 本地开发模式
make console-dev

# 生产环境打包
make console-build

# 运行自动化测试
make console-test
```

---

## 核心设计与安全规范

1. **企业合规与纯净化约束**：
   - 严禁在代码、注释、配置、Schema 中引入非合规虚拟资产或任何外部公网记账地址。
   - 统一使用 `CNY`, `USD`, `EUR` 或 `CREDITS` 作为标准计量与计费单位。
2. **租户隔离与 RBAC 控制**：
   - 所有数据请求必须携带有效的租户与用户上下文，禁止越权访问。
3. **幂等性与资金安全**：
   - 账本调账、额度划拨与消费扣减必须携带唯一幂等键，避免重复入账或扣减。
4. **对称加密安全**：
   - 上游 API Key 等敏感凭证落库必须使用系统标准密码学库（AES-256-GCM）加密。

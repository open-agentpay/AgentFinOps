# 方案 A 详细架构设计规范：通用 Core SDK 与 企业级 FinOps 插件化解耦

> **设计版本**：v1.0.0 (Approved Architecture Blueprint)  
> **状态**：待确认 (Pending User Approval)  
> **所属规划**：Master Roadmap v2.0.0 阶段一核心任务（组织多层配额与人在回路）

---

## 1. 架构定位与权责边界 (Architecture Boundaries)

为保证系统的极致解耦与通用性，严格划分两层代码库的职责边界：

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        【AgentFinOps: 企业级管理与控制平台】                             │
│                                                                                        │
│   • 组织架构与成本中心 (Department Tree: 事业群/中心 → 二级组)                             │
│   • 级联配额聚合与熔断 (Enterprise Cascade Quota: Agent → Project → Dept → Tenant)     │
│   • 人在回路审批工作流 (HITL 402: 飞书 / 企业微信 / 钉钉交互卡片审批)                      │
│   • 合规财务核销与数电发票 (FinOps Compliance: 对账单导出、税务对齐)                    │
│   • Web 控制台 (apps/console) 与 运营底座 (infra/postgres)                             │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ 实现抽象接口 / 注入扩展钩子
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                       【agent-core-sdk: 通用开源网关与协议核心】                        │
│                                                                                        │
│   • HTTP 402 / x402 协议核心规范解析与挑战签发 (Challenge-Authorization Handshake)      │
│   • 防悬挂三态资金状态机 (Hold / Capture / Release 核心原子原语)                          │
│   • 通用租户与项目上下文 (Tenant, Project, API Key, Route, Wallet)                       │
│   • 标准 Agent Identity 解析与默认基础限额 (DefaultAgentEnforcer: RPM / 24h 单体)        │
│   • 通用多语言 SDK (Python, TypeScript)                                                │
│                                                                                        │
│   ★ 核心扩展点 (Extension Hooks):                                                      │
│     ├── PolicyEvaluator (请求前置策略判定接口，支持插件式链式拦截)                       │
│     ├── SpendRecorder   (资金扣款成功后的支出记录钩子)                                   │
│     └── ExtraRouteRegistrar (企业级自定义 HTTP 路由挂载钩子)                            │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 通用层设计：`agent-core-sdk` 抽象接口与扩展钩子

`agent-core-sdk` 保持绝对中立，不包含任何“部门（Department）”、“企业微信审批（HITL）”等特定政企概念。通过以下三个标准接口对外暴露扩展能力：

### 2.1 策略判定接口 (`agent.PolicyEvaluator`)

在 `agent-core-sdk/gateway/agent/evaluator.go` 中定义标准抽象：

```go
package agent

import "context"

// PolicyRequest 封装到达网关的请求全量上下文（只读且标准规范）
type PolicyRequest struct {
	Agent       *AgentIdentity         `json:"agent"`
	Policy      *AgentPolicyConfig     `json:"policy"`
	RouteID     string                 `json:"route_id"`
	RoutePath   string                 `json:"route_path"`
	AmountBase  int64                  `json:"amount_base_units"`
	Currency    string                 `json:"currency"`
	Declared    *DeclaredContext       `json:"declared,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// PolicyDecision 封装策略判定结果
type PolicyDecision struct {
	Allowed    bool                   `json:"allowed"`
	ReasonCode string                 `json:"reason_code"` // 例如 ALLOW, ERR_POLICY_MAX_PER_TX, ERR_HITL_APPROVAL_REQUIRED 等
	Reason     string                 `json:"reason"`
	RuleID     string                 `json:"rule_id,omitempty"`
	Extra      map[string]interface{} `json:"extra,omitempty"` // 承载审批 ID、挂起详情等元数据
}

// PolicyEvaluator 定义请求通过前置金融防火墙的判定规则
type PolicyEvaluator interface {
	Evaluate(ctx context.Context, req *PolicyRequest) PolicyDecision
}
```

* **默认实现**：保留原有的 `Enforcer` 作为开箱即用的 `DefaultAgentEnforcer`，只做 Agent 级单笔硬顶、RPM 滑动窗口和 Agent 滚动 24h 预算校验。
* **链式组合器 (`ChainEvaluator`)**：支持多个 Evaluator 按序执行，遇到任一拒绝立即熔断中断。

### 2.2 支出记录钩子 (`agent.SpendRecorder`)

当交易在 upstream 执行成功并成功触发 `CaptureFunds` 后，网关触发支出记录通知：

```go
// SpendRecord 封装扣款成功的账务明细
type SpendRecord struct {
	TenantID   string `json:"tenant_id"`
	ProjectID  string `json:"project_id"`
	AgentID    string `json:"agent_id"`
	RouteID    string `json:"route_id"`
	AmountBase int64  `json:"amount_base_units"`
	Currency   string `json:"currency"`
	HoldID     string `json:"hold_id"`
	CapturedAt int64  `json:"captured_at"`
}

// SpendRecorder 定义资金扣减后的支出统计监听器
type SpendRecorder interface {
	RecordSpend(ctx context.Context, record *SpendRecord) error
}
```

### 2.3 网关服务可选参数注入 (`server.Option`)

在 `agent-core-sdk/gateway/server/server.go` 与 `gateway/x402/handler.go` 中：

```go
// ServerOptions 扩展可选依赖
type ServerOptions struct {
	// ... 原有选项
	PolicyEvaluator agent.PolicyEvaluator
	SpendRecorder   agent.SpendRecorder
	ExtraRoutes     map[string]http.Handler
}

// WithPolicyEvaluator 允许宿主注入自定义前置策略评估器
func WithPolicyEvaluator(evaluator agent.PolicyEvaluator) Option {
	return func(o *ServerOptions) {
		o.PolicyEvaluator = evaluator
	}
}

// WithSpendRecorder 允许宿主注入自定义支出统计器
func WithSpendRecorder(recorder agent.SpendRecorder) Option {
	return func(o *ServerOptions) {
		o.SpendRecorder = recorder
	}
}

// WithExtraRoute 允许宿主在网关 ServeMux 上挂载企业扩展 REST 路由
func WithExtraRoute(path string, handler http.Handler) Option {
	return func(o *ServerOptions) {
		if o.ExtraRoutes == nil {
			o.ExtraRoutes = make(map[string]http.Handler)
		}
		o.ExtraRoutes[path] = handler
	}
}
```

---

## 3. 企业层设计：`AgentFinOps` 核心落地

所有企业级专有逻辑完全在 `AgentFinOps` 中实现与维护，代码位于 `AgentFinOps/services/gateway` 与 `AgentFinOps/infra`。

### 3.1 目录组织结构

在 `AgentFinOps/services/gateway` 中建立企业级扩展包：

```text
AgentFinOps/services/gateway/
├── cmd/
│   └── gateway/
│       └── main.go                 # 组装 Core SDK 与 Enterprise Plugins 的主入口
├── internal/
│   └── enterprise/
│       ├── department/
│       │   ├── models.go           # 部门实体、状态定义与防环算法
│       │   ├── repository.go       # PostgreSQL ap_department 持久化
│       │   ├── service.go          # 部门 CRUD 业务逻辑
│       │   └── handler.go          # REST 接口: /api/v1/tenants/:tenantID/departments
│       ├── quota/
│       │   ├── enforcer.go         # 实现 agent.PolicyEvaluator (部门+项目+Agent 级联熔断)
│       │   └── recorder.go         # 实现 agent.SpendRecorder (原子更新各层级消费滑动窗口)
│       └── hitl/
│           ├── models.go           # ap_approval_request 实体与三级风控判定
│           ├── enforcer.go         # 中大额触发 ERR_HITL_APPROVAL_REQUIRED 402 挂起
│           ├── channels/           # 飞书、企微、钉钉 Webhook 卡片拼装与推送
│           └── handler.go          # 审批回调与凭证重放接口: /api/v1/approvals/callback
```

### 3.2 级联配额评估器实现 (`quota.CascadeQuotaEnforcer`)

`CascadeQuotaEnforcer` 实现 `agent.PolicyEvaluator` 接口：
1. **Agent 级校验**：代理调用 `defaultAgentEnforcer.Evaluate(...)`。
2. **Project 级校验**：从本地缓存或 DB 查询当前 Project 月度限额，对比已消耗额度；超额返回 `ERR_QUOTA_EXCEEDED_PROJECT`。
3. **Department 级校验**：如果该 Project 归属于某一 `department_id`：
   * 递归向上查询部门树（当前组 $\to$ 父部门 $\to$ 事业群），检查每一层节点的 `budget_cap_monthly_base_units`；
   * 若任一层超限，立即返回 `ERR_QUOTA_EXCEEDED_DEPARTMENT`。
4. **Tenant 级钱包校验**：检查虚拟账户可用余额；不足返回 `ERR_INSUFFICIENT_FUNDS`。

### 3.3 数据库模型 (`infra/postgres/schema.sql`)

保持在 `AgentFinOps/infra/postgres/schema.sql` 中维护：
* `ap_department`：支持无限级树状自引用 `parent_id` 与月度预算 `budget_cap_monthly_base_units`。
* `ap_project` 增加 `department_id NULL REFERENCES ap_department`。
* `ap_approval_request`：存储 402 异步挂起审批详情。

### 3.4 控制台体验 (`apps/console`)

* **部门与成本中心** (`src/views/departments/index.vue`)：独立页面，树形表格呈现部门层级、预算进度条、子部门创建与归档。
* **业务项目协同** (`src/views/projects/index.vue`)：在新建和编辑项目时提供“所属部门”选择，实现自上而下的成本切分。
* **审批列表与流转** (`src/views/approvals/index.vue`)：人工兜底放行/拒绝中大额挂起事务。

---

## 4. 方案实施与交付路线图 (Step-by-Step Milestones)

| 阶段 | 交付物 | 涉及代码仓库 | 验证标准 |
| :--- | :--- | :--- | :--- |
| **步骤 1** | 在 `agent-core-sdk` 中引入 `PolicyEvaluator`、`SpendRecorder` 接口及 `ServerOptions` 注入支持 | `agent-core-sdk` | 通用单元测试通过，向后兼容现有默认行为，`go test ./...` 19个包全绿 |
| **步骤 2** | 在 `AgentFinOps` 中实现 `enterprise/department` CRUD 领域模型、PostgreSQL 存储与 REST API | `AgentFinOps` | 部门树防环测试通过，REST 接口符合标准规范 |
| **步骤 3** | 在 `AgentFinOps` 中实现 `enterprise/quota` 级联配额 Evaluator 与 Recorder 并注入服务主入口 | `AgentFinOps` | 集成测试验证跨层级（部门超额、项目超额）精准拦截，Core SDK 无侵入 |
| **步骤 4** | 在 `AgentFinOps/apps/console` 中集成部门管理视图与项目归属联动 | `AgentFinOps` | Vite 编译无报错，UI 树状展示与表单创建顺畅 |

---

## 5. 决策确认 (Design Approval Check)

请您审阅以上设计规范。若此方案完全符合您的架构预期，请确认批准，我们将严格按照上述四个步骤逐步推进编码落地。

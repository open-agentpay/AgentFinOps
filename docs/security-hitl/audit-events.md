# 消费与操作审计事件契约规范

> **规范版本**：2.0.0 (企业级生产审计事件规范)  
> **状态**：正式规范 (Approved Specification)  
> **适用范围**：Go Gateway 数据面、控制面 API、虚拟钱包账本引擎、离线对账与合规导出  
> **合规基准**：对齐等保 2.0 行为留痕与企业不可篡改财务审计标准

---

## 1. 契约目标与核心原则

在 AgentFinOps 企业级多租户与 AI 智能体治理架构中，审计事件（Audit Events）是平台实现**资金安全追溯、纠纷争议定责、高频计量计费、不可抵赖审计以及跨服务可观测性**的唯一信任事实来源（Single Source of Truth）。

### 1.1 设计原则
1. **只追加、永不可变 (Append-Only & Immutable)**：所有审计事件一经产生并持久化，严禁任何形式的更新（UPDATE）或物理删除（DELETE）。
2. **事件驱动与异步解耦 (Event-Driven & Asynchronous)**：网关核心链路采用无锁环形缓冲区将事件投递至事件总线，严禁审计持久化阻塞在线请求。
3. **因果与全链路关联 (Correlation & Causality)**：每个事件必须携带结构化追踪标头（`request_id`, `idempotency_key`, `intent_id`, `hold_id`, `trace_id`），支持从单次网关 HTTP 调用一直追溯到底层记账流水与 Langfuse 观测面板。

---

## 2. 实体前缀与 ID 规范

系统采用带语义前缀的防碰撞唯一标识符：

| 前缀 | 实体类型 | 格式示例 | 业务语义 |
| :--- | :--- | :--- | :--- |
| `req_` | 网关请求记录 ID | `req_01j7b8z4m0k9x8y1` | 对应单次客户端到网关的 HTTP 交互 |
| `pi_`  | 支付意图 ID | `pi_01j7b8z4m0k9x8y2` | 标识一次完整的业务消费声明 |
| `hld_` | 资金冻结记录 ID | `hld_01j7b8z4m0k9x8y3`| 对应虚拟账本中一次配额预留 (Hold) |
| `ent_` | 账本流水记录 ID | `ent_01j7b8z4m0k9x8y4`| 对应不可变账本中的一次资产变动 |
| `appr_`| 人工审批单 ID | `appr_01j7b8z4m0k9x8y5`| 对应一次飞书/企微发起的 HITL 审批单 |
| `top_` | 充值订单 ID | `top_01j7b8z4m0k9x8y6`| 企业管理员划拨、微信/支付宝充值单号 |

---

## 3. 标准审计事件载荷 Schema (Payload Schema)

所有事件均遵循通用 Envelope 封装：

```json
{
  "event_id": "evt_01j7b8z4m0k9x8y7",
  "event_type": "ledger.captured",
  "version": "2.0",
  "occurred_at": "2026-11-07T10:30:00.123456Z",
  "tenant_id": "ten_enterprise_finance",
  "department_id": "dept_ai_lab",
  "project_id": "prj_copilot",
  "agent_id": "agent_code_reviewer",
  "request_id": "req_01j7b8z4m0k9x8y1",
  "idempotency_key": "idemp_client_req_888",
  "context": {
    "intent_id": "pi_01j7b8z4m0k9x8y2",
    "hold_id": "hld_01j7b8z4m0k9x8y3",
    "trace_id": "langfuse_trace_999",
    "client_ip": "192.168.1.100",
    "actor_type": "api_key",
    "actor_id": "apk_live_xxx"
  },
  "data": {
    "amount_base_units": 500000,
    "asset": "CNY",
    "actual_tokens": {
      "prompt_tokens": 120,
      "completion_tokens": 350,
      "total_tokens": 470
    },
    "upstream_latency_ms": 680
  }
}
```

---

## 4. 核心事件分类与字典

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        五大核心审计事件域                              │
├───────────────────┬────────────────────────────────────────────────────┤
│ 1. 流量与请求域   │ request.received, request.forwarded,               │
│                   │ request.completed, request.failed                  │
├───────────────────┼────────────────────────────────────────────────────┤
│ 2. 资金与账本域   │ ledger.held, ledger.captured, ledger.released,     │
│                   │ ledger.adjusted, ledger.reversed                   │
├───────────────────┼────────────────────────────────────────────────────┤
│ 3. 协同审批 (HITL)│ approval.requested, approval.approved,             │
│                   │ approval.rejected, approval.expired                │
├───────────────────┼────────────────────────────────────────────────────┤
│ 4. 风控与熔断域   │ policy.blocked, circuit_breaker.tripped,           │
│                   │ circuit_breaker.reset, quota.warning_80            │
├───────────────────┼────────────────────────────────────────────────────┤
│ 5. 充值与财务域   │ topup.order.created, topup.order.confirmed,        │
│                   │ invoice.issued, invoice.downloaded                 │
└───────────────────┴────────────────────────────────────────────────────┘
```

| 事件类型 (`event_type`) | 触发时机 | 关键业务属性 |
| :--- | :--- | :--- |
| `ledger.held` | 网关转发前锁定预估最大金额 | `hold_id`, `amount_base_units`, `asset`, `ttl` |
| `ledger.captured` | 上游成功响应后确认实扣入账 | `hold_id`, `actual_cost`, `actual_tokens` |
| `ledger.released` | 调用失败/超时释放预留额度 | `hold_id`, `released_amount`, `reason` |
| `approval.requested` | 超过风控阈值生成审批卡片 | `approval_id`, `approver_channel`, `card_id` |
| `approval.approved` | 负责人在飞书/企微一键放行 | `approval_id`, `approver_id`, `approved_at` |
| `circuit_breaker.tripped`| 达到滑动窗口 RPM 判定死循环 | `agent_id`, `current_rpm`, `threshold_rpm` |
| `topup.order.confirmed` | 微信/支付宝/对公入账核销完成 | `topup_id`, `external_ref`, `channel`, `amount` |

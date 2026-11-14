# 场景二：显式意图付费与异步结算轮询（LangChain / LangGraph）

> **适用场景**：多步推理决策；大额支付确认；长耗时算力或第三方异步交付任务（如深度研报合成、文生视频）。  
> **模型感知度**：**高度感知**（大模型显式决策何时付钱、何时轮询）  
> **延迟开销**：中（增加模型决策轮次）  
> **文档章节**：[AI Harness 与 Agent 框架集成指南](../../docs/ecosystem/harness-integration.md#场景二显式意图付费与异步结算轮询langchain--langgraph)

---

## 核心机制

在复杂的长耗时任务中，Agent 必须通过标准工具对资金和交付状态具备确定性感知：
1. **`agentpay_pay`**：传入 `resource_id` 与 `amount` 创建支付意图并冻结 Quota；若异步结算返回 `PENDING` 与建议动作 `POLL_STATUS`；
2. **`agentpay_get_payment`**：根据 `payment_intent_id` 指数退避轮询对账；**严禁在状态未知时重新发起新支付**，防止二次扣款。

---

## 运行方式

```bash
python examples/harness-integrations/02-langchain-explicit-polling/main.py
```

支持开箱即跑：内置高保真 LangChain AgentExecutor 模拟，无需配置 OpenAI API Key 即可查看完整推理、工具调用与轮询全过程！

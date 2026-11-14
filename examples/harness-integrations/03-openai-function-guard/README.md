# 场景三：OpenAI Agents SDK 原生函数与守卫保护

> **适用场景**：OpenAI 原生 Function Calling / Agents SDK；企业内部已有高风险、高开销工具（如 GPU 训练、云资源开通、数据库大批量写入、短信群发），需在工具执行前执行硬性预算与权限拦截。  
> **模型感知度**：**拦截时感知**（正常时零开销，拦截时向模型抛出中文修复建议）  
> **延迟开销**：极低（本地/远程轻量 Dry-run 预检）  
> **文档章节**：[AI Harness 与 Agent 框架集成指南](../../docs/ecosystem/harness-integration.md#场景三openai-agents-sdk-原生函数与守卫保护)

---

## 核心机制

- **`@protect_openai_function` 装饰器**：包裹本地高成本 Python 函数；
- **前置 Dry-run 预检**：在函数真正执行前，根据传入的 `amount` 与 `resource_id` 调用策略防火墙；
- **Fail-Closed 物理拦截**：如果策略评估为拒绝（超预算或非白名单），**下游业务函数一行代码都不会被执行**，保护企业资金与算力资源；
- **LLM-Friendly Observation**：通过 `handle_openai_tool_call` 将错误码（如 `SINGLE_TX_CAP_EXCEEDED`）转化为大模型可理解的提示，指导模型降级或向人类申请预算。

---

## 运行方式

```bash
python examples/harness-integrations/03-openai-function-guard/main.py
```

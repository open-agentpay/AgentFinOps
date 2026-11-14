# 场景四：CrewAI 多 Agent 隔离协同支付

> **适用场景**：多智能体（Multi-Agent）协同流水线；多角色分工（如调研员、架构师、审查员、财务分析师）。  
> **核心风控**：**角色级最小权限隔离（Principle of Least Privilege）**  
> **文档章节**：[AI Harness 与 Agent 框架集成指南](../../docs/ecosystem/harness-integration.md#场景四crewai-多-agent-隔离协同支付)

---

## 核心痛点与解法

在传统的 Multi-Agent 架构中，所有 Agent 往往共用同一个全局执行上下文或同一组 API Key。一旦某个子智能体产生逻辑死循环或越权决策，就会迅速刷爆整个团队的账单。

**AgentPay 角色级安全隔离规范**：
- **按角色细粒度赋权**：仅向必须对外拉取商业付费数据的角色（如 `Researcher`）挂载支付工具；
- **纯分析/推理角色资金零权限**：负责汇总分析的角色（如 `Analyst`）工具列表设为空（`tools=[]`），物理隔离支付能力；
- **子任务级独立 Quota 树**：即使 Researcher 有支付权限，也受单笔限额（如 0.50 元）与部门预算锁约束。

---

## 运行方式

```bash
python examples/harness-integrations/04-crewai-role-isolation/main.py
```

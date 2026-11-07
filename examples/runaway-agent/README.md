# Runaway Agent Circuit Breaker & FinOps Firewall Demo

This example demonstrates how **AgentFinOps** and **`agent-core-sdk`** provide a local financial firewall and autonomous circuit breaker for enterprise AI agents, preventing quota exhaustion from hallucinated loops while metering real API usage.

---

## 3 Core Capabilities Demonstrated:

1. **Phase 1: 正常微调用配额扣减与计量审计 (Normal Quota Metering & Audit Log)**
   - Agent executes an API tool call via LangChain `@paid_tool` (0.05 Credits / 50 Tokens).
   - Satisfies quota challenge via AgentFinOps QuotaAdapter.
   - Gateway records audit log and updates tenant balance.
2. **Phase 2: 单次超额本地主动防御 (Single-Call Budget Cap Defense)**
   - Agent attempts to call an expensive enterprise compute endpoint requiring 2.50 Credits.
   - Enterprise agent policy allows max 0.10 Credits per call.
   - Financial firewall **immediately aborts** call locally: 0 quota consumed.
   - Clean feedback observation returned to LangChain agent.
3. **Phase 3: 失控死循环与熔断器介入 (Runaway Infinite Loop Tripped Circuit Breaker)**
   - Agent gets stuck in a rapid tool-calling loop (limit: 5 requests per minute).
   - Exceeding the rate limit immediately trips the circuit breaker: `CLOSED` -> `OPEN`.
   - All subsequent loop attempts are fast-failed locally with `CIRCUIT_BREAKER_OPEN`.
   - Protects enterprise quotas and prevents runaway cloud bill shocks.

---

## Usage:

```bash
python examples/runaway-agent/demo.py
```

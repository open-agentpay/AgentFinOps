#!/usr/bin/env python3
"""
AgentFinOps Harness Integration Demo - Scenario 3: OpenAI Agents SDK Function Guard.

Demonstrates how the @protect_openai_function pre-execution guard intercepts expensive
tool calls (e.g. GPU cluster provisioning) BEFORE execution occurs, preventing budget
runaway and feeding back a structured observation to the LLM.

Usage:
  python examples/harness-integrations/03-openai-function-guard/main.py
"""

from __future__ import annotations

import functools
import json
from typing import Any, Callable

# ANSI Colors
class Colors:
    HEADER = "\033[95m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    BOLD = "\033[1m"
    RESET = "\033[0m"


class AgentPayBudgetExceededError(Exception):
    """Raised when a tool call exceeds configured budget thresholds."""

    def __init__(self, message: str, code: str = "BUDGET_EXCEEDED"):
        super().__init__(message)
        self.code = code


class MockPolicyEngine:
    """Evaluates transaction against budget caps before execution (Dry-run)."""

    def __init__(self, max_per_tx_cny: float = 1.00, daily_budget_cny: float = 10.00):
        self.max_per_tx_cny = max_per_tx_cny
        self.daily_budget_cny = daily_budget_cny
        self.spent_today_cny = 0.0

    def evaluate(self, resource_id: str, amount_cny: float) -> tuple[bool, str]:
        if amount_cny > self.max_per_tx_cny:
            return (
                False,
                f"SINGLE_TX_CAP_EXCEEDED: 请求金额 {amount_cny:.2f} 元超过单笔上限 {self.max_per_tx_cny:.2f} 元",
            )
        if self.spent_today_cny + amount_cny > self.daily_budget_cny:
            return (
                False,
                f"BUDGET_EXCEEDED: 累计消费将达 {self.spent_today_cny + amount_cny:.2f} 元，超出今日限额 {self.daily_budget_cny:.2f} 元",
            )
        self.spent_today_cny += amount_cny
        return True, "ALLOWED"


def protect_openai_function(
    resource_id: str,
    amount: str,
    policy: MockPolicyEngine,
    fail_closed: bool = True,
) -> Callable:
    """Decorator guarding a high-cost Python function before it can execute."""

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            cost = float(amount)
            print(f"\n{Colors.CYAN}[Guardrail Dry-run]{Colors.RESET} 拦截预检: 函数 '{func.__name__}' 申请调用付费资源 '{resource_id}' (需 {cost:.2f} 元)...")
            
            # 前置策略预检
            allowed, reason = policy.evaluate(resource_id, cost)
            if not allowed:
                print(f"{Colors.RED}{Colors.BOLD}[Fail-Closed 阻断]{Colors.RESET} 策略拒绝: {reason}")
                raise AgentPayBudgetExceededError(reason)

            print(f"{Colors.GREEN}[Guardrail 放行]{Colors.RESET} 策略放行通过，开始执行底层业务逻辑...")
            return func(*args, **kwargs)

        return wrapper

    return decorator


def handle_openai_tool_call(tool_name: str, args: dict[str, Any], func: Callable) -> dict[str, Any]:
    """Wraps OpenAI Tool dispatching to return friendly observations to the model."""
    try:
        output = func(**args)
        return {
            "tool_call": tool_name,
            "status": "success",
            "content": output,
        }
    except AgentPayBudgetExceededError as e:
        return {
            "tool_call": tool_name,
            "status": "policy_denied",
            "error_code": e.code,
            "content": (
                f"【资金防火墙拦截通知】该操作已被系统策略硬性阻断：{str(e)}。\n"
                f"建议下一步：向人类管理员申请提额审批，或切换为低开销模型/精简任务参数。"
            ),
            "next_action": "REQUEST_BUDGET_APPROVAL",
        }


def main() -> None:
    sep = "=" * 80
    print(f"{Colors.BOLD}{Colors.HEADER}{sep}")
    print("  AgentFinOps 场景三：OpenAI Agents SDK 原生函数与守卫保护")
    print(f"{sep}{Colors.RESET}")
    print("  • 机制：通过 @protect_openai_function 在本地高成本方法执行前执行 Dry-run 预检")
    print("  • 效果：超额时物理阻断执行，防止算力透支，并返回 LLM 可读的结构化 Observation\n")

    policy = MockPolicyEngine(max_per_tx_cny=1.00, daily_budget_cny=10.00)

    # 1. 声明受守卫保护的本地高开销算力函数 (单次开销 2.50 元，超出单笔 1.00 元上限)
    @protect_openai_function(resource_id="gpu_h100_cluster", amount="2.50", policy=policy)
    def run_gpu_training(model_name: str, epochs: int) -> str:
        print(f"{Colors.BOLD}>>> [真实高成本算力已被触发] 正在占用 GPU 集群启动训练...{Colors.RESET}")
        return f"模型 {model_name} 在集群上成功启动训练 {epochs} 轮！"

    # 2. 声明受守卫保护的轻量分析函数 (单次开销 0.20 元，在预算内)
    @protect_openai_function(resource_id="quick_summary", amount="0.20", policy=policy)
    def run_quick_summary(text: str) -> str:
        return f"文本快速分析完成：字符数 {len(text)}"

    # -------------------------------------------------------------------------
    # 测试用例 1: 正常在预算内的函数调用
    # -------------------------------------------------------------------------
    print(f"{Colors.BOLD}{Colors.HEADER}--- 测试 1: 在预算内的普通工具调用 (0.20 元) ---{Colors.RESET}")
    msg1 = handle_openai_tool_call(
        tool_name="run_quick_summary",
        args={"text": "AgentFinOps 企业级安全防火墙"},
        func=run_quick_summary,
    )
    print(f"返回给 OpenAI LLM 的 Observation:\n{json.dumps(msg1, indent=2, ensure_ascii=False)}")

    # -------------------------------------------------------------------------
    # 测试用例 2: 突发超预算高开销调用 (2.50 元 > 1.00 元)
    # -------------------------------------------------------------------------
    print(f"\n{Colors.BOLD}{Colors.HEADER}--- 测试 2: 超出单笔限额的高危算力调用 (2.50 元) ---{Colors.RESET}")
    msg2 = handle_openai_tool_call(
        tool_name="run_gpu_training",
        args={"model_name": "deepseek-v3-lora", "epochs": 10},
        func=run_gpu_training,
    )
    print(f"\n返回给 OpenAI LLM 的 Observation:\n{json.dumps(msg2, indent=2, ensure_ascii=False)}")
    print(f"\n{Colors.GREEN}✓ 场景三 OpenAI 前置守卫验证成功：高成本 GPU 代码被安全物理阻断，0 费用损失！{Colors.RESET}\n")


if __name__ == "__main__":
    main()

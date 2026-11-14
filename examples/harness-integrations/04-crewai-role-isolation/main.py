#!/usr/bin/env python3
"""
AgentFinOps Harness Integration Demo - Scenario 4: CrewAI Multi-Agent Role Isolation.

Demonstrates role-based least-privilege payment isolation in a multi-agent crew:
  • Researcher: holds fine-grained AgentPay tool to query paid data (0.20 CNY).
  • Analyst: zero financial credentials/tools (pure reasoning, cannot debit funds).

Usage:
  python examples/harness-integrations/04-crewai-role-isolation/main.py
"""

from __future__ import annotations

import json
import time
from typing import Any

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


class MockAgentPayClient:
    """Simulates AgentPay Gateway for CrewAI multi-agent isolation."""

    def __init__(self, api_key: str, max_per_tx_cny: float = 0.50):
        self.api_key = api_key
        self.max_per_tx_cny = max_per_tx_cny
        self.balance_cny = 10.00

    def pay(self, resource_id: str, amount: str, agent_role: str) -> dict[str, Any]:
        cost = float(amount)
        if cost > self.max_per_tx_cny:
            raise PermissionError(f"超限：单笔 {cost} 元 > 限额 {self.max_per_tx_cny} 元")
        self.balance_cny -= cost
        return {
            "payment_intent_id": f"pi_crew_{int(time.time() * 1000)}",
            "resource_id": resource_id,
            "debited_cny": amount,
            "authorized_agent": agent_role,
            "status": "COMPLETED",
            "raw_data": {
                "ticker": "NVDA",
                "quarter": "2026-Q3",
                "data_point": "Data Center Revenue +112% YoY, Gross Margin 75.2%",
            },
        }


class SimulatedCrewAgent:
    """Represents a CrewAI Agent with designated role and tool permissions."""

    def __init__(self, role: str, goal: str, tools: list[str]):
        self.role = role
        self.goal = goal
        self.tools = tools

    def execute_task(self, task_description: str, client: MockAgentPayClient) -> str:
        print(f"\n{Colors.BOLD}{Colors.HEADER}--- [{self.role}] 开始执行任务 ---{Colors.RESET}")
        print(f"角色目标: {self.goal}")
        print(f"分配工具: {self.tools if self.tools else '[] (零外部工具，纯逻辑推理)'}")
        print(f"任务内容: {task_description}")

        # 如果任务需要支付
        if "支付" in task_description or "付费" in task_description:
            if "agentpay_pay" not in self.tools:
                print(f"{Colors.RED}{Colors.BOLD}[越权拦截]{Colors.RESET} Agent '{self.role}' 试图执行资金支付，但其权限策略未被授予 'agentpay_pay' 工具！")
                return f"【安全拒绝】角色 '{self.role}' 无资金动用权限，任务被本地沙箱安全熔断！"

            print(f"{Colors.YELLOW}[工具调用]{Colors.RESET} '{self.role}' 调用合法挂载的 agentpay_pay 购买数据...")
            result = client.pay(resource_id="sec_filings_pro", amount="0.20", agent_role=self.role)
            print(f"{Colors.GREEN}[调用成功]{Colors.RESET} {json.dumps(result, ensure_ascii=False)}")
            return f"获取到结构化企业财报数据：{json.dumps(result['raw_data'], ensure_ascii=False)}"
        else:
            print(f"{Colors.BLUE}[纯逻辑推理]{Colors.RESET} '{self.role}' 正在根据已有上下文提炼商业结论报告...")
            return (
                "【投资分析结论简报】\n"
                "根据 Researcher 收集的 NVDA 2026-Q3 财报，数据中心业务保持强劲增长；\n"
                "建议企业重点布局具备端侧推理与 FinOps 治理能力的 AI 基础设施。"
            )


def main() -> None:
    sep = "=" * 80
    print(f"{Colors.BOLD}{Colors.HEADER}{sep}")
    print("  AgentFinOps 场景四：CrewAI 多 Agent 隔离协同支付")
    print(f"{sep}{Colors.RESET}")
    print("  • 痛点：多智能体共用一把 Master Key 容易导致全员越权与账单穿透")
    print("  • 解法：角色级最小权限隔离，信息搜集员持币、分析员零权限\n")

    client = MockAgentPayClient(api_key="apk_live_guest_35f4d15ea0ea3dd5e26e7c6b9bb7c35d", max_per_tx_cny=0.50)

    # 1. 初始化两名协同 Agent
    researcher = SimulatedCrewAgent(
        role="Senior Market Researcher",
        goal="搜集行业最新财报研报，必要时在单笔 0.50 元内自主付费获取",
        tools=["agentpay_pay"],
    )

    analyst = SimulatedCrewAgent(
        role="Lead Financial Analyst",
        goal="分析整理数据并撰写报告，纯逻辑推理，绝对禁止动用资金",
        tools=[],  # 零支付权限
    )

    # 2. 模拟任务 1: Researcher 正常付费拉取数据
    print(f"{Colors.BOLD}{Colors.CYAN}>>> 任务 1: 由具有支付权限的 Researcher 搜集付费数据{Colors.RESET}")
    data_output = researcher.execute_task("获取 resource_id='sec_filings_pro' 的数据并支付 0.20 元", client)
    print(f"Task 1 输出结果: {data_output}\n")

    # 3. 模拟异常测试: 假设 Analyst 被提示词注入或幻觉诱导，试图私自动用资金
    print(f"{Colors.BOLD}{Colors.YELLOW}>>> 任务 2 (防御测试): 模拟 Analyst 试图越权发起 0.20 元支付{Colors.RESET}")
    unauthorized_attempt = analyst.execute_task("尝试为内部研报支付 0.20 元", client)
    print(f"Task 2 拦截响应: {unauthorized_attempt}\n")

    # 4. 模拟任务 3: Analyst 正常纯逻辑汇总
    print(f"{Colors.BOLD}{Colors.CYAN}>>> 任务 3: Analyst 基于 Task 1 的数据生成最终分析报告{Colors.RESET}")
    final_report = analyst.execute_task(f"根据数据生成最终报告: {data_output}", client)
    print(f"\n{Colors.BOLD}{Colors.GREEN}=== Crew 最终交付报告 ==={Colors.RESET}\n{final_report}")

    print(f"\n{Colors.GREEN}✓ 场景四 CrewAI 角色级权限隔离演练成功！{Colors.RESET}\n")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
AgentFinOps Harness Integration Demo - Scenario 2: LangChain Explicit Tools & Polling.

Demonstrates how a LangChain / LangGraph Agent explicitly calls agentpay_pay to purchase
a high-value report, observes PENDING status, and autonomously polls with
agentpay_get_payment until delivery is completed.

Usage:
  python examples/harness-integrations/02-langchain-explicit-polling/main.py
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
    """Simulates AgentPay Gateway backend for explicit payment & async settlement."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.orders: dict[str, dict[str, Any]] = {}

    def pay(self, resource_id: str, amount: str) -> dict[str, Any]:
        intent_id = f"pi_async_{int(time.time() * 1000)}"
        order = {
            "payment_intent_id": intent_id,
            "resource_id": resource_id,
            "amount": amount,
            "currency": "CNY",
            "status": "AUTHORIZED",  # 预算已锁定
            "settlement_status": "PENDING",  # 结算通道处理中
            "fulfillment_status": "PROCESSING",  # 上游数据源正在生成研报
            "next_action": "POLL_STATUS",
            "poll_count": 0,
            "created_at": time.time(),
        }
        self.orders[intent_id] = order
        return {
            "payment_intent_id": intent_id,
            "status": order["status"],
            "settlement_status": order["settlement_status"],
            "fulfillment_status": order["fulfillment_status"],
            "message": f"支付意愿创建成功，配额已原子锁定 ({amount} 元)，上游研报生成中，请轮询对账。",
            "next_action": order["next_action"],
        }

    def get_payment(self, payment_intent_id: str) -> dict[str, Any]:
        if payment_intent_id not in self.orders:
            raise KeyError(f"Payment intent {payment_intent_id} not found")

        order = self.orders[payment_intent_id]
        order["poll_count"] += 1

        # 模拟第 2 次轮询时上游完成交付
        if order["poll_count"] >= 2:
            order["status"] = "COMPLETED"
            order["settlement_status"] = "CONFIRMED"
            order["fulfillment_status"] = "DELIVERED"
            order["next_action"] = "NONE"
            return {
                "payment_intent_id": payment_intent_id,
                "status": "COMPLETED",
                "settlement_status": "CONFIRMED",
                "fulfillment_status": "DELIVERED",
                "report_content": (
                    "【2026年Q4金融市场深度研报】\n"
                    "1. 市场流动性持续宽松，重点企业AI算力预算同比增长32%；\n"
                    "2. 自主智能体API调用量爆发，企业FinOps与行为审计合规成为采购标配。"
                ),
                "next_action": "NONE",
            }
        else:
            return {
                "payment_intent_id": payment_intent_id,
                "status": "AUTHORIZED",
                "settlement_status": "PENDING",
                "fulfillment_status": "PROCESSING",
                "message": "上游大数据引擎正在汇聚对账中，请继续轮询...",
                "next_action": "POLL_STATUS",
            }


class LangChainAgentSimulator:
    """Simulates LangChain OpenAI Tools Agent execution loop with AgentPay tools."""

    def __init__(self, client: MockAgentPayClient):
        self.client = client

    def invoke(self, user_prompt: str) -> str:
        print(f"\n{Colors.BOLD}{Colors.HEADER}=== LangChain Agent 启动推理 ==={Colors.RESET}")
        print(f"用户需求: {Colors.CYAN}{user_prompt}{Colors.RESET}\n")

        # Step 1: Agent 规划
        print(f"{Colors.BLUE}[Thought 1]{Colors.RESET}: 用户需要获取高级金融研报，该资源需要付费 0.50 元。")
        print(f"            我需要先调用 'agentpay_pay' 发起支付意向。")

        # Step 2: 调用 agentpay_pay
        print(f"\n{Colors.YELLOW}[Action 1]{Colors.RESET}: agentpay_pay(")
        print(f"           resource_id='financial_market_depth', amount='0.50')")
        pay_result = self.client.pay(resource_id="financial_market_depth", amount="0.50")
        print(f"{Colors.GREEN}[Observation 1]{Colors.RESET}: {json.dumps(pay_result, ensure_ascii=False)}")

        intent_id = pay_result["payment_intent_id"]

        # Step 3: Agent 分析状态并轮询
        print(f"\n{Colors.BLUE}[Thought 2]{Colors.RESET}: 当前支付状态为 AUTHORIZED，结算状态 PENDING，上游 PROCESSING。")
        print(f"            根据 next_action='POLL_STATUS'，我必须调用 'agentpay_get_payment' 轮询状态，绝不能换 Key 重复下单！")

        # 轮询第 1 次
        time.sleep(0.4)
        print(f"\n{Colors.YELLOW}[Action 2 (Poll #1)]{Colors.RESET}: agentpay_get_payment(payment_intent_id='{intent_id}')")
        poll_1 = self.client.get_payment(intent_id)
        print(f"{Colors.GREEN}[Observation 2]{Colors.RESET}: {json.dumps(poll_1, ensure_ascii=False)}")

        # 轮询第 2 次
        print(f"\n{Colors.BLUE}[Thought 3]{Colors.RESET}: 任务仍在处理中，继续使用指数退避轮询对账...")
        time.sleep(0.4)
        print(f"\n{Colors.YELLOW}[Action 3 (Poll #2)]{Colors.RESET}: agentpay_get_payment(payment_intent_id='{intent_id}')")
        poll_2 = self.client.get_payment(intent_id)
        print(f"{Colors.GREEN}[Observation 3]{Colors.RESET}: {json.dumps(poll_2, ensure_ascii=False)}")

        # Step 4: 交付总结
        print(f"\n{Colors.BLUE}[Thought 4]{Colors.RESET}: 研报已完成交付 (fulfillment_status=DELIVERED)，资金确认结算 (CONFIRMED)。可以为用户生成最终答复。")

        final_answer = (
            f"已为您成功采购并结算《金融市场深度研报》（单号: {intent_id}，扣款: 0.50 元）。\n"
            f"核心结论摘要：\n{poll_2['report_content']}"
        )
        return final_answer


def main() -> None:
    sep = "=" * 80
    print(f"{Colors.BOLD}{Colors.HEADER}{sep}")
    print("  AgentFinOps 场景二：显式意图付费与异步结算轮询（LangChain / LangGraph）")
    print(f"{sep}{Colors.RESET}")
    print("  • 适用：模型自主决策支付、多步异步长任务、需要保证'绝不二次扣款'的场景")
    print("  • 铁律：遇到 PENDING / UNKNOWN 状态，必须使用原单号轮询，严禁发起新支付！\n")

    client = MockAgentPayClient(api_key="apk_live_guest_35f4d15ea0ea3dd5e26e7c6b9bb7c35d")
    agent = LangChainAgentSimulator(client)

    result = agent.invoke("请帮我购买一份 financial_market_depth 报告，单笔报价 0.50 元。")

    print(f"\n{Colors.BOLD}{Colors.GREEN}=== Agent 最终输出结果 ==={Colors.RESET}")
    print(result)
    print(f"\n{Colors.GREEN}✓ 场景二 LangChain 显式意图与对账闭环演练完成！{Colors.RESET}\n")


if __name__ == "__main__":
    main()

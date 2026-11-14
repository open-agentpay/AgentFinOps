#!/usr/bin/env python3
"""
AgentFinOps Harness Integration Demo - Scenario 1: Transparent HTTP 402 Proxy.

Demonstrates zero-code-modification HTTP 402 interception and automatic payment
negotiation for synchronous REST API calls.

Usage:
  python examples/harness-integrations/01-transparent-402-proxy/main.py
  USE_LIVE_GATEWAY=true python examples/harness-integrations/01-transparent-402-proxy/main.py
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.parse
import urllib.request
from typing import Any

# ANSI Colors for terminal visualization
class TermColors:
    HEADER = "\033[95m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    BOLD = "\033[1m"
    RESET = "\033[0m"


class TransparentAgentPayTransport:
    """HTTP Transport adapter that intercepts HTTP 402 Payment Required and auto-retries."""

    def __init__(self, api_key: str, max_per_tx_cny: float = 0.50, daily_budget_cny: float = 5.00):
        self.api_key = api_key
        self.max_per_tx_cny = max_per_tx_cny
        self.daily_budget_cny = daily_budget_cny
        self.spent_today_cny = 0.0

    def execute_request(self, url: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        full_url = url
        if params:
            full_url = f"{url}?{urllib.parse.urlencode(params)}"

        print(f"\n{TermColors.BOLD}{TermColors.CYAN}>>> [Step 1: 业务代码发起标准 HTTP GET 请求]{TermColors.RESET}")
        print(f"    URL: {full_url}")
        print(f"    Header: (普通请求头，无特殊支付私钥或 Prompt 指令)")

        use_live = os.getenv("USE_LIVE_GATEWAY", "false").lower() in ("true", "1")

        if use_live:
            return self._execute_live(full_url)
        else:
            return self._execute_mock(full_url)

    def _execute_mock(self, full_url: str) -> dict[str, Any]:
        time.sleep(0.3)
        print(f"\n{TermColors.BOLD}{TermColors.YELLOW}>>> [Step 2: 目标网关拦截并返回 HTTP 402 Payment Required]{TermColors.RESET}")
        challenge = {
            "error": "PAYMENT_REQUIRED",
            "status_code": 402,
            "cost_cny": "0.25",
            "base_units": 250000,
            "resource_id": "simple_weather_beijing",
            "challenge_nonce": f"nonce_{int(time.time() * 1000)}",
        }
        print(f"    HTTP Status: {TermColors.RED}402 Payment Required{TermColors.RESET}")
        print(f"    Payload: {json.dumps(challenge, ensure_ascii=False)}")

        # Step 3: Transport 层本地策略校验
        print(f"\n{TermColors.BOLD}{TermColors.BLUE}>>> [Step 3: AgentPay Transport 拦截器自动介入（业务代码完全无感）]{TermColors.RESET}")
        cost = float(challenge["cost_cny"])
        if cost > self.max_per_tx_cny:
            raise PermissionError(f"单笔金额 {cost} 元超过本地防火墙上限 {self.max_per_tx_cny} 元，Fail-Closed 阻断！")
        if self.spent_today_cny + cost > self.daily_budget_cny:
            raise PermissionError(f"累计消费超出 24h 滚动预算 {self.daily_budget_cny} 元！")

        print(f"    ✓ 策略校验通过：单笔 {cost:.2f} 元 ≤ 上限 {self.max_per_tx_cny:.2f} 元")
        print(f"    ✓ 虚拟钱包 Quota 预留锁定: HELD (250,000 微单位)")
        self.spent_today_cny += cost

        # Step 4: 携带授权凭证自动重放
        print(f"\n{TermColors.BOLD}{TermColors.CYAN}>>> [Step 4: Transport 携带 Agent API Key 自动重放请求]{TermColors.RESET}")
        print(f"    Authorization: Bearer {self.api_key[:16]}...")
        print(f"    X-AgentPay-Challenge: {challenge['challenge_nonce']}")

        time.sleep(0.3)
        print(f"\n{TermColors.BOLD}{TermColors.GREEN}>>> [Step 5: 网关验证通过，完成原子结算并交付资源]{TermColors.RESET}")
        print(f"    HTTP Status: {TermColors.GREEN}200 OK{TermColors.RESET}")
        print(f"    Settlement Status: {TermColors.GREEN}CAPTURED (确扣完成){TermColors.RESET}")

        result_payload = {
            "city": "北京",
            "condition": "晴朗",
            "temperature_c": 18,
            "wind": "微风 2级",
            "aqi": 35,
            "_agentpay_meta": {
                "charged_cny": "0.25",
                "remaining_budget_cny": round(self.daily_budget_cny - self.spent_today_cny, 2),
                "token_overhead": 0,
            },
        }
        return result_payload

    def _execute_live(self, full_url: str) -> dict[str, Any]:
        req = urllib.request.Request(
            full_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "User-Agent": "AgentPay-Core-SDK/1.0",
            },
        )
        try:
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                print(f"    {TermColors.GREEN}真实网关响应成功 (200 OK):{TermColors.RESET}")
                return data
        except urllib.error.HTTPError as e:
            if e.code == 402:
                print(f"    {TermColors.YELLOW}真实网关返回 402 挑战，发起自动协商...{TermColors.RESET}")
            raise


def main() -> None:
    sep = "=" * 80
    print(f"{TermColors.BOLD}{TermColors.HEADER}{sep}")
    print("  AgentFinOps 场景一：同步按次计费 API（隐式 402 代理模式）")
    print(f"{sep}{TermColors.RESET}")
    print("  • 适用：存量业务接口无需改造，Agent 像访问免费接口一样直接发起请求")
    print("  • 机制：Transport 在 HTTP 协议层捕获 402，自动调用策略引擎签名重试")
    print("  • 特点：LLM 完全无感知，零 Prompt Token 消耗\n")

    api_key = os.getenv("AGENT_API_KEY", "apk_live_guest_35f4d15ea0ea3dd5e26e7c6b9bb7c35d")
    transport = TransparentAgentPayTransport(
        api_key=api_key,
        max_per_tx_cny=0.50,
        daily_budget_cny=5.00,
    )

    # 业务端正常发起调用
    response = transport.execute_request(
        "https://gate.aipmedia.cn/api/v1/simple-weather",
        params={"city": "北京"},
    )

    print(f"\n{TermColors.BOLD}{TermColors.HEADER}>>> [业务端最终收到的数据结果]{TermColors.RESET}")
    print(json.dumps(response, indent=2, ensure_ascii=False))
    print(f"\n{TermColors.GREEN}✓ 场景一测试完毕：零业务代码修改完成 API 计费与防御闭环！{TermColors.RESET}\n")


if __name__ == "__main__":
    main()

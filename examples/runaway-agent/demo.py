"""
AgentFinOps Runaway Agent & Circuit Breaker Demonstration.

Demonstrates the autonomous agent quota lifecycle and the three core pillars of AgentFinOps:
  Phase 1: Normal API quota metering & tenant balance deduction (Audit Log emitted)
  Phase 2: Single-call spending cap violation blocked locally by financial policy engine
  Phase 3: Runaway infinite tool-calling loop caught and neutralized by circuit breaker

Usage:
  python examples/runaway-agent/demo.py
"""

from __future__ import annotations

import datetime
import json
import sqlite3
import tempfile
import time
from typing import Any

from agent_core.policy.config import PolicyConfig
from agent_core.policy.db import init_buyer_database
from agent_core.policy.models import BreakerState
from agent_core.policy.sqlite_engine import SQLitePolicyEngine


# ANSI Terminal Colors
class Colors:
    HEADER = "\033[95m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    BOLD = "\033[1m"
    UNDERLINE = "\033[4m"
    RESET = "\033[0m"


class DemoStructuredLogger:
    """Emits structured JSON logs for auditability and pretty-prints them in the console."""

    def __init__(self) -> None:
        self.logs: list[dict[str, Any]] = []

    def emit(self, component: str, event: str, level: str = "INFO", **kwargs: Any) -> dict[str, Any]:
        record: dict[str, Any] = {
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "level": level,
            "component": component,
            "event": event,
            **kwargs,
        }
        self.logs.append(record)

        color = Colors.GREEN if level == "INFO" else (Colors.YELLOW if level == "WARN" else Colors.RED)
        prefix = f"{Colors.BOLD}{color}[{component}] {event}{Colors.RESET}"
        json_repr = json.dumps(record, indent=2, ensure_ascii=False)
        print(f"{prefix}\n{json_repr}\n")
        return record


class FinOpsTenantAccount:
    """Simulates an enterprise tenant balance account managed by AgentFinOps Gateway."""

    def __init__(self, tenant_id: str, initial_credits: float = 100.0) -> None:
        self.tenant_id = tenant_id
        self.balance_credits = initial_credits

    def deduct(self, amount: float, reason: str) -> dict[str, Any]:
        if self.balance_credits < amount:
            raise ValueError(f"Insufficient quota: balance {self.balance_credits:.2f} < requested {amount:.2f}")
        self.balance_credits -= amount
        return {
            "tenant_id": self.tenant_id,
            "deducted_credits": amount,
            "remaining_credits": round(self.balance_credits, 4),
            "reason": reason,
        }


def print_banner(title: str) -> None:
    sep = "=" * 80
    print(f"\n{Colors.BOLD}{Colors.HEADER}{sep}\n  {title}\n{sep}{Colors.RESET}\n")


def run_demo() -> None:
    logger = DemoStructuredLogger()
    tenant = FinOpsTenantAccount(tenant_id="tenant_enterprise_01", initial_credits=100.0)

    # 1. Initialize local SQLite policy engine backed by agent-core-sdk
    temp_dir = tempfile.mkdtemp()
    db_path = f"{temp_dir}/policy.db"
    conn = sqlite3.connect(db_path)
    init_buyer_database(conn)

    # Base units: 1 Credit = 100 base units (2 decimal places)
    policy_config = PolicyConfig(
        id="policy_enterprise_01",
        name="Enterprise Agent Guardrail Policy",
        wallet_address="tenant_enterprise_01",
        max_per_tx_base_units=10,         # Max 0.10 Credits (10 units) per single tool call
        rolling_budget_24h_base_units=5000, # Max 50.00 Credits total 24h budget
        circuit_max_rpm=5,                # Max 5 RPM before circuit breaker trips
        circuit_cooldown_seconds=60,
    )
    engine = SQLitePolicyEngine(conn, policy_config)

    # =========================================================================
    # Phase 1: 正常微调用配额扣减与计量审计 (Normal Quota Metering & Audit Log)
    # =========================================================================
    print_banner("PHASE 1: 正常微调用配额扣减与计量审计 (Normal Quota Metering & Audit Log)")
    cost_credits_p1 = 0.05
    cost_units_p1 = int(cost_credits_p1 * 100) # 5 units
    intent_id_p1 = f"intent_p1_{int(time.time())}"

    # Step 1a: Reserve quota via local financial firewall
    decision_1 = engine.reserve(
        intent_id=intent_id_p1,
        amount=cost_units_p1,
        payee="tenant_primary",
        asset="CREDITS",
        network="internal:quota",
        domain="gate.aipmedia.cn",
    )

    if decision_1.approved:
        # Step 1b: Commit reservation locally
        engine.commit(intent_id_p1)
        logger.emit(
            "FinOpsFirewall",
            "POLICY_RESERVATION_COMMITTED",
            level="INFO",
            intent_id=intent_id_p1,
            requested_credits=cost_credits_p1,
            max_allowed=f"{policy_config.max_per_tx_base_units / 100:.2f} Credits",
            decision="ALLOWED",
        )

        # Step 1c: Gateway commits quota deduction to enterprise tenant balance
        deduction = tenant.deduct(cost_credits_p1, "AI inference completion")
        logger.emit(
            "FinOpsGateway",
            "QUOTA_DEDUCTION_CONFIRMED",
            level="INFO",
            audit_id=f"audit_{int(time.time())}_001",
            tenant_id=deduction["tenant_id"],
            deducted_credits=deduction["deducted_credits"],
            remaining_balance=f"{deduction['remaining_credits']:.2f} Credits",
            status="CONFIRMED",
        )
    else:
        print(f"Phase 1 unexpectedly blocked: {decision_1.error_code}")

    # =========================================================================
    # Phase 2: 单次超额本地主动防御 (Single-Call Budget Cap Defense)
    # =========================================================================
    print_banner("PHASE 2: 单次超额本地主动防御 (Single-Call Budget Cap Defense)")
    cost_credits_p2 = 2.50 # 250 units, exceeds single call limit 10 units (0.10 Credits)
    cost_units_p2 = int(cost_credits_p2 * 100)
    intent_id_p2 = f"intent_p2_{int(time.time())}"

    decision_2 = engine.reserve(
        intent_id=intent_id_p2,
        amount=cost_units_p2,
        payee="tenant_primary",
        asset="CREDITS",
        network="internal:quota",
        domain="gate.aipmedia.cn",
    )

    if not decision_2.approved:
        logger.emit(
            "FinOpsFirewall",
            "BUDGET_CAP_VIOLATION_BLOCKED",
            level="WARN",
            requested_credits=f"{cost_credits_p2:.2f} Credits",
            single_call_limit=f"{policy_config.max_per_tx_base_units / 100:.2f} Credits",
            decision="BLOCKED_LOCALLY",
            error_code=decision_2.error_code.value if decision_2.error_code else "BUDGET_CAP_EXCEEDED",
            action="CALL_ABORTED_ZERO_QUOTA_LOST",
        )
        print(f"{Colors.YELLOW}Local financial firewall blocked call: 0 credits lost.{Colors.RESET}\n")

    # =========================================================================
    # Phase 3: 失控死循环与熔断器介入 (Runaway Infinite Loop Tripped Circuit Breaker)
    # =========================================================================
    print_banner("PHASE 3: 失控死循环与熔断器介入 (Runaway Infinite Loop Tripped Circuit Breaker)")
    loop_call_credits = 0.02
    loop_call_units = int(loop_call_credits * 100) # 2 units

    print(f"Simulating runaway tool-calling loop (Max allowed: {policy_config.circuit_max_rpm} RPM)...")

    for i in range(1, 9):
        print(f"--- Iteration {i} ---")
        intent_id_loop = f"intent_loop_{int(time.time())}_{i}"
        decision = engine.reserve(
            intent_id=intent_id_loop,
            amount=loop_call_units,
            payee="tenant_primary",
            asset="CREDITS",
            network="internal:quota",
            domain="gate.aipmedia.cn",
        )

        if decision.approved:
            engine.commit(intent_id_loop)
            tenant.deduct(loop_call_credits, f"Tool loop call {i}")
            logger.emit(
                "AgentLoop",
                "CALL_EXECUTED",
                level="INFO",
                iteration=i,
                cost=f"{loop_call_credits:.2f} Credits",
                breaker_state=engine.get_breaker_state().value,
            )
        else:
            logger.emit(
                "FinOpsFirewall",
                "CIRCUIT_BREAKER_TRIPPED",
                level="ERROR",
                iteration=i,
                breaker_state=engine.get_breaker_state().value,
                error_code=decision.error_code.value if decision.error_code else "CIRCUIT_BREAKER_OPEN",
                cooldown_seconds=policy_config.circuit_cooldown_seconds,
                action="LOOP_HALTED_TENANT_PROTECTED",
                funds_drained_this_call="0.00 Credits",
            )
            print(f"{Colors.RED}{Colors.BOLD}Runaway agent loop successfully halted by Circuit Breaker!{Colors.RESET}")
            break

    print_banner("DEMO COMPLETED SUCCESSFULLY: Enterprise FinOps Governance Verified!")


if __name__ == "__main__":
    run_demo()

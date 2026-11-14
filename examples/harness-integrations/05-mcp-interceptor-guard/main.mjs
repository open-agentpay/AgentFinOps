#!/usr/bin/env node
/**
 * AgentFinOps Harness Integration Demo - Scenario 5: MCP Interceptor & Tool Quota Guard.
 * 
 * Demonstrates the full lifecycle for billable Model Context Protocol tools:
 *   1. Normal call: evaluate -> reserve (Hold) -> execute -> commit (Capture)
 *   2. Tool failure: evaluate -> reserve (Hold) -> execute throws -> release (No funds lost!)
 *   3. Budget exceeded: evaluate -> DENY (Fail-closed)
 * 
 * Usage:
 *   node examples/harness-integrations/05-mcp-interceptor-guard/main.mjs
 */

const colors = {
  header: '\x1b[95m',
  cyan: '\x1b[96m',
  green: '\x1b[92m',
  yellow: '\x1b[93m',
  red: '\x1b[91m',
  blue: '\x1b[94m',
  bold: '\x1b[1m',
  reset: '\x1b[0m'
};

// 1. MCP Server 端：注入价格元数据的工具包装函数
function withPrice(toolDefinition, pricingMeta) {
  return {
    ...toolDefinition,
    _agentpay_meta: {
      pricePerCall: pricingMeta.pricePerCall,
      asset: pricingMeta.asset || 'CNY',
      chargingMode: pricingMeta.chargingMode || 'per_call',
      resourceId: pricingMeta.resourceId,
    }
  };
}

// 2. MCP Client 端：轻量级内存配额守卫
class InMemoryToolQuotaGuard {
  constructor({ maxPerCall = 0.50, dailyBudget = 5.00 }) {
    this.maxPerCall = maxPerCall;
    this.dailyBudget = dailyBudget;
    this.spentToday = 0.0;
    this.reservations = new Map();
  }

  evaluateAndReserve({ toolName, pricingMeta }) {
    const cost = parseFloat(pricingMeta.pricePerCall);
    if (cost > this.maxPerCall) {
      return {
        allowed: false,
        reason: `SINGLE_TX_CAP_EXCEEDED: 单笔费用 ${cost} 元超过客户端预算上限 ${this.maxPerCall} 元`
      };
    }
    if (this.spentToday + cost > this.dailyBudget) {
      return {
        allowed: false,
        reason: `DAILY_BUDGET_EXCEEDED: 累计消费将达 ${(this.spentToday + cost).toFixed(2)} 元，超出每日预算 ${this.dailyBudget} 元`
      };
    }

    const reservationId = `res_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    this.reservations.set(reservationId, { cost, toolName, status: 'HELD' });
    return {
      allowed: true,
      reservationId,
      cost
    };
  }

  commit(reservationId) {
    const res = this.reservations.get(reservationId);
    if (!res) throw new Error(`Reservation ${reservationId} not found`);
    res.status = 'CONFIRMED';
    this.spentToday += res.cost;
    return {
      status: 'CONFIRMED',
      debited: res.cost,
      spentToday: this.spentToday.toFixed(2),
      remainingToday: (this.dailyBudget - this.spentToday).toFixed(2)
    };
  }

  release(reservationId, error) {
    const res = this.reservations.get(reservationId);
    if (!res) return;
    res.status = 'RELEASED';
    this.reservations.delete(reservationId);
    return {
      status: 'RELEASED',
      refunded: res.cost,
      remainingToday: (this.dailyBudget - this.spentToday).toFixed(2),
      error: error.message
    };
  }
}

// 3. MCP 前置拦截器
function createMcpClientPreCallInterceptor({ guard }) {
  return {
    async beforeCall({ toolName, pricingMeta }) {
      return guard.evaluateAndReserve({ toolName, pricingMeta });
    },
    async afterCallSuccess({ reservationId }) {
      return guard.commit(reservationId);
    },
    async afterCallFailure({ reservationId, error }) {
      return guard.release(reservationId, error);
    }
  };
}

async function main() {
  console.log(`${colors.bold}${colors.header}${'='.repeat(75)}`);
  console.log('  AgentFinOps 场景五：MCP (Model Context Protocol) 协议级拦截与计费');
  console.log(`${'='.repeat(75)}${colors.reset}\n`);

  // Server 端声明工具并标价
  const enterpriseSearchTool = withPrice(
    {
      name: 'enterprise_search',
      description: '查询权威企业工商信息'
    },
    {
      pricePerCall: '0.10',
      asset: 'CNY',
      chargingMode: 'per_call',
      resourceId: 'enterprise_credit_search'
    }
  );

  const expensiveGraphTool = withPrice(
    {
      name: 'full_equity_graph',
      description: '全量股权穿透图谱'
    },
    {
      pricePerCall: '2.50', // 超出单笔 0.50 元上限
      asset: 'CNY',
      chargingMode: 'per_call',
      resourceId: 'full_equity_graph_pro'
    }
  );

  // Client 端配置守卫与拦截器
  const guard = new InMemoryToolQuotaGuard({ maxPerCall: 0.50, dailyBudget: 5.00 });
  const interceptor = createMcpClientPreCallInterceptor({ guard });

  // ---------------------------------------------------------------------------
  // 测试 1: 正常调用与原子扣费闭环
  // ---------------------------------------------------------------------------
  console.log(`${colors.bold}${colors.cyan}--- 测试 1: 正常付费 MCP 工具调用 (单笔 0.10 元) ---${colors.reset}`);
  const check1 = await interceptor.beforeCall({
    toolName: enterpriseSearchTool.name,
    pricingMeta: enterpriseSearchTool._agentpay_meta
  });

  if (check1.allowed) {
    console.log(`✓ 策略放行: 预留凭据 reservationId=${check1.reservationId} (配额已锁定 HELD)`);
    // 模拟执行 RPC 工具调用
    console.log(`  执行底层 MCP tools/call -> 返回工商数据...`);
    const receipt1 = await interceptor.afterCallSuccess({ reservationId: check1.reservationId });
    console.log(`${colors.green}✓ 调用成功并原子确扣:${colors.reset}`, receipt1);
  }

  // ---------------------------------------------------------------------------
  // 测试 2: 工具调用发生异常，拦截器自动冲正释放配额 (防吞钱)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}${colors.yellow}--- 测试 2: 上游服务崩溃或超时，自动冲正退回资金 ---${colors.reset}`);
  const check2 = await interceptor.beforeCall({
    toolName: enterpriseSearchTool.name,
    pricingMeta: enterpriseSearchTool._agentpay_meta
  });

  if (check2.allowed) {
    console.log(`✓ 策略预留成功: reservationId=${check2.reservationId}`);
    try {
      console.log(`  发起上游调用... ${colors.red}[模拟上游接口 504 Gateway Timeout 超时崩溃]${colors.reset}`);
      throw new Error('Upstream database connection timeout');
    } catch (err) {
      const rollback = await interceptor.afterCallFailure({ reservationId: check2.reservationId, error: err });
      console.log(`${colors.yellow}✓ 自动冲正触发: 配额已被安全释放 (RELEASED)，企业资金零损失!${colors.reset}`, rollback);
    }
  }

  // ---------------------------------------------------------------------------
  // 测试 3: 触发超预算硬阻断 (单笔 2.50 元 > 0.50 元)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}${colors.red}--- 测试 3: 单笔超限高价工具调用阻断 (2.50 元 > 0.50 元) ---${colors.reset}`);
  const check3 = await interceptor.beforeCall({
    toolName: expensiveGraphTool.name,
    pricingMeta: expensiveGraphTool._agentpay_meta
  });

  if (!check3.allowed) {
    console.log(`${colors.red}${colors.bold}✗ MCP 工具调用被拦截:${colors.reset}`, check3.reason);
    console.log(`✓ Fail-Closed 机制生效：RPC 调用未发出，0 算力浪费！`);
  }

  console.log(`\n${colors.green}✓ 场景五 MCP 协议级标价、拦截与防悬挂生命周期演示全部通过！${colors.reset}\n`);
}

main().catch(console.error);

#!/usr/bin/env node
/**
 * AgentFinOps Harness Integration Demo - Scenario 1: Transparent HTTP 402 Proxy (Node.js).
 * 
 * Usage:
 *   node examples/harness-integrations/01-transparent-402-proxy/main.mjs
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

class TransparentAgentPayClient {
  constructor({ apiKey, maxPerTxCny = 0.50, dailyBudgetCny = 5.00 }) {
    this.apiKey = apiKey;
    this.maxPerTxCny = maxPerTxCny;
    this.dailyBudgetCny = dailyBudgetCny;
    this.spentTodayCny = 0.0;
  }

  async fetch(url, params = {}) {
    const query = new URLSearchParams(params).toString();
    const fullUrl = query ? `${url}?${query}` : url;

    console.log(`\n${colors.bold}${colors.cyan}>>> [Step 1: 业务代码发起标准 fetch 请求]${colors.reset}`);
    console.log(`    URL: ${fullUrl}`);
    console.log(`    模式: 隐式透明代理 (零业务代码侵入)`);

    // 模拟 402 握手与策略校验
    console.log(`\n${colors.bold}${colors.yellow}>>> [Step 2: 目标网关拦截并返回 HTTP 402 Payment Required]${colors.reset}`);
    console.log(`    HTTP Status: ${colors.red}402 Payment Required${colors.reset}`);
    console.log(`    Challenge: 需要扣除 0.25 元 (250,000 微单位)`);

    console.log(`\n${colors.bold}${colors.blue}>>> [Step 3: SDK Transport 层自动捕获挑战并校验本地策略]${colors.reset}`);
    const cost = 0.25;
    if (cost > this.maxPerTxCny) {
      throw new Error(`单笔金额超出上限: ${cost} > ${this.maxPerTxCny}`);
    }
    this.spentTodayCny += cost;
    console.log(`    ✓ 策略放行：单笔 ${cost} 元 ≤ 上限 ${this.maxPerTxCny} 元`);
    console.log(`    ✓ 虚拟钱包 Quota 原子预留 (HELD)`);

    console.log(`\n${colors.bold}${colors.cyan}>>> [Step 4: Transport 携带 API Key 自动重放请求]${colors.reset}`);
    console.log(`    Authorization: Bearer ${this.apiKey.substring(0, 16)}...`);

    console.log(`\n${colors.bold}${colors.green}>>> [Step 5: 网关确认结算并交付天气数据 (200 OK)]${colors.reset}`);
    return {
      status: 200,
      json: async () => ({
        city: '北京',
        weather: '晴朗',
        temperature_c: 18,
        humidity: '35%',
        _agentpay_meta: {
          charged_cny: '0.25',
          settlement_status: 'CONFIRMED',
          token_overhead: 0
        }
      })
    };
  }
}

async function main() {
  console.log(`${colors.bold}${colors.header}${'='.repeat(75)}`);
  console.log('  AgentFinOps 场景一 (Node.js/TS)：同步按次计费 API（隐式 402 代理模式）');
  console.log(`${'='.repeat(75)}${colors.reset}\n`);

  const client = new TransparentAgentPayClient({
    apiKey: process.env.AGENT_API_KEY || 'apk_live_guest_35f4d15ea0ea3dd5e26e7c6b9bb7c35d',
    maxPerTxCny: 0.50,
    dailyBudgetCny: 5.00
  });

  const response = await client.fetch('https://gate.aipmedia.cn/api/v1/simple-weather', { city: '北京' });
  const data = await response.json();

  console.log(`\n${colors.bold}${colors.header}>>> [业务端无感收到的数据响应]${colors.reset}`);
  console.log(JSON.stringify(data, null, 2));
  console.log(`\n${colors.green}✓ Node.js 场景一透明代理演示成功！${colors.reset}\n`);
}

main().catch(console.error);

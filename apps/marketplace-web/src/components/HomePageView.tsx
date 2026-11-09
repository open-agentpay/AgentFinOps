'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Cpu,
  Database,
  Layers,
  Lock,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react';
import {
  PUBLIC_DOCS_URL,
  PUBLIC_GATEWAY_URL,
  PUBLIC_PLAYGROUND_URL,
} from '@/lib/marketplace';
import { useI18n } from '@/i18n/context';
import { CopyButton } from '@/components/CopyButton';

export function HomePageView() {
  const { t } = useI18n();
  const [buyerSdkLang, setBuyerSdkLang] = useState<'python' | 'typescript'>('python');

  const buyerPythonSnippet = useMemo(() => {
    return `import os
# 从顶层 agentpay_core 直接导入 AgentPayClient
from agentpay_core import AgentPayClient, PolicyConfig, SQLitePolicyEngine

# 1. 策略防火墙：仅配置预算和白名单域名
policy = SQLitePolicyEngine.create_in_memory(
    PolicyConfig(
        id="weather_agent",
        max_per_tx_base_units=250000,  # 0.25 Credits
        rolling_budget_24h_base_units=5000000,  # 5.00 Credits
        whitelist_domains={"gate.aipmedia.cn"},
    )
)

# 2. 客户端直接传入 api_key，自动开启虚拟组织账户模式与 402 自动握手
client = AgentPayClient(
    api_key=os.getenv("AGENT_API_KEY", "apk_live_xxx"),
    policy=policy,
)

# 3. 正常发起调用
response = client.get(
    "https://gate.aipmedia.cn/api/v1/simple-weather",
    params={"city": "北京"}
)
print("Response:", response.json())`;
  }, []);

  const buyerTsSnippet = useMemo(() => {
    return `import { AgentPayClient, PolicyConfig, SQLitePolicyEngine } from 'agentpay-core-sdk';

// 1. 策略防火墙配置
const policy = SQLitePolicyEngine.createInMemory(
  new PolicyConfig({
    id: 'weather_agent',
    maxPerTxBaseUnits: 250000n,
    rollingBudget24hBaseUnits: 5000000n,
    whitelistDomains: ['gate.aipmedia.cn'],
  })
);

// 2. 客户端直接传入 apiKey
const client = new AgentPayClient({
  apiKey: process.env.AGENT_API_KEY ?? 'apk_live_xxx',
  policy,
});

// 3. 正常发起调用
const response = await client.get('https://gate.aipmedia.cn/api/v1/simple-weather', {
  params: { timeframe: '24h' },
});
console.log('Response:', await response.json());`;
  }, []);

  const buyerCodeSnippet = buyerSdkLang === 'python' ? buyerPythonSnippet : buyerTsSnippet;
  const buyerInstallCmd =
    buyerSdkLang === 'python' ? 'pip install agentpay-core-sdk' : 'npm install agentpay-core-sdk';

  const sellerYamlSnippet = useMemo(() => {
    return `version: "1.0"
server:
  host: "0.0.0.0"
  port: 8000

routes:
  # 企业级 AI Agent 自动化配额核销与计费路由
  - path: "/v1/ai/deepseek-research"
    upstream: "https://internal-api.service/v1/research"
    methods: ["POST"]
    allowed_payment_methods: "wallet"
    asset: "CNY"
    price_base_units: 350000          # 企业组织账户定价：¥0.35 CNY / 次 (6位微单位)
    cluster: "domestic-v1"`;
  }, []);

  const terminalSimulationOutput = `================================================================================
    AgentFinOps Financial Firewall & Runaway Circuit Breaker Demo
================================================================================
Payment Rail: Virtual Wallet (CNY/USD) & 企业算力点数 (Credits)
Firewall Limits: Max $0.10/tx | Daily Budget $1.00 | Max 5 RPM

>>> [PHASE 1] Authorized Micro-Payment (Hold -> 200 OK -> Capture) <<<
Agent requests market data for '600519' ($0.05).
[Gateway] PAYMENT_CONFIRMED: Status: COMPLETED (Sub-millisecond verification)

>>> [PHASE 2] Single-Transaction Cap Exceeded: Local Defense <<<
Agent attempts heavy compute ($2.50, limit is $0.10).
[BuyerFirewall] POLICY_VIOLATION_INTERCEPTED (Requested $2.50 > Max $0.10)
✓ Payment aborted safely: 0.00 funds deducted, upstream call blocked

>>> [PHASE 3] Runaway Agent Infinite Loop Neutralized by Circuit Breaker <<<
Agent enters uncontrolled loop: Calls #1..#4 succeeded ($0.01/req).
[BuyerFirewall] CIRCUIT_BREAKER_TRIPPED: Reason: CIRCUIT_MAX_RPM_EXCEEDED
✗ Loop iterations #5..#8 BLOCKED: [CIRCUIT_BREAKER_OPEN - WALLET FROZEN]

Calls Attempted: 10 | Paid Calls: 5 | Blocked: 5 | Funds Saved: $2.54 (96.6%)`;

  return (
    <div className="space-y-16 py-4">
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/80 dark:border-slate-800/90 dark:bg-gradient-to-b dark:from-slate-900/90 dark:via-[#0B1120] dark:to-[#070B14] p-8 shadow-xl sm:p-14 transition-colors duration-200">
        <div className="pointer-events-none absolute -top-28 left-1/2 h-80 w-[720px] -translate-x-1/2 rounded-full bg-indigo-500/10 dark:bg-indigo-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 right-10 h-72 w-96 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-50 px-4 py-1.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
            <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>{t.homePage.heroBadge}</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl sm:leading-[1.15]">
            {t.homePage.heroTitle}
          </h1>

          <p className="mx-auto mt-5 max-w-3xl text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
            {t.homePage.heroSubtitle}
          </p>

          {/* Golden Rule Banner */}
          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-50/90 via-cyan-50/50 to-slate-50 p-5 text-left shadow-sm dark:from-indigo-950/40 dark:via-slate-900/90 dark:to-slate-950">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
              <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>{t.homePage.goldenRuleLabel}</span>
            </div>
            <p className="mt-2 font-mono text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              &ldquo;{t.homePage.goldenRule}&rdquo;
            </p>
          </div>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a
              href={`${PUBLIC_PLAYGROUND_URL}?utm_source=marketplace_hero`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition-all hover:from-indigo-500 hover:to-purple-500 hover:scale-[1.02]"
            >
              <Sparkles className="h-4 w-4 text-yellow-300 animate-pulse" />
              <span>{t.homePage.btnPlayground}</span>
              <ArrowRight className="h-4 w-4" />
            </a>

            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white"
            >
              <span>{t.homePage.btnGoMarketplace}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <a
              href={PUBLIC_DOCS_URL}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white"
            >
              <Terminal className="h-4 w-4 text-indigo-500" />
              <span>{t.homePage.btnReadDocs}</span>
            </a>
          </div>

          {/* SDK Install Pills (Python & TypeScript) */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 font-mono text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-300">
              <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                Python
              </span>
              <span>pip install agentpay-core-sdk</span>
              <CopyButton text="pip install agentpay-core-sdk" />
            </div>

            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 font-mono text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-300">
              <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-700 dark:text-cyan-400">
                TypeScript
              </span>
              <span>npm install agentpay-core-sdk</span>
              <CopyButton text="npm install agentpay-core-sdk" />
            </div>
          </div>
        </div>
      </section>

      {/* 2. Key Metrics Strip */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/60">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Zap className="h-4 w-4 text-emerald-500" />
            <span>支持 x402 协议 (CNY / Credits)</span>
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-slate-900 dark:text-white">
            ¥0.000001
          </div>
          <div className="mt-1 text-xs text-slate-500">
            支持 6 位微单位 CNY/USD 虚拟账本与 x402 协议结算
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/60">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Lock className="h-4 w-4 text-indigo-500" />
            <span>零信任安全边界</span>
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-slate-900 dark:text-white">
            100% 本地拦截
          </div>
          <div className="mt-1 text-xs text-slate-500">
            受限 API Key 租户隔离与本地凭据不出域保护
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/60">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Cpu className="h-4 w-4 text-cyan-500" />
            <span>Go 网关核验与冻结</span>
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-slate-900 dark:text-white">
            &lt; 5 ms
          </div>
          <div className="mt-1 text-xs text-slate-500">
            毫秒级虚拟钱包 Hold 冻结与挑战核验
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/60">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            <span>Circuit Breaker</span>
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-slate-900 dark:text-white">
            0 逃逸
          </div>
          <div className="mt-1 text-xs text-slate-500">
            检测到高频死循环自动切断资金
          </div>
        </div>
      </section>

      {/* 3. What is AgentFinOps & Who is it for */}
      <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800/90 dark:bg-slate-900/60 sm:p-10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-50 px-3.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
            <Layers className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>{t.homePage.whatIsBadge}</span>
          </div>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {t.homePage.whatIsTitle}
          </h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300 sm:text-base">
            <p>{t.homePage.whatIsP1}</p>
            <p className="font-medium text-slate-800 dark:text-slate-200">{t.homePage.whatIsP2}</p>
          </div>
        </div>

        {/* 3 User Personas */}
        <div className="grid grid-cols-1 gap-5 pt-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/70">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
              <Cpu className="h-5 w-5" />
            </div>
            <h4 className="mt-3 font-bold text-slate-900 dark:text-white">
              智能体开发者 (Buyer)
            </h4>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              即插即用的 Python 与 TypeScript SDK，支持虚拟钱包 API Key 与 x402 协议模式，自动完成 402 握手与预算熔断保护。
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/70">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <Server className="h-5 w-5" />
            </div>
            <h4 className="mt-3 font-bold text-slate-900 dark:text-white">
              API / 算力提供商 (Seller)
            </h4>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              反向代理网关（Go 核心），只需一份配置即可将已有 HTTP 接口转变为支持 CNY/USD 钱包或 x402 协议结算的按次付费 API。
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/70">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400">
              <Database className="h-5 w-5" />
            </div>
            <h4 className="mt-3 font-bold text-slate-900 dark:text-white">
              企业与平台运营者 (Enterprise)
            </h4>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              严格的多租户隔离、RBAC 角色权限、项目预算硬顶、CNY/USD 只追加虚拟账本以及秒级紧急熔断开关。
            </p>
          </div>
        </div>
      </section>

      {/* 4. The 7 Critical Risks Table / Matrix */}
      <section className="space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-50 px-3.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
            <ShieldAlert className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
            <span>{t.homePage.risksBadge}</span>
          </div>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {t.homePage.risksTitle}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t.homePage.risksSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {t.homePage.risksList.map((item, idx) => (
            <div
              key={idx}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-400 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-indigo-500/40"
            >
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white">{item.title}</h4>
                <div className="mt-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
                  <span className="font-semibold">生产风险：</span>
                  {item.problem}
                </div>
              </div>
              <div className="mt-3 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                <span className="font-semibold">防御机制：</span>
                {item.solution}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Deterministic Payment Architecture */}
      <section className="space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-50 px-3.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
            <Zap className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>{t.homePage.dualRailBadge}</span>
          </div>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {t.homePage.dualRailTitle}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t.homePage.dualRailSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Rail A: Virtual Wallet */}
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t.homePage.railATitle}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t.homePage.railASubtitle}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {t.homePage.railADesc}
            </p>
            <div className="mt-5 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs dark:border-slate-800 dark:bg-slate-950/70">
              {t.homePage.railASteps.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <span className="text-indigo-500">▶</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rail B: x402 Protocol */}
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t.homePage.railBTitle}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t.homePage.railBSubtitle}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {t.homePage.railBDesc}
            </p>
            <div className="mt-5 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs dark:border-slate-800 dark:bg-slate-950/70">
              {t.homePage.railBSteps.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <span className="text-emerald-500">▶</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 6. Built-in Terminal Demo Section */}
      <section className="rounded-3xl border border-slate-200 bg-slate-950 p-7 text-white shadow-xl dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <Terminal className="h-4 w-4" />
              <span>{t.homePage.terminalDemoTitle}</span>
            </div>
            <h3 className="mt-1 text-base font-bold text-white">
              {t.homePage.terminalDemoSubtitle}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-400">make demo</span>
            <CopyButton text="make demo" label="复制命令" />
          </div>
        </div>

        <pre className="mt-4 overflow-x-auto rounded-xl bg-[#050811] p-4 font-mono text-xs leading-relaxed text-slate-300">
          <code>{terminalSimulationOutput}</code>
        </pre>
      </section>

      {/* 7. Quickstart Section (Buyer & Seller) */}
      <section className="space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-50 px-3.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
            <Terminal className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>{t.homePage.quickstartTitle}</span>
          </div>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {t.homePage.quickstartSubtitle}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Buyer SDK Integration */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {t.homePage.buyerQuickstartTitle}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {/* Language Switcher: Python vs TypeScript */}
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs dark:border-slate-800 dark:bg-slate-950">
                  <button
                    type="button"
                    onClick={() => setBuyerSdkLang('python')}
                    className={`rounded-md px-2.5 py-1 font-mono font-medium transition ${
                      buyerSdkLang === 'python'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    Python
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuyerSdkLang('typescript')}
                    className={`rounded-md px-2.5 py-1 font-mono font-medium transition ${
                      buyerSdkLang === 'typescript'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    TypeScript
                  </button>
                </div>
                <CopyButton text={buyerCodeSnippet} />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
              <span>$ {buyerInstallCmd}</span>
              <CopyButton text={buyerInstallCmd} />
            </div>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200">
              <code>{buyerCodeSnippet}</code>
            </pre>
          </div>

          {/* Seller Reverse Proxy */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {t.homePage.sellerQuickstartTitle}
              </span>
              <CopyButton text={sellerYamlSnippet} />
            </div>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200">
              <code>{sellerYamlSnippet}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* 8. Marketplace & SDK Verification CTA */}
      <section className="relative overflow-hidden rounded-3xl border border-indigo-300/80 bg-gradient-to-r from-indigo-50/80 via-cyan-50/60 to-white p-8 shadow-md dark:border-indigo-500/30 dark:bg-gradient-to-r dark:from-indigo-950/60 dark:via-slate-900 dark:to-slate-900 sm:p-12 transition-colors duration-200">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="max-w-2xl">
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
              {t.homePage.marketplaceCtaBadge}
            </span>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {t.homePage.marketplaceCtaTitle}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {t.homePage.marketplaceCtaDesc}
            </p>
          </div>

          <div className="shrink-0">
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-500"
            >
              <span>{t.homePage.marketplaceCtaBtn}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

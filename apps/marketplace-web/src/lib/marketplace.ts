import { SEED_MARKETPLACE_ROUTES } from '@/lib/seed-data';
import type { MarketplaceFilter, MarketplaceRouteItem } from '@/types/marketplace';

const INTERNAL_GATEWAY_URL =
  process.env.GATEWAY_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_GATEWAY_API_URL ||
  'http://127.0.0.1:8080';

export const PUBLIC_GATEWAY_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL || 'https://gate.aipmedia.cn';

export const PUBLIC_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://aipmedia.cn';

export const PUBLIC_CONSOLE_URL =
  process.env.NEXT_PUBLIC_CONSOLE_URL || 'https://console.aipmedia.cn';

export const PUBLIC_PLAYGROUND_URL =
  process.env.NEXT_PUBLIC_PLAYGROUND_URL || `${PUBLIC_CONSOLE_URL}/playground`;

export const PUBLIC_DOCS_URL =
  process.env.NEXT_PUBLIC_DOCS_URL || '/docs/';

export const PUBLIC_GITHUB_URL =
  process.env.NEXT_PUBLIC_GITHUB_URL || 'https://github.com/agentfinops/AgentFinOps';

/**
 * Formats CNY/Credits price into a clean human-readable string with 2 decimal places (分, e.g. "0.05" or "10.00").
 */
export function formatCreditsPrice(baseUnits: number): string {
  const val = baseUnits / 1_000_000;
  return val.toFixed(2);
}

/**
 * Maps cluster identifiers to human-readable cluster labels.
 */
export function formatClusterLabel(cluster?: string, fallback?: string): string {
  if (fallback) return fallback;
  return cluster || '企业内部高可用集群 (domestic-v1)';
}

/**
 * Generates the standardized Answer-First TL;DR summary for GEO optimization.
 */
export function buildAnswerFirstTldr(
  route: MarketplaceRouteItem,
  _locale: string = 'zh'
): string {
  const priceStr = formatCreditsPrice(route.price_base_units);
  const clusterLabel = formatClusterLabel(route.cluster);
  const defaultSummaryZh = `${route.title} 提供面向 AI Agent 的标准化接口服务。`;

  const baseSummary =
    route.summary ||
    route.description_md.split('\n').find((line) => line.trim() && !line.trim().startsWith('#')) ||
    defaultSummaryZh;

  return `${baseSummary} 支持企业级配额核销与计费（${clusterLabel}），单次调用价格为 ${priceStr} Credits/req，支持通过 AgentFinOps SDK 免繁琐开户流程，配合策略引擎实现调用即结算。`;
}

/**
 * Generates the simplified Python SDK code snippet with built-in brand attribution.
 */
export function buildPythonSdkSnippet(
  route: MarketplaceRouteItem,
  _locale: string = 'zh'
): string {
  const suggestedBudgetUnits = Math.max(
    250_000,
    (route.price_base_units || 50_000) * 5
  );
  const sampleParams =
    route.sample_params && Object.keys(route.sample_params).length > 0
      ? route.sample_params
      : (route.parameters && typeof route.parameters === 'object' && !Array.isArray(route.parameters) && Object.keys(route.parameters).length > 0)
      ? (route.parameters as Record<string, unknown>)
      : { city: '北京' };

  const paramsJson = JSON.stringify(sampleParams, null, 4);

  const primaryMethod = (route.methods?.[0] || 'GET').toUpperCase();
  const isPost =
    primaryMethod === 'POST' ||
    (!route.methods?.includes('GET') && route.methods?.includes('POST'));
  const httpMethod = isPost ? 'post' : 'get';
  const paramArg = isPost ? 'json' : 'params';
  const endpointUrl = `${PUBLIC_GATEWAY_URL}${route.path_pattern}`;

  const suggestedDailyUnits = Math.max(5_000_000, suggestedBudgetUnits * 20);
  const policyId = (route.slug || 'weather_agent').replace(/-/g, '_').slice(0, 32);

  return `import os
# 从顶层 agentpay_core 直接导入 AgentPayClient
from agentpay_core import AgentPayClient, PolicyConfig, SQLitePolicyEngine

# 1. 策略防火墙：仅配置预算和白名单域名
policy = SQLitePolicyEngine.create_in_memory(
    PolicyConfig(
        id="${policyId}",
        max_per_tx_base_units=${suggestedBudgetUnits},  # ${(suggestedBudgetUnits / 1_000_000).toFixed(2)} Credits
        rolling_budget_24h_base_units=${suggestedDailyUnits},  # ${(suggestedDailyUnits / 1_000_000).toFixed(2)} Credits
        whitelist_domains={"gate.aipmedia.cn"},
    )
)

# 2. 客户端直接传入 api_key，自动开启虚拟钱包模式与 402 自动握手
client = AgentPayClient(
    api_key=os.getenv("AGENT_API_KEY", "apk_live_xxx"),
    policy=policy,
)

# 3. 正常发起调用
response = client.${httpMethod}(
    "${endpointUrl}",
    ${paramArg}=${paramsJson}
)
print("Response:", response.json())`;
}

/**
 * Generates the simplified TypeScript SDK code snippet with built-in brand attribution.
 */
export function buildTypescriptSdkSnippet(
  route: MarketplaceRouteItem,
  _locale: string = 'zh'
): string {
  const suggestedBudgetUnits = Math.max(
    250_000,
    (route.price_base_units || 50_000) * 5
  );
  const sampleParams =
    route.sample_params && Object.keys(route.sample_params).length > 0
      ? route.sample_params
      : (route.parameters && typeof route.parameters === 'object' && !Array.isArray(route.parameters) && Object.keys(route.parameters).length > 0)
      ? (route.parameters as Record<string, unknown>)
      : { timeframe: '24h' };

  const paramsJson = JSON.stringify(sampleParams, null, 2);
  const indentedParamsJson = paramsJson
    .split('\n')
    .map((line, i) => (i === 0 ? line : `  ${line}`))
    .join('\n');

  const primaryMethod = (route.methods?.[0] || 'GET').toUpperCase();
  const isPost =
    primaryMethod === 'POST' ||
    (!route.methods?.includes('GET') && route.methods?.includes('POST'));
  const endpointUrl = `${PUBLIC_GATEWAY_URL}${route.path_pattern}`;

  const suggestedDailyUnits = Math.max(5_000_000, suggestedBudgetUnits * 20);
  const policyId = (route.slug || 'weather_agent').replace(/-/g, '_').slice(0, 32);

  const requestCall = isPost
    ? `const response = await client.post(\n  '${endpointUrl}',\n  ${indentedParamsJson}\n);`
    : `const response = await client.get('${endpointUrl}', {\n  params: ${indentedParamsJson.replace(/\n/g, '\n  ')},\n});`;

  return `import { AgentPayClient, PolicyConfig, SQLitePolicyEngine } from 'agentpay-core-sdk';

// 1. 策略防火墙配置
const policy = SQLitePolicyEngine.createInMemory(
  new PolicyConfig({
    id: '${policyId}',
    maxPerTxBaseUnits: ${suggestedBudgetUnits}n,
    rollingBudget24hBaseUnits: ${suggestedDailyUnits}n,
    whitelistDomains: ['gate.aipmedia.cn'],
  })
);

// 2. 客户端直接传入 apiKey
const client = new AgentPayClient({
  apiKey: process.env.AGENT_API_KEY ?? 'apk_live_xxx',
  policy,
});

// 3. 正常发起调用
${requestCall}
console.log('Response:', await response.json());`;
}

/**
 * Generates ready-to-use MCP (Model Context Protocol) configuration snippet for desktop clients & SDKs.
 */
export function buildMcpConfigSnippet(
  route: MarketplaceRouteItem,
  platform: 'workbuddy' | 'claude_cursor' | 'sdk' = 'workbuddy'
): string {
  const toolName = (route.slug || route.route_id || 'mcp_tool').replace(/[^a-zA-Z0-9_-]/g, '_');
  const sseUrl = `${PUBLIC_GATEWAY_URL}/v1/mcp/sse?route_id=${route.route_id || route.slug}`;
  const priceStr = formatCreditsPrice(route.price_base_units);

  if (platform === 'workbuddy') {
    return `// 复制至 ~/.workbuddy/mcp.json (腾讯 WorkBuddy 官方配置)
{
  "mcpServers": {
    "${toolName}": {
      "url": "${sseUrl}",
      "headers": {
        "Authorization": "Bearer apk_live_your_api_key"
      }
    }
  }
}`;
  }

  if (platform === 'claude_cursor') {
    return `// 复制至 claude_desktop_config.json 或 Cursor MCP 设置
{
  "mcpServers": {
    "${toolName}": {
      "url": "${sseUrl}",
      "headers": {
        "Authorization": "Bearer apk_live_your_api_key"
      }
    }
  }
}`;
  }

  // SDK Interceptor snippet
  return `import { McpToolInterceptor, InMemoryToolQuotaGuard } from 'agentpay-core-sdk';

// 1. 初始化本地/企业级财务配额守卫 (单笔上限 ¥50.00，日预算 ¥500.00)
const guard = new InMemoryToolQuotaGuard({
  maxPerTxBaseUnits: 50000000n,
  dailyBudgetBaseUnits: 500000000n,
});

// 2. 挂载 MCP 客户端拦截器 (两阶段预扣与自动防悬挂)
const interceptor = new McpToolInterceptor({
  guard,
  defaultMetadata: {
    price_base_units: ${route.price_base_units || 50000},
    price_cny: '${priceStr}',
    single_tx_cap: 50000000,
  },
});

// 3. 安全调用该 MCP 工具 (超额自动向大模型返回结构化引导，不引发崩溃)
const result = await interceptor.interceptCall(
  {
    toolName: '${toolName}',
    arguments: ${JSON.stringify(route.sample_params || { query: 'test' })},
    agentId: 'bot_worker_1',
    departmentId: 'dept_marketing',
  },
  async (args) => {
    // 实际发起网络调用至网关 MCP SSE 端点
    return { content: [{ type: 'text', text: '执行完成' }] };
  }
);`;
}

/**
 * Generates pure Markdown documentation for a single route (used by /llms.txt and AI Bot content negotiation).
 */
export function buildRouteMarkdownDoc(route: MarketplaceRouteItem): string {
  const priceStr = formatCreditsPrice(route.price_base_units);
  const clusterLabel = formatClusterLabel(route.cluster);
  const tldr = buildAnswerFirstTldr(route);
  const sdkCode = buildPythonSdkSnippet(route);
  const tsSdkCode = buildTypescriptSdkSnippet(route);

  const effectiveSampleParams =
    route.sample_params && Object.keys(route.sample_params).length > 0
      ? route.sample_params
      : (route.parameters && typeof route.parameters === 'object' && !Array.isArray(route.parameters) && Object.keys(route.parameters).length > 0)
      ? (route.parameters as Record<string, unknown>)
      : null;

  let effectiveParams = Array.isArray(route.parameters) ? route.parameters : [];
  if (effectiveParams.length === 0 && effectiveSampleParams) {
    const flatten = (obj: Record<string, unknown>, prefix = ''): typeof effectiveParams => {
      const res: typeof effectiveParams = [];
      for (const [k, v] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
          res.push({ name: fullKey, type: 'object', required: true, description: `Nested object ${fullKey}` });
          res.push(...flatten(v as Record<string, unknown>, fullKey));
        } else {
          res.push({
            name: fullKey,
            type: Array.isArray(v) ? 'array' : typeof v,
            required: true,
            description: `Parameter ${fullKey}`,
            example: typeof v === 'string' ? v : JSON.stringify(v)
          });
        }
      }
      return res;
    };
    effectiveParams = flatten(effectiveSampleParams);
  }

  const paramRows =
    effectiveParams.length > 0
      ? effectiveParams
          .map(
            (p) =>
              `| \`${p.name}\` | \`${p.type}\` | ${p.required ? 'Yes' : 'No'} | ${p.description || `Parameter ${p.name}`} |`
          )
          .join('\n')
      : `| \`params\` | \`object\` | No | Standard JSON query or body parameters forwarded to \`${route.path_pattern}\` |`;

  const sampleParamsBlock = effectiveSampleParams
    ? `\n### Request Payload Sample (application/json)\n\n\`\`\`json\n${JSON.stringify(effectiveSampleParams, null, 2)}\n\`\`\`\n`
    : '';

  return `# ${route.title} (\`${route.slug}\`)

> **TL;DR (Answer-First Summary):** ${tldr}

## 1. Core Specification & Gateway SLA

| Metric / Field | Value |
| :--- | :--- |
| **Canonical Hub URL** | ${PUBLIC_SITE_URL}/hub/${route.slug} |
| **Gateway Endpoint** | \`${PUBLIC_GATEWAY_URL}${route.path_pattern}\` |
| **Route Slug** | \`${route.slug}\` |
| **HTTP Methods** | \`${(route.methods || ['GET', 'POST']).join(', ')}\` |
| **Price** | \`${priceStr} Credits / request\` |
| **Settlement Cluster** | \`${clusterLabel}\` |
| **24h 200 OK Success Rate** | \`${route.sla.success_rate_24h}%\` |
| **P95 Latency** | \`${route.sla.p95_latency_ms} ms\` |
| **24h Verified Paid Calls** | \`${route.sla.paid_calls_24h.toLocaleString()}\` |
| **Gateway Health Status** | \`${route.sla.health_status.toUpperCase()}\` |

## 2. Input Parameters Schema

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
${paramRows}
${sampleParamsBlock}
## 3. Zero-Friction SDK Quickstart (Python & TypeScript)

### Python SDK (\`pip install agentpay-core-sdk\`)

\`\`\`python
${sdkCode}
\`\`\`

### TypeScript SDK (\`npm install agentpay-core-sdk\`)

\`\`\`typescript
${tsSdkCode}
\`\`\`

## 4. MCP (Model Context Protocol) 智能体直接接入配置

支持直接接入 **腾讯 WorkBuddy**、**Claude Desktop**、**Cursor** 等支持标准 MCP 协议的智能体环境：

\`\`\`json
${buildMcpConfigSnippet(route, 'workbuddy')}
\`\`\`

## 5. Detailed Documentation

${route.description_md}
`;
}

function applyLocalFilter(
  routes: MarketplaceRouteItem[],
  filter?: MarketplaceFilter
): MarketplaceRouteItem[] {
  if (!filter) return routes;
  return routes.filter((item) => {
    if (
      filter.category &&
      filter.category !== 'all' &&
      item.category.toLowerCase() !== filter.category.toLowerCase()
    ) {
      return false;
    }
    if (
      filter.network &&
      filter.network !== 'all' &&
      item.cluster &&
      !item.cluster.toLowerCase().includes(filter.network.toLowerCase())
    ) {
      return false;
    }
    if (filter.tag) {
      const hasTag = item.tags.some((t) => t.toLowerCase() === filter.tag!.toLowerCase());
      if (!hasTag) return false;
    }
    if (filter.q && filter.q.trim() !== '') {
      const q = filter.q.trim().toLowerCase();
      const haystack = [
        item.title,
        item.slug,
        item.summary || '',
        item.category,
        item.path_pattern,
        item.description_md,
        ...item.tags,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/**
 * Fetches public marketplace routes from the Go gateway (`/api/v1/public/marketplace/routes`).
 * When live routes exist in the gateway/database, they are returned directly.
 * Gracefully falls back to seed catalog only when zero live routes are published or gateway is offline.
 */
export async function getMarketplaceRoutes(
  filter?: MarketplaceFilter
): Promise<MarketplaceRouteItem[]> {
  let liveRoutes: MarketplaceRouteItem[] = [];

  const candidateUrls = Array.from(
    new Set(
      [
        process.env.GATEWAY_INTERNAL_URL,
        process.env.NEXT_PUBLIC_GATEWAY_API_URL,
        'http://127.0.0.1:8000',
        'http://127.0.0.1:8080',
      ].filter(Boolean) as string[]
    )
  );

  for (const base of candidateUrls) {
    try {
      const url = new URL('/api/v1/public/marketplace/routes', base);
      if (filter?.q) url.searchParams.set('q', filter.q);
      if (filter?.category && filter.category !== 'all') {
        url.searchParams.set('category', filter.category);
      }
      if (filter?.network && filter.network !== 'all') {
        url.searchParams.set('network', filter.network);
      }
      if (filter?.tag) url.searchParams.set('tag', filter.tag);

      const res = await fetch(url.toString(), {
        next: { revalidate: 15 },
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(1800),
      });

      if (res.ok) {
        const data = (await res.json()) as { routes?: MarketplaceRouteItem[] };
        if (Array.isArray(data.routes) && data.routes.length > 0) {
          liveRoutes = data.routes;
          break;
        }
      }
    } catch {
      // try next candidate base URL
    }
  }

  // If live routes exist from Go gateway, display live data without mock seed data
  if (liveRoutes.length > 0) {
    return applyLocalFilter(liveRoutes, filter);
  }

  // Fallback gracefully to seed catalog when no public routes exist yet
  return applyLocalFilter(SEED_MARKETPLACE_ROUTES, filter);
}

/**
 * Fetches a single public marketplace route by slug from the Go gateway or seed catalog.
 */
export async function getMarketplaceRouteBySlug(
  slug: string
): Promise<MarketplaceRouteItem | null> {
  const cleanSlug = decodeURIComponent(slug || '').trim().toLowerCase();
  if (!cleanSlug) return null;

  const candidateUrls = Array.from(
    new Set(
      [
        process.env.GATEWAY_INTERNAL_URL,
        process.env.NEXT_PUBLIC_GATEWAY_API_URL,
        'http://127.0.0.1:8000',
        'http://127.0.0.1:8080',
      ].filter(Boolean) as string[]
    )
  );

  for (const base of candidateUrls) {
    try {
      const url = new URL(
        `/api/v1/public/marketplace/routes/${encodeURIComponent(cleanSlug)}`,
        base
      );
      const res = await fetch(url.toString(), {
        next: { revalidate: 15 },
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(1800),
      });

      if (res.ok) {
        const data = (await res.json()) as { route?: MarketplaceRouteItem };
        if (data.route) {
          return data.route;
        }
      }
    } catch {
      // try next candidate
    }
  }

  // Fallback to seed catalog if not found in live routes
  const found = SEED_MARKETPLACE_ROUTES.find(
    (item) =>
      item.slug.toLowerCase() === cleanSlug || item.route_id.toLowerCase() === cleanSlug
  );
  return found || null;
}

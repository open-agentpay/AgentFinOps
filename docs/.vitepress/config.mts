import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

export default withMermaid(
  defineConfig({
    title: 'AgentFinOps 技术与架构文档',
    description: '企业级 AI Agent 行为审计与资金防火墙网关 (AI Agent Gateway & FinOps) 官方文档中心',
    base: process.env.DOCS_BASE || '/docs/',
    cleanUrls: true,
    ignoreDeadLinks: true,
    sitemap: {
      hostname: 'https://aipmedia.cn/docs/',
    },
    head: [
      ['link', { rel: 'icon', href: '/docs/logo.png' }],
      ['meta', { name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' }],
      ['meta', { name: 'keywords', content: 'AgentPay, AgentFinOps, AI Agent, FinOps, LLM Gateway, 金融防火墙, x402, 行为审计, 飞书审批, 预算熔断, MCP' }],
      ['meta', { name: 'author', content: 'AgentFinOps Team' }],
      ['link', { rel: 'help', type: 'text/plain', href: '/docs/llms.txt', title: 'LLM Context' }],
      ['link', { rel: 'help', type: 'text/plain', href: '/docs/llms-full.txt', title: 'Full LLM Context' }],
      ['meta', { property: 'og:site_name', content: 'AgentFinOps 文档中心' }],
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:title', content: 'AgentFinOps — 企业级 AI Agent 行为审计与资金防火墙网关' }],
      ['meta', { property: 'og:description', content: '解决 AI 智能体死循环刷爆商业 API、财务预算一团烂账、合规审计无法定责等核心痛点。' }],
      ['meta', { property: 'og:image', content: 'https://aipmedia.cn/logo.png' }],
      ['meta', { property: 'og:image:width', content: '512' }],
      ['meta', { property: 'og:image:height', content: '512' }],
      ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
      ['meta', { name: 'twitter:title', content: 'AgentFinOps — 企业级 AI Agent 行为审计与资金防火墙' }],
      ['meta', { name: 'twitter:description', content: '架设在 AI 推理与外部资金之间的金融级安全网关。' }],
      ['meta', { name: 'twitter:image', content: 'https://aipmedia.cn/logo.png' }],
      // WeChat card preview metadata
      ['meta', { itemprop: 'name', content: 'AgentFinOps — 企业级 AI Agent 行为审计与资金防火墙网关' }],
      ['meta', { itemprop: 'image', content: 'https://aipmedia.cn/logo.png' }],
      ['meta', { itemprop: 'description', content: '解决 AI 智能体死循环刷爆商业 API、财务预算一团烂账、合规审计无法定责等核心痛点。' }],
      // Channel attribution & UTM tracking snippet
      [
        'script',
        {},
        `(function(){try{var p=new URLSearchParams(window.location.search),k=['utm_source','utm_medium','utm_campaign','utm_term','utm_content','channel'],a={},h=false;for(var i=0;i<k.length;i++){var v=p.get(k[i]);if(v){a[k[i]]=v;h=true;}}if(document.referrer&&!a.referrer){a.referrer=document.referrer;h=true;}if(h){a.captured_at=new Date().toISOString();localStorage.setItem('agentpay_attribution',JSON.stringify(a));sessionStorage.setItem('agentpay_attribution_session',JSON.stringify(a));}document.addEventListener('click',function(e){var t=e.target&&e.target.closest('a');if(t&&t.href&&t.href.indexOf('console.aipmedia.cn')!==-1){var r=localStorage.getItem('agentpay_attribution');if(r){try{var d=JSON.parse(r),u=new URL(t.href);for(var x in d){if(d[x]&&!u.searchParams.has(x)&&x!=='captured_at'){u.searchParams.set(x,d[x]);}}t.href=u.toString();}catch(err){}}}});}catch(e){}})();`,
      ],
      [
        'script',
        { type: 'application/ld+json' },
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'AgentFinOps',
          applicationCategory: 'SecurityApplication',
          operatingSystem: 'Cross-platform',
          description: '企业级 AI Agent 行为审计与资金防火墙网关，提供自主智能体预算信封、单笔熔断防御、树状组织配额治理与不可篡改审计。',
          url: 'https://aipmedia.cn',
          license: 'https://github.com/open-agentpay/AgentFinOps/blob/main/LICENSE',
        }),
      ],
    ],
    themeConfig: {
      siteTitle: 'AgentFinOps 文档',
      logo: '/logo.png',
      nav: [
        { text: '平台首页', link: 'https://aipmedia.cn' },
        { text: '路线图与计划', link: '/roadmap/' },
        { text: '核心架构', link: '/architecture/' },
        { text: 'FinOps 成本治理', link: '/finops/' },
        { text: '行为安全与审计', link: '/security-hitl/agent-audit' },
        { text: '微支付协议', link: '/protocol/state-machine' },
        { text: '生态联动', link: '/ecosystem/harness-integration' },
        { text: '快速开始', link: '/guide/sdk_quickstart' },
        { text: '管理控制台', link: 'https://console.aipmedia.cn' },
      ],
      sidebar: {
        '/roadmap/': [
          {
            text: '技术演进与规划',
            items: [
              { text: 'Master Roadmap v2.0.0 全景规划', link: '/roadmap/' },
              { text: 'Master 落地实施计划 (Phase 1 拆解)', link: '/roadmap/execution-plan' },
            ],
          },
        ],
        '/architecture/': [
          {
            text: '全景架构与安全',
            items: [
              { text: '系统全景架构规范', link: '/architecture/' },
              { text: '企业安全与 N1-N6 威胁模型', link: '/architecture/security-model' },
              { text: 'ADR-001: x402 协议架构策略', link: '/architecture/adr-001' },
            ],
          },
        ],
        '/finops/': [
          {
            text: 'FinOps 治理与合规财务',
            items: [
              { text: '企业 AI 防火墙战术框架', link: '/finops/' },
              { text: '树状组织多层配额模型', link: '/finops/budget-control' },
              { text: '内部虚拟钱包与只追加账本', link: '/finops/wallet-ledger' },
              { text: '合规在线充值与防“二清”', link: '/finops/fiat-topup' },
            ],
          },
        ],
        '/security-hitl/': [
          {
            text: '行为安全与合规审计',
            items: [
              { text: 'Agent 身份与不可篡改行为审计', link: '/security-hitl/agent-audit' },
              { text: '消费与操作审计事件契约', link: '/security-hitl/audit-events' },
            ],
          },
        ],
        '/protocol/': [
          {
            text: '核心微支付协议与模型',
            items: [
              { text: '防悬挂三态状态机', link: '/protocol/state-machine' },
              { text: '跨语言协议一致性与错误码', link: '/protocol/consistency' },
              { text: '动态路由配置发布 (RCU)', link: '/protocol/config-publishing' },
            ],
          },
        ],
        '/ecosystem/': [
          {
            text: '开放生态与全链路联动',
            items: [
              { text: 'AI Harness 框架集成 (LangChain / OpenAI / CrewAI)', link: '/ecosystem/harness-integration' },
              { text: 'MCP 协议原生支付中间件', link: '/ecosystem/mcp-plugin' },
              { text: '与 Langfuse 深度共生观测', link: '/ecosystem/langfuse' },
            ],
          },
        ],
        '/guide/': [
          {
            text: '开发者与操作指南',
            items: [
              { text: '客户端 SDK 接入指南', link: '/guide/sdk_quickstart' },
              { text: '企业管理控制台操作指南', link: '/guide/console_guide' },
              { text: '快速开始与安装部署', link: '/deployment/quickstart' },
            ],
          },
        ],
        '/deployment/': [
          {
            text: '安装与部署',
            items: [
              { text: '快速开始与安装部署', link: '/deployment/quickstart' },
            ],
          },
        ],
        '/': [
          {
            text: '平台总览',
            items: [
              { text: '平台概述与愿景', link: '/' },
              { text: 'Master 路线图 v2.0.0', link: '/roadmap/' },
              { text: '客户端 SDK 接入指南', link: '/guide/sdk_quickstart' },
              { text: '快速开始与安装部署', link: '/deployment/quickstart' },
            ],
          },
          {
            text: '核心功能板块',
            items: [
              { text: '全景架构规范', link: '/architecture/' },
              { text: 'FinOps 树状预算治理', link: '/finops/budget-control' },
              { text: 'Agent 身份与行为审计', link: '/security-hitl/agent-audit' },
              { text: '防悬挂三态状态机', link: '/protocol/state-machine' },
              { text: 'MCP 协议原生支持', link: '/ecosystem/mcp-plugin' },
              { text: 'Langfuse 全链路观测', link: '/ecosystem/langfuse' },
            ],
          },
        ],
      },
      socialLinks: [
        { icon: 'github', link: 'https://github.com/open-agentpay/AgentFinOps' },
      ],
      footer: {
        message: 'AgentFinOps — 企业级 AI Agent 行为审计与资金防火墙网关',
        copyright: 'Copyright © 2026 AgentFinOps. All rights reserved.',
      },
      search: {
        provider: 'local',
      },
    },
    mermaid: {
      theme: 'default',
    },
  })
);

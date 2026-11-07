import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'AgentFinOps 文档',
  description: '企业级 AI Agent 行为审计与资金防火墙文档中心',
  base: '/docs/',
  cleanUrls: true,
  themeConfig: {
    siteTitle: 'AgentFinOps 文档',
    logo: '/logo.png',
    nav: [
      { text: '平台首页', link: 'https://aipmedia.cn' },
      { text: '快速入门', link: '/guide/sdk_quickstart' },
      { text: 'FinOps 成本治理', link: '/finops/budget-control' },
      { text: '安装部署', link: '/deployment/quickstart' },
      { text: '管理控制台', link: 'https://console.aipmedia.cn' },
    ],
    sidebar: {
      '/': [
        {
          text: '开始使用',
          items: [
            { text: '平台概述', link: '/' },
            { text: '客户端 SDK 接入指南', link: '/guide/sdk_quickstart' },
            { text: '快速安装部署', link: '/deployment/quickstart' },
          ],
        },
        {
          text: 'FinOps 财务与治理',
          items: [
            { text: '预算控制与财务防火墙', link: '/finops/budget-control' },
          ],
        },
        {
          text: '系统与协议规范',
          items: [
            { text: '总体系统架构', link: '/specs/architecture' },
            { text: '企业级安全模型', link: '/specs/security-model' },
            { text: 'Agent 行为与审计事件', link: '/specs/audit-events' },
            { text: '多租户与组织数据模型', link: '/specs/multitenant-data-model' },
            { text: '虚拟组织账本与余额', link: '/specs/wallet-ledger' },
            { text: '协议一致性与网关代理', link: '/specs/protocol-consistency' },
            { text: 'Token 计量与计费模型', link: '/specs/gas-models' },
          ],
        },
        {
          text: '架构决策 (ADR)',
          items: [
            { text: 'ADR-001: 架构选型与网关转发', link: '/specs/adr/001' },
            { text: 'ADR-002: 多租户隔离与权限模型', link: '/specs/adr/002' },
            { text: 'ADR-003: 财务防火墙与本地拦截', link: '/specs/adr/003' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/agentfinops/agentfinops' },
    ],
    footer: {
      message: 'AgentFinOps — 企业级 AI Agent 行为审计与资金防火墙',
      copyright: 'Copyright © 2026 AgentFinOps. All rights reserved.',
    },
  },
});

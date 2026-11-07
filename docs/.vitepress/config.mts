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
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/open-agentpay/AgentFinOps' },
    ],
    footer: {
      message: 'AgentFinOps — 企业级 AI Agent 行为审计与资金防火墙',
      copyright: 'Copyright © 2026 AgentFinOps. All rights reserved.',
    },
  },
});

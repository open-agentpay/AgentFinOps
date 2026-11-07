import React from 'react';
import type { Metadata } from 'next';
import { PUBLIC_SITE_URL } from '@/lib/marketplace';
import { HomePageView } from '@/components/HomePageView';

export const metadata: Metadata = {
  title: 'AgentFinOps — 面向 AI Agent 的预算防火墙与微支付网关',
  description:
    '开源 AI Agent 财务防火墙与微支付网关。支持 x402 协议与企业虚拟钱包按次结算，提供严格本地预算管控与死循环熔断保护。',
  alternates: {
    canonical: PUBLIC_SITE_URL,
  },
};

export default function HomePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'AgentFinOps',
    applicationCategory: 'PaymentApplication',
    operatingSystem: 'All',
    description:
      '开源 AI Agent 财务防火墙与微支付网关。支持企业虚拟钱包、本地预算强管控与 x402 核心网关。',
    url: PUBLIC_SITE_URL,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'CNY',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomePageView />
    </>
  );
}

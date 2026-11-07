import React from 'react';
import type { Metadata } from 'next';
import {
  PUBLIC_GATEWAY_URL,
  PUBLIC_SITE_URL,
  formatCreditsPrice,
  getMarketplaceRoutes,
} from '@/lib/marketplace';
import { MarketplaceExplorer } from '@/components/MarketplaceExplorer';

export const revalidate = 15;

export const metadata: Metadata = {
  title: 'API 功能商店 — X402 按次计费 API & SDK 验证场 | AgentFinOps',
  description:
    '汇聚支持 HTTP 402 (x402) 协议的 AI Agent 工具与服务，支持企业算力点数微支付、网关实时 SLA 探活与 AgentFinOps SDK 预算验证。',
  alternates: {
    canonical: `${PUBLIC_SITE_URL}/marketplace`,
  },
};

export default async function MarketplacePage() {
  const routes = await getMarketplaceRoutes();

  // Schema.org ItemList + WebAPI structured data for Generative Engine Optimization (GEO)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'AgentFinOps X402 API Marketplace',
    description:
      '汇聚支持 HTTP 402 (x402) 协议的 AI Agent 工具与服务，支持点数微支付与网关实时 SLA 探活。',
    url: `${PUBLIC_SITE_URL}/marketplace`,
    numberOfItems: routes.length,
    itemListElement: routes.map((route, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': ['WebAPI', 'Product'],
        name: route.title,
        url: `${PUBLIC_SITE_URL}/hub/${route.slug}`,
        description: route.summary || route.description_md,
        category: route.category,
        documentation: `${PUBLIC_SITE_URL}/hub/${route.slug}`,
        provider: {
          '@type': 'Organization',
          name: route.provider_name,
        },
        offers: {
          '@type': 'Offer',
          price: formatCreditsPrice(route.price_base_units),
          priceCurrency: 'Credits',
          availability:
            route.sla.health_status === 'healthy'
              ? 'https://schema.org/InStock'
              : 'https://schema.org/LimitedAvailability',
          url: `${PUBLIC_GATEWAY_URL}${route.path_pattern}`,
        },
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MarketplaceExplorer initialRoutes={routes} />
    </>
  );
}

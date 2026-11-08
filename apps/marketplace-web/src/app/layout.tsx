import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { PUBLIC_SITE_URL } from '@/lib/marketplace';
import { I18nProvider } from '@/i18n/context';
import { ThemeProvider } from '@/theme/ThemeContext';
import { HeaderNav } from '@/components/HeaderNav';
import { FooterNav } from '@/components/FooterNav';
import type { SupportedLocale } from '@/i18n/types';
import type { ThemeMode } from '@/theme/ThemeContext';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE_URL),
  title: {
    default: 'AgentFinOps — 面向 AI Agent 的预算防火墙与微支付网关',
    template: '%s | AgentFinOps',
  },
  description:
    '发现经过验证的 HTTP 402 (x402) API 与智能体工具服务。支持企业虚拟钱包与 x402 协议按次微支付，提供网关真实 SLA 背书与本地财务防火墙保护。',
  keywords: [
    'AgentFinOps',
    'x402',
    'HTTP 402 Payment Required',
    'AI FinOps',
    '智能体预算防火墙',
    '微支付网关',
    'AI Agent Marketplace',
    'Credits',
    'MCP Tools',
    'Agentic Web',
  ],
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.png', type: 'image/png' },
    ],
    apple: '/logo.png',
  },
  alternates: {
    canonical: PUBLIC_SITE_URL,
    types: {
      'text/markdown': `${PUBLIC_SITE_URL}/llms.txt`,
    },
  },
  openGraph: {
    title: 'AgentFinOps — 面向 AI Agent 的预算防火墙与微支付网关',
    description:
      '免注册体验 HTTP 402 APIs，提供网关真实 SLA 探活、即时 SDK 调用示例与 /llms.txt 机器目录发现。',
    url: PUBLIC_SITE_URL,
    siteName: 'AgentFinOps',
    type: 'website',
    images: [
      {
        url: `${PUBLIC_SITE_URL}/logo.png`,
        width: 512,
        height: 512,
        alt: 'AgentFinOps Logo',
      },
    ],
  },
  other: {
    'itemprop:name': 'AgentFinOps — 面向 AI Agent 的预算防火墙与微支付网关',
    'itemprop:image': `${PUBLIC_SITE_URL}/logo.png`,
    'itemprop:description':
      '免注册体验 HTTP 402 APIs，提供网关真实 SLA 探活、即时 SDK 调用示例与 /llms.txt 机器目录发现。',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let initialLocale: SupportedLocale = 'zh';
  let initialTheme: ThemeMode = 'dark';

  try {
    const cookieStore = await cookies();
    const loc = cookieStore.get('NEXT_LOCALE')?.value;
    if (loc === 'zh') {
      initialLocale = loc;
    }
    const th = cookieStore.get('NEXT_THEME')?.value;
    if (th === 'light' || th === 'dark') {
      initialTheme = th;
    }
  } catch {
    // fallback
  }

  return (
    <html
      lang="zh-CN"
      className={initialTheme === 'dark' ? 'dark' : ''}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=new URLSearchParams(window.location.search),k=['utm_source','utm_medium','utm_campaign','utm_term','utm_content','channel','ref'],a={},h=false;for(var i=0;i<k.length;i++){var v=p.get(k[i]);if(v){a[k[i]]=v;h=true;}}if(document.referrer&&!a.referrer){a.referrer=document.referrer;h=true;}if(h){a.captured_at=new Date().toISOString();localStorage.setItem('agentpay_attribution',JSON.stringify(a));sessionStorage.setItem('agentpay_attribution_session',JSON.stringify(a));}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <ThemeProvider initialTheme={initialTheme}>
          <I18nProvider initialLocale={initialLocale}>
            <HeaderNav />
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
              {children}
            </main>
            <FooterNav />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

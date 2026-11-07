/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://aipmedia.cn',
    NEXT_PUBLIC_GATEWAY_URL: process.env.NEXT_PUBLIC_GATEWAY_URL || 'https://gate.aipmedia.cn',
    NEXT_PUBLIC_CONSOLE_URL: process.env.NEXT_PUBLIC_CONSOLE_URL || 'https://console.aipmedia.cn',
    NEXT_PUBLIC_DOCS_URL: process.env.NEXT_PUBLIC_DOCS_URL || '/docs/',
  },
  async rewrites() {
    return [
      {
        source: '/docs',
        destination: '/docs/index.html',
      },
      {
        source: '/docs/',
        destination: '/docs/index.html',
      },
    ];
  },
};

export default nextConfig;

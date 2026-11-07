# 快速开始与部署指南

AgentFinOps 采用 Docker 容器化编排，内置 Caddy 边缘反向代理，支持自动申请 HTTPS 证书与 HTTP/3 极速访问。

## 生产环境一键启动

```bash
# 1. 复制环境变量模板
cp .env.example .env

# 2. 一键启动服务
docker compose -f docker-compose.nginx.yml up -d
```

## 服务端口规划
- `80 / 443`：Caddy 统一公网流量入口
- 内部网络：Gateway (8000), Console (80), Postgres (5432)

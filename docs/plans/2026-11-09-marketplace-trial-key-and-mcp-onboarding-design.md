# 功能商店匿名试用 Key 与 MCP 零门槛打通详细设计规范

> **版本**：v1.0.0 (生产级设计规范)  
> **制定日期**：2026-11-09  
> **作者**：AgentFinOps 核心架构团队  
> **状态**：**待评审定稿 (Pending Approval)**  
> **适用范围**：Go 网关 (`services/gateway` & `agent-core-sdk`)、功能商店 (`apps/marketplace-web`)、管理控制台 (`apps/console`)、MCP 客户端生态 (Cursor / 腾讯 WorkBuddy)

---

## 1. 业务痛点与设计目标 (Context & Objectives)

### 1.1 业务背景
在 AgentFinOps 功能商店（`aipmedia.cn/marketplace`）中，每个上架的微支付 API 与 MCP 工具均要求客户端提供 `Authorization: Bearer apk_live_xxx` 凭据进行两阶段资金预扣与行为审计。

传统 SaaS 转化链路面临**高摩擦漏斗**：
- 访客在详情页看到 MCP 配置后，必须先前往管理控制台注册账号、邮箱验密、新建项目、生成密钥，再充值对公款项；
- 90% 的潜在开发者与智能体工程师在“开箱试用”的第一分钟就会流失；
- 若新用户虽然注册了 Key 但未充值，其在 Cursor 或 WorkBuddy 中发起的第一次 MCP 调用就会被网关以 `402 INSUFFICIENT_FUNDS` 阻断，引发体验断崖。

### 1.2 核心目标
1. **10 秒极速体验 (Zero-Friction)**：未登录访客在商店路由页点击【一键生成测试 Key】，无需注册即可获得真实可用、含 **¥5.00** 体验金的 Key；
2. **代码全自动动态注入**：页面中的 WorkBuddy `mcp.json`、Cursor 配置、Python/TS 代码与 cURL 自动将占位符替换为该真实 Key，开箱即测；
3. **金融级防刷与零资金外溢**：解决 IP 伪造、批量并发穿透、僵尸租户膨胀、跨路由盗刷高价商业 API 等全部 6 大漏洞；
4. **终生免改配置转正 (Seamless Claim)**：用户在控制台注册正式企业账号后，可**一键认领该试用 Key**，Cursor / WorkBuddy 中的配置文件终生无需改动即可无缝转正。

---

## 2. 系统拓扑与全链路时序图 (System Topology & Flow)

```text
┌────────────────────────┐                   ┌────────────────────────┐                   ┌────────────────────────┐
│  功能商店 (Marketplace) │                   │  Go 网关 (Gateway SSE) │                   │  管理控制台 (Console)  │
└───────────┬────────────┘                   └───────────┬────────────┘                   └───────────┬────────────┘
            │                                            │                                            │
            │ 1. 点击【一键生成测试 Key】                  │                                            │
            │ ──── POST /api/v1/public/trial-key ───────>│                                            │
            │      (Client IP + Fingerprint)             │ 2. TCP 真实 IP 限流 (≤3次/天)              │
            │                                            │ 3. 在公共沙盒租户下写入 ap_api_key          │
            │                                            │    (带 24h 过期 + ¥5.00 限额)              │
            │<─── 返回真实 apk_live_guest_xxx ───────────│                                            │
            │                                                                                         │
            │ 4. 浏览器 LocalStorage 存储 Key                                                         │
            │ 5. 详情页全部 mcp.json 动态填入该 Key                                                    │
            │                                                                                         │
    ┌───────┴────────────────────────┐                                                                │
    │ Cursor / 腾讯 WorkBuddy 客户端 │                                                                │
    └───────┬────────────────────────┘                                                                │
            │ 6. 开发者在 Cursor 中触发 MCP 工具调用                                                   │
            │ ──── POST /v1/mcp/sse (Bearer apk_live_guest_xxx) ──>                                   │
            │                                            │ 7. 校验路由白名单与单笔硬顶 (≤¥0.50)        │
            │                                            │ 8. 两阶段预扣 (Hold) -> 上游执行 -> 确扣   │
            │<─── 200 OK 真实返回 MCP 响应 ──────────────│                                            │
            │                                                                                         │
            │ 9. 用户决定转正为长期客户，前往控制台                                                     │
            │ ───────────────────────────────────────────────────────────────────────────────────────>│
            │                                            │                                            │
            │                                            │ 10. 用户点击【认领试用 Key】                │
            │                                            │ <─── POST /api/v1/admin/apikeys/claim ─────│
            │                                            │ 11. 原子更新：将 Key 划转至正式企业租户    │
            │                                            │     解除试用限额，绑定正式钱包             │
            │                                            │ 12. Cursor 配置完全无需修改，充值后持续运行! │
```

---

## 3. 六大安全漏洞防范设计 (Threat Modeling & Defensive Specs)

### 3.1 漏洞 1 防御：路由试用白名单 (Preventing Upstream Drain)
* **威胁**：恶意脚本使用试用金高频调用需要向第三方对公结算的高成本商业 API（如万方、企查查、商业短信），导致平台真金白银亏损。
* **规避机制**：
  - 在 `ap_route` 表中通过 `is_trial_allowed` 字段进行白名单控制；
  - 规则：仅当 `r.is_trial_allowed = TRUE` 且 `r.price_base_units <= 500,000`（单次 $\le ¥0.50$）时，试用 Key 方可调用；
  - 若调用高价商业路由，网关直接拦截并返回：
    ```json
    {
      "isError": true,
      "content": [{
        "type": "text",
        "text": "【AgentFinOps 提示】该路由属于高价值商业接口，暂不开放匿名免密试用。请前往 https://console.aipmedia.cn 获取正式企业 API Key。"
      }]
    }
    ```

### 3.2 漏洞 2 防御：全局共享沙盒租户 (Zero Ghost Tenants Sprawl)
* **威胁**：每次申领都新建租户与钱包，导致数据库僵尸租户与外键记录爆炸。
* **规避机制**：
  - 平台预置一个全局共享沙盒租户 `ten_public_sandbox`，并配齐 `prj_sandbox`、`agt_sandbox` 与 `ap_wallet`（配置共享体验金池）；
  - 发号时**仅向 `ap_api_key` 插入单条记录**，外键统一指向沙盒租户；
  - 记录属性：
    - `key_id`: `apk_key_trial_{nanoid}`
    - `key_prefix`: `apk_live_guest_`
    - `status`: `active`
    - `expires_at`: `NOW() + INTERVAL '24 HOURS'`
    - `scopes`:
      ```json
      {
        "type": "marketplace_trial",
        "max_spend_base_units": 5000000,
        "single_tx_cap_base_units": 500000,
        "rate_limit_rpm": 6
      }
      ```
  - 定时 GC Worker 每小时执行一次清除过期且未认领的 Key：
    ```sql
    DELETE FROM ap_api_key 
    WHERE tenant_id = 'ten_public_sandbox' 
      AND expires_at < NOW() - INTERVAL '1 HOUR';
    ```

### 3.3 漏洞 3 防御：并发穿透阻断 (Concurrency & Rate Limiting)
* **威胁**：多线程并发并发查询余额，试图穿透 ¥5.00 额度。
* **规避机制**：
  - **单笔限额**：强制 `single_tx_cap = 500,000`（单笔最多扣 ¥0.50）；
  - **频控硬阻断**：对试用 Key 强制限制 `rate_limit_rpm = 6`（即每 10 秒最多 1 次调用），任何高频并发直接被网关以 `429 Too Many Requests` 切断。

### 3.4 漏洞 4 防御：MCP 语义化错误自愈 (No Mysterious 401)
* **威胁**：试用额度耗尽或过期后，客户端抛出冷冰冰的 401 导致用户误以为服务宕机。
* **规避机制**：
  - 当检测到试用 Key 额度耗尽或过期时，网关返回符合 MCP 协议标准的结构化解释文本（包含控制台一键转正链接），指导大模型或人类开发者完成升级。

### 3.5 漏洞 5 防御：终生免换 Key 的认领转正 (Seamless Claim Mechanism)
* **威胁**：转正时分配新 Key，导致用户需要翻遍 Cursor/WorkBuddy 重新修改配置。
* **规避机制**：
  - 在控制台提供 `POST /api/v1/admin/apikeys/claim-trial` 接口；
  - 用户登录后，输入或从前端 LocalStorage 自动传入 `apk_live_guest_xxx`；
  - 网关直接更新数据表：
    ```sql
    UPDATE ap_api_key 
    SET tenant_id = $new_tenant_id,
        project_id = $new_project_id,
        agent_id = $new_agent_id,
        name = 'Migrated Trial Key',
        scopes = '["gateway:call"]'::jsonb,
        expires_at = NULL
    WHERE key_hash = $key_hash AND tenant_id = 'ten_public_sandbox';
    ```
  - **效果**：客户端配置的原 Key 原地升级为企业正式 Key，充值后直接继续运行！

### 3.6 漏洞 6 防御：TCP 真实 IP 防刷 (Anti-Abuse)
* **威胁**：通过伪造 `X-Forwarded-For` 刷取试用 Key。
* **规避机制**：
  - 网关读取最底层 TCP 连接的真实 RemoteAddr，或仅信任最内层反向代理注入的真实客户端 IP；
  - 限制单 IP 24 小时内最多生成 3 把试用 Key。

---

## 4. 接口契约定义 (API Specifications)

### 4.1 公共试用 Key 申领接口
- **端点**：`POST /api/v1/public/marketplace/trial-key`
- **鉴权**：无（Public）
- **请求体 (Request)**：
  ```json
  {
    "client_fingerprint": "fp_8a2d3f10"
  }
  ```
- **成功响应 (200 OK)**：
  ```json
  {
    "success": true,
    "api_key": "apk_live_guest_9f1a8e2b7c4d3e5f",
    "balance_cny": "5.00",
    "balance_base_units": 5000000,
    "single_tx_cap_cny": "0.50",
    "rate_limit_rpm": 6,
    "expires_at": 1731234567,
    "expires_in_hours": 24,
    "claim_url": "https://console.aipmedia.cn/apikeys?claim=apk_live_guest_9f1a8e2b7c4d3e5f"
  }
  ```
- **频控超限响应 (429 Too Many Requests)**：
  ```json
  {
    "error": {
      "code": "TRIAL_RATE_LIMIT_EXCEEDED",
      "message": "当前 IP 申领过于频繁，请直接登录控制台获取长期免费 API Key"
    }
  }
  ```

---

### 4.2 控制台试用 Key 认领转正接口
- **端点**：`POST /api/v1/admin/apikeys/claim-trial`
- **鉴权**：企业租户 JWT（Bearer Token）
- **请求体 (Request)**：
  ```json
  {
    "trial_key": "apk_live_guest_9f1a8e2b7c4d3e5f",
    "target_project_id": "prj_default_01"
  }
  ```
- **成功响应 (200 OK)**：
  ```json
  {
    "success": true,
    "key_id": "apk_key_trial_xxx",
    "message": "试用 Key 认领成功！该 Key 已升级为企业正式密钥，有效期已永久化，客户端配置无需变更。"
  }
  ```

---

## 5. 数据库结构与初始化预置数据 (DDL & Seeding)

### 5.1 字段增强 (DDL)
```sql
-- 在 ap_route 中新增是否支持免密试用标记
ALTER TABLE ap_route 
ADD COLUMN IF NOT EXISTS is_trial_allowed BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_route_trial_allowed ON ap_route(is_trial_allowed) WHERE is_trial_allowed = TRUE;
```

### 5.2 共享沙盒租户初始化 (Seeding)
```sql
-- 1. 创建全局公共沙盒租户
INSERT INTO ap_tenant (tenant_id, name, currency, status)
VALUES ('ten_public_sandbox', 'OpenAgentPay Public Sandbox', 'CNY', 'active')
ON CONFLICT (tenant_id) DO NOTHING;

-- 2. 创建沙盒默认项目与 Agent
INSERT INTO ap_project (project_id, tenant_id, name, budget_cap_base_units, status)
VALUES ('prj_sandbox', 'ten_public_sandbox', 'Sandbox Trial Project', 1000000000, 'active')
ON CONFLICT (project_id) DO NOTHING;

INSERT INTO ap_agent (agent_id, tenant_id, project_id, name, status)
VALUES ('agt_sandbox', 'ten_public_sandbox', 'prj_sandbox', 'Sandbox Guest Agent', 'active')
ON CONFLICT (project_id, name) DO NOTHING;

-- 3. 创建沙盒资金总钱包 (预充 100,000 元虚拟体验金池)
INSERT INTO ap_wallet (wallet_id, tenant_id, asset, status, available_cache)
VALUES ('wlt_public_sandbox', 'ten_public_sandbox', 'CNY', 'active', 100000000000)
ON CONFLICT (tenant_id) DO NOTHING;
```

---

## 6. 功能商店前端架构与交互实现 (Frontend Design)

### 6.1 前端状态机与 LocalStorage 规范
- 存储 Key：`agentfinops_trial_key_info`
- 结构体：
  ```ts
  interface TrialKeyInfo {
    apiKey: string;
    balanceCny: string;
    expiresAt: number;
    claimedAt: number;
  }
  ```

### 6.2 详情页（`RouteDetailView.tsx`）交互形态
- 在代码展示区上方呈现 **【试用体验横幅】**：
  - **未申领时**：展示紫色渐变横幅，文案：“🎁 首次接入？点击生成免密试用 Key（预置 ¥5.00，无需注册即刻在 Cursor / WorkBuddy 跑通）”，附带快速按钮 `[ ⚡ 一键生成体验 Key ]`；
  - **申领成功后**：横幅变为绿色活跃态：“🟢 测试 Key 已生效: `apk_live_guest_...` (剩余 ¥5.00) · 页面全部代码与 mcp.json 已自动注入该 Key”，附带 `[ 复制 Key ]` 和 `[ 认领转正 ]` 按钮。
- **动态代码渲染**：
  - `buildMcpSnippet`、`buildPythonSdkSnippet`、`buildTypescriptSdkSnippet` 均接收当前生效的 API Key 参数；
  - 用户复制的代码 100% 具备真实 Key，杜绝手动修改失误。

---

## 7. 研发排期与 Definition of Done (DoD)

| 阶段 | 交付任务 | 验证标准 |
| :--- | :--- | :--- |
| **Phase 1** | 网关端点实现与沙盒预置 | 执行 `POST /api/v1/public/marketplace/trial-key` 成功发号，DB 校验外键正确，单 IP 限流生效。 |
| **Phase 2** | 网关 MCP 代理试用白名单与频控 | 使用试用 Key 通过 SSE 直连网关调用白名单路由，两阶段扣款与放行成功；调用高价商业路由被优雅拦截。 |
| **Phase 3** | 功能商店前端横幅与动态注入 | 页面一键点击实时拿到 Key，页面 4 处代码块瞬间更新真实 Key，一键复制可用。 |
| **Phase 4** | 控制台试用 Key 认领转正 | 登录控制台后一键认领试用 Key，数据库租户平滑迁移，客户端配置原封不动继续调用。 |

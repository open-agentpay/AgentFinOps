# 控制台在线充值闭环 (Online Top-up Closed Loop) 详细实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 AgentFinOps 打造端到端生产级在线充值闭环，支持租户管理员在控制台选择充值面额（微信支付 Native 扫码付 / 本地沙箱 Mock），生成动态支付二维码，扫码支付后异步 Webhook 安全验签并原子入账至企业账本，所有充值资金与计算严格以“分（Cents）”为整数单位，实现无需人工干预的自助充值与秒级到账。

**Architecture:** 
1. **Core 抽象与业务解耦 (SPI Pattern)**：
   - `agent-core-sdk`（核心层）：**仅定义通用抽象 SPI 接口**（`PaymentProvider`、`CreateOrderRequest`、`PaymentOrderResult`、`WebhookResult`），零外部支付 SDK 依赖，保持核心库轻量、中立与通用；
   - `AgentFinOps/services/gateway/internal/payment`（业务实现层）：实现具体的本土化通道，包含 `WeChatPayV3Provider`（微信 Native V3 生产模式）与 `MockPaymentProvider`（开发沙箱模拟渠道）；
2. **分级整数两阶段入账引擎**：
   - 外部支付通道以人民币“分”（整数 Cents，1 元 = 100 分）交互；
   - 网关账本与 `ap_topup_order` 的金额计算均以整型“分”保存与校验，严禁浮点数；
   - 接收 Webhook 验签后原子写入 `ap_topup_order(status=confirmed)` 与 `ap_ledger_entry(topup_credit)`，并增加 `ap_wallet` 余额；
3. **收银台交互闭环 (Console Cashier UI)**：
   - 在控制台钱包页面新增【在线充值】主操作，提供面额快捷卡片（¥10、¥50、¥100 等）、动态支付二维码渲染、短轮询状态检测、沙箱一键模拟支付与余额自愈刷新。

**Tech Stack:** Go 1.22+, PostgreSQL 15, Vue 3, TypeScript, Element Plus, Pinia.

**Spec:** `docs/roadmap/index.md` (2.2 国内合规在线充值体系), `infra/postgres/schema.sql` (ap_topup_order & ap_ledger_entry).

## Global Constraints

- **存储与运算精度**：全链路以人民币“分”（Cents）为整型单位保存和运算（1 元 = 100 分），杜绝浮点数与不必要的超大倍率换算。
- **Core 层边界**：`agent-core-sdk` 严禁引入微信、支付宝等特定第三方的非标准库依赖，仅保留通用 `PaymentProvider` 接口；具体第三方适配器全部收敛在 `AgentFinOps/services/gateway/internal/payment/`。
- **不可提现与合规防二清**：入账资金性质为“技术服务与算力点卡预付售卖”，仅用于平台 API 消费抵扣，严禁跨租户互转或原路提现。
- **两级防重复入账**：`ap_topup_order` 的 `external_ref`（三方流水号）具备唯一索引，多次收到相同的 Webhook 回调必须幂等返回成功，严禁重复加钱。
- **无商户号优雅降级**：若环境变量未配置微信支付商户号与证书，系统自动降级为沙箱 Mock 模式，允许开发与演示无障碍运行。

## Review Focus

1. **Webhook 重放攻击**：模拟三方支付平台重复投递已支付的通知，验证网关仅入账一次且返回 200 HTTP SUCCESS。
2. **金额被篡改攻击**：模拟伪造回调包修改付款金额，验证网关签名校验失败直接拒绝。
3. **过期订单处理**：支付二维码超过有效时间（15 分钟）未付款，订单标记为 `expired`，禁止过期回调入账。
4. **负余额（欠费冻结）充值自动解冻**：当租户账户处于 `frozen_arrears` 时，充值补足可用余额 $\ge 0$ 后，网关自动解冻恢复 `active` 状态。
5. **并发扫码与单号冲突**：同一租户多次发起充值，生成独立的 `topup_id` 与 `out_trade_no`，互不影响。

---

## Task Decomposition

### Task 1: Core 层支付 SPI 接口定义 (`agent-core-sdk`)

**Files:**
- Create: `/Users/wanghongjie/aiPoiject/agent-core-sdk/gateway/wallet/provider.go`
- Modify: `/Users/wanghongjie/aiPoiject/agent-core-sdk/gateway/wallet/models.go`
- Create: `/Users/wanghongjie/aiPoiject/agent-core-sdk/gateway/wallet/provider_test.go`

- [ ] **Step 1: 扩充模型与通用契约**
  - 在 `models.go` 中明确以“分”为单位的金额语义：
    - `AmountCents int64`（整型分，1 元 = 100 分）；
    - `TopUpStatus`：`created`, `pending`, `confirmed`, `failed`, `expired`, `reversed`；
  - 在 `provider.go` 中定义 SPI 接口与结构体：
    ```go
    type PrepayOrderRequest struct {
        TenantID    string
        WalletID    string
        AmountCents int64 // 金额 (分)
        Currency    string
        Description string
        ClientIP    string
    }

    type PrepayOrderResult struct {
        OutTradeNo string
        CodeURL    string // 二维码文本内容
        ExpiresAt  time.Time
    }

    type WebhookPaymentResult struct {
        OutTradeNo     string
        TransactionID  string
        PaidAmountCents int64
        PayerID        string
        PaidAt         time.Time
        RawPayload     []byte
    }

    type PaymentProvider interface {
        Name() string
        CreatePrepayOrder(ctx context.Context, req *PrepayOrderRequest) (*PrepayOrderResult, error)
        ParseAndVerifyWebhook(ctx context.Context, header http.Header, body []byte) (*WebhookPaymentResult, error)
        QueryOrder(ctx context.Context, outTradeNo string) (*PrepayOrderResult, error)
    }
    ```

- [ ] **Step 2: 编写测试并验证 Core 层纯粹性**
  - 验证 `provider.go` 零外部第三方依赖；
  - 运行 `go test -v ./gateway/wallet/...` 确保通过。

---

### Task 2: 业务层微信支付与沙箱 Mock 适配器开发 (`AgentFinOps`)

**Files:**
- Create: `/Users/wanghongjie/aiPoiject/AgentFinOps/services/gateway/internal/payment/wechat.go`
- Create: `/Users/wanghongjie/aiPoiject/AgentFinOps/services/gateway/internal/payment/mock.go`
- Create: `/Users/wanghongjie/aiPoiject/AgentFinOps/services/gateway/internal/payment/payment_test.go`

- [ ] **Step 1: 实现 `MockPaymentProvider`**
  - 在 `internal/payment/mock.go` 实现沙箱模拟通道；
  - 生成格式为 `mockpay://simulate?out_trade_no=...&amount_cents=...` 的 code_url；
  - 提供 `SimulateWebhookPayload(outTradeNo string, amountCents int64)` 辅助函数。

- [ ] **Step 2: 实现 `WeChatPayV3Provider`**
  - 在 `internal/payment/wechat.go` 实现微信支付 Native V3 规范：
    - 读取配置：`WECHAT_PAY_APPID`, `WECHAT_PAY_MCHID`, `WECHAT_PAY_SERIAL_NO`, `WECHAT_PAY_API_V3_KEY`, `WECHAT_PAY_PRIVATE_KEY_PATH`, `WECHAT_PAY_NOTIFY_URL`；
    - 请求微信 V3 下单端点：`POST https://api.mch.weixin.qq.com/v3/pay/transactions/native`；
    - 使用商户私钥生成 Authorization SHA256withRSA Token；
    - 实现 Webhook 异步通知回调解密（AES-256-GCM 解密密文）与平台证书验签。

- [ ] **Step 3: 编写单测验证**
  - 在 `payment_test.go` 中测试 Mock 下单与微信 V3 报文解密逻辑；
  - 运行 `go test -v ./internal/payment/...` 验证通过。

---

### Task 3: 充值生命周期事务与网关 Admin/Webhook 端点

**Files:**
- Modify: `/Users/wanghongjie/aiPoiject/agent-core-sdk/gateway/wallet/postgres.go`
- Modify: `/Users/wanghongjie/aiPoiject/agent-core-sdk/gateway/admin/handlers.go`
- Modify: `/Users/wanghongjie/aiPoiject/agent-core-sdk/gateway/admin/service.go`
- Modify: `/Users/wanghongjie/aiPoiject/AgentFinOps/services/gateway/cmd/gateway/main.go`
- Modify: `/Users/wanghongjie/aiPoiject/AgentFinOps/infra/postgres/schema.sql`

- [ ] **Step 1: 充值生命周期方法**
  - 在 `postgres.go` 增加 `CreatePendingTopUp(ctx, order *TopUpOrder)`，插入状态为 `pending` 的订单；
  - 增加 `ConfirmTopUpPayment(ctx, outTradeNo, externalRef string, paidAmountCents int64, confirmedAt time.Time) (*TopUpOrder, error)`：
    - 校验订单存在、状态为 `pending` 且金额一致；
    - 更新订单状态为 `confirmed`，更新 `confirmed_at` 与 `external_ref`；
    - 插入 `ap_ledger_entry(type='topup_credit', amount=paidAmountCents)`；
    - 更新 `ap_wallet SET available_cache = available_cache + paidAmountCents`；
    - 若原状态为 `frozen_arrears` 且更新后 `available_cache >= 0`，自动恢复为 `active`！

- [ ] **Step 2: 注册 Admin & Webhook 路由**
  - `POST /api/v1/tenants/{tenant_id}/topup-orders`：发起充值预下单，返回 `code_url` 与 `out_trade_no`；
  - `GET /api/v1/tenants/{tenant_id}/topup-orders/{topup_id}`：查询订单实时状态供前端轮询；
  - `POST /api/v1/public/webhooks/wechat-pay`：公开免密微信支付异步回调，验签后调用 `ConfirmTopUpPayment`；
  - `POST /api/v1/public/mock-pay/confirm`：开发环境一键模拟支付成功端点。

- [ ] **Step 3: 同步 Vendor 并编译网关**
  - 同步 `agent-core-sdk` 至 `services/gateway/vendor/`；
  - 编译 `go build -mod=vendor ./cmd/gateway` 确保零错误。

---

### Task 4: 控制台前端收银台与在线充值组件开发 (`apps/console`)

**Files:**
- Modify: `/Users/wanghongjie/aiPoiject/AgentFinOps/apps/console/src/api/client.ts`
- Modify: `/Users/wanghongjie/aiPoiject/AgentFinOps/apps/console/src/views/wallet/index.vue`
- Create: `/Users/wanghongjie/aiPoiject/AgentFinOps/apps/console/src/components/TopUpModal.vue`

- [ ] **Step 1: 封装 API 请求**
  - 在 `client.ts` 中封装 `createTopUpOrder`、`getTopUpOrderStatus` 与 `simulateMockPayment`。

- [ ] **Step 2: 开发 `TopUpModal.vue` 收银台组件**
  - 快捷充值面额卡片（¥10、¥50、¥100、¥500、自定义金额）；
  - 算力金额说明：清晰展示充值金额与账本到账金额（直接以元/分对应）；
  - 微信扫码二维码动态渲染（使用 `qrcode` 库生成 SVG/Canvas）；
  - 15 分钟失效倒计时与短轮询（每 2 秒一次）；
  - 沙箱模式检测：当处于 Mock 渠道时，显示便捷按钮 `⚡ [沙箱调试] 一键模拟支付成功`；
  - 支付成功动画反馈，触发回调自动刷新页面钱包余额。

- [ ] **Step 3: 集成至 `wallet/index.vue`**
  - 将【在线充值】作为首要推荐按钮置于顶部操作区；
  - 在欠费冻结（`frozen_arrears`）告警条中加入【立即充值平账】直达入口。

---

### Task 5: 全链路联调与验证

- [ ] **Step 1: 验证沙箱/微信扫码下单与到账流程**
- [ ] **Step 2: 验证重复 Webhook 幂等阻断**
- [ ] **Step 3: 验证欠费账户足额充值后自动解除 `frozen_arrears` 冻结**
- [ ] **Step 4: 双仓库 Commit & Push**

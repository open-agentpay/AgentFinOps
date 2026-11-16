# Multi-Provider Model Gateway & SSE Streaming Micro-Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform AgentFinOps and AgentPay into a production-grade AI Model Gateway supporting multi-provider LLMs (DeepSeek, OpenAI, 阿里云百炼, etc.) with OpenAI-compatible `/v1/chat/completions` and `/v1/models` endpoints, real-time SSE chunk token sniffing & mid-stream circuit breaking, high-throughput memory RingBuffer batch settlement, and console upstream API Key management with AES encryption.

**Architecture:** Route-level native extension (Scheme A). The core engine runs in `agent-core-sdk/gateway`, intercepting `/v1/chat/completions`, estimating pre-hold budgets, piping SSE chunks through a `StreamSniffer` that meters tokens and terminates connections on budget depletion, and buffering transactions via an in-memory RingBuffer flushed in batches to PostgreSQL. `AgentFinOps` and `AgentPay` act as downstream consumers providing the database schema, management console UI, and client SDKs.

**Tech Stack:** Go 1.21+, PostgreSQL 15, Vue 3 + TypeScript + Element Plus, SSE (Server-Sent Events), AES-256-GCM.

**Spec:** `docs/plans/2026-11-16-model-gateway-streaming-billing-design.md`

## Global Constraints

- **Integer Micro-Unit Precision**: 1 CNY = 1,000,000 base units. Token prices are stored as integer base units per 1,000 Tokens (e.g., ¥0.002 / 1k tokens = 2,000 base units). No floating-point math in financial calculations.
- **Cross-Repo Boundary**: Core gateway engine changes must be made in `agent-core-sdk/gateway/`. Management console and DDL live in `AgentFinOps` and `AgentPay`.
- **Zero Chunk Blocking**: The proxy stream forwarding loop must never perform synchronous database operations per chunk.
- **Backward Compatibility**: Standard API routes (`route_type = 'api'`) must remain 100% unaffected.

## Review Focus

1. **Mid-Stream Balance Exhaustion**: When a tenant's available balance is depleted mid-generation, `StreamSniffer` must emit an error frame and close the connection within 30ms without overdrawing the account.
2. **Client Disconnection / Cancelation**: If a client terminates the connection prematurely, the gateway must tally tokens generated up to that chunk and settle (Capture actual + Release remaining Hold).
3. **Upstream Error / Non-200 Response**: If the upstream model returns 401/429/500, the Hold must be released immediately without charging the tenant.
4. **RingBuffer Flush on Gateway Shutdown**: When the gateway receives SIGTERM, `LedgerRingBuffer` must flush all queued ledger events before process termination.
5. **API Key AES Masking**: Console must never expose decrypted upstream API keys in plaintext in list responses; only masked values (`sk-***`) or write-only inputs.

---

### Task 1: Database Schema Expansion (DDL)

**Files:**
- Modify: `AgentFinOps/infra/postgres/schema.sql:100-140`
- Modify: `AgentPay/infra/postgres/schema.sql:100-140`

**Interfaces:**
- Produces: `ap_route` table with `route_type`, `model_name`, `pricing_type`, `prompt_token_price_base_units`, `completion_token_price_base_units`, `model_metadata`.

- [ ] **Step 1: Write DDL expansion in `AgentFinOps/infra/postgres/schema.sql`**

Add fields to `ap_route`:
```sql
ALTER TABLE ap_route 
    ADD COLUMN IF NOT EXISTS route_type VARCHAR(32) NOT NULL DEFAULT 'api' CHECK (route_type IN ('api', 'llm')),
    ADD COLUMN IF NOT EXISTS model_name VARCHAR(128) NULL,
    ADD COLUMN IF NOT EXISTS pricing_type VARCHAR(32) NOT NULL DEFAULT 'per_request' CHECK (pricing_type IN ('per_request', 'per_token')),
    ADD COLUMN IF NOT EXISTS prompt_token_price_base_units BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS completion_token_price_base_units BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS model_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_ap_route_tenant_model ON ap_route(tenant_id, model_name) 
    WHERE route_type = 'llm' AND status = 'active';
```

- [ ] **Step 2: Sync DDL expansion into `AgentPay/infra/postgres/schema.sql`**

Apply the identical columns and index to `AgentPay/infra/postgres/schema.sql`.

- [ ] **Step 3: Verify syntax against PostgreSQL schema validation**

Run: `git diff AgentFinOps/infra/postgres/schema.sql AgentPay/infra/postgres/schema.sql`
Expected: Clean diff with valid SQL syntax matching the spec.

- [ ] **Step 4: Commit**

```bash
git add AgentFinOps/infra/postgres/schema.sql AgentPay/infra/postgres/schema.sql
git commit -m "feat(schema): expand ap_route with LLM model attributes and token pricing"
```

---

### Task 2: Core Route Model & RCU Registry in `agent-core-sdk`

**Files:**
- Modify: `/Users/wanghongjie/aiPoiject/agent-core-sdk/gateway/admin/models.go`
- Modify: `/Users/wanghongjie/aiPoiject/agent-core-sdk/gateway/rcu/rcu.go`
- Test: `/Users/wanghongjie/aiPoiject/agent-core-sdk/gateway/rcu/rcu_test.go`

**Interfaces:**
- Produces: `Route` struct with `RouteType`, `ModelName`, `PricingType`, `PromptTokenPrice`, `CompletionTokenPrice`, `ModelMetadata`.
- Produces: `rcu.Registry.GetLLMRoute(tenantID string, modelName string) (*Route, bool)`

- [ ] **Step 1: Write the failing unit test for LLM route lookup**

In `/Users/wanghongjie/aiPoiject/agent-core-sdk/gateway/rcu/rcu_test.go`:
```go
func TestRCU_GetLLMRoute(t *testing.T) {
    registry := NewRegistry()
    r := &Route{
        RouteID: "rt_llm_deepseek",
        TenantID: "ten_test",
        RouteType: "llm",
        ModelName: "deepseek-v3",
        PricingType: "per_token",
        PromptTokenPrice: 2000,
        CompletionTokenPrice: 8000,
        Status: "active",
    }
    registry.UpdateRoutes([]*Route{r})
    
    found, ok := registry.GetLLMRoute("ten_test", "deepseek-v3")
    if !ok || found.RouteID != "rt_llm_deepseek" {
        t.Fatalf("expected to find LLM route for deepseek-v3, got %v, ok=%v", found, ok)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/wanghongjie/aiPoiject/agent-core-sdk/gateway && go test -v ./rcu/... -run TestRCU_GetLLMRoute`
Expected: FAIL with undefined fields/methods.

- [ ] **Step 3: Implement struct fields and `GetLLMRoute` method**

In `models.go` and `rcu.go`:
Add fields to `Route`: `RouteType string`, `ModelName string`, `PricingType string`, `PromptTokenPrice int64`, `CompletionTokenPrice int64`, `ModelMetadata map[string]any`.
Implement `GetLLMRoute(tenantID, modelName string) (*Route, bool)` indexing on `tenantID + ":" + modelName`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/wanghongjie/aiPoiject/agent-core-sdk/gateway && go test -v ./rcu/... -run TestRCU_GetLLMRoute`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/wanghongjie/aiPoiject/agent-core-sdk
git add gateway/admin/models.go gateway/rcu/
git commit -m "feat(gateway): add LLM route attributes and model lookup in RCU registry"
```

---

### Task 3: StreamSniffer & Real-Time Token Sniffing with Mid-Stream Breaker

**Files:**
- Create: `/Users/wanghongjie/aiPoiject/agent-core-sdk/gateway/proxy/stream_sniffer.go`
- Create: `/Users/wanghongjie/aiPoiject/agent-core-sdk/gateway/proxy/stream_sniffer_test.go`

**Interfaces:**
- Produces: `StreamSniffer` wrapping upstream `http.Response.Body` to downstream `http.ResponseWriter`.
- Produces: `SniffResult { PromptTokens int64, CompletionTokens int64, TerminatedEarly bool, ErrorReason string }`
- Consumes: Price calculator: `CalculateCost(promptTokens, completionTokens, promptPrice, completionPrice int64) int64`

- [ ] **Step 1: Write the failing unit tests for StreamSniffer**

In `/Users/wanghongjie/aiPoiject/agent-core-sdk/gateway/proxy/stream_sniffer_test.go`:
1. `TestStreamSniffer_NormalStream`: verifies SSE chunk forwarding, token delta accumulation, and extracting final `usage` tokens upon `[DONE]`.
2. `TestStreamSniffer_MidStreamBudgetBreaker`: verifies that when `currentCost > maxAllowedBalance`, it emits an error event chunk and stops forwarding.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/wanghongjie/aiPoiject/agent-core-sdk/gateway && go test -v ./proxy/... -run TestStreamSniffer`
Expected: FAIL with package/type missing.

- [ ] **Step 3: Implement `StreamSniffer` in `stream_sniffer.go`**

Implement SSE chunk parsing scanning `data: `:
- Detect `data: [DONE]` and `usage` JSON objects.
- Count generated tokens incrementally.
- Check against `budgetLimit`. If breached, flush `data: {"error": {"code": "STREAM_BUDGET_EXHAUSTED", "message": "Wallet balance exhausted during streaming."}}\n\n`, then return `ErrBudgetExhausted`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/wanghongjie/aiPoiject/agent-core-sdk/gateway && go test -v ./proxy/... -run TestStreamSniffer`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/wanghongjie/aiPoiject/agent-core-sdk
git add gateway/proxy/stream_sniffer.go gateway/proxy/stream_sniffer_test.go
git commit -m "feat(proxy): implement StreamSniffer for SSE token metering and mid-stream circuit breaker"
```

---

### Task 4: In-Memory RingBuffer Batch Ledger Settlement

**Files:**
- Create: `/Users/wanghongjie/aiPoiject/agent-core-sdk/gateway/settlement/ringbuffer.go`
- Create: `/Users/wanghongjie/aiPoiject/agent-core-sdk/gateway/settlement/ringbuffer_test.go`

**Interfaces:**
- Produces: `LedgerRingBuffer` with `Enqueue(event *LedgerEvent) bool`, `Start(ctx context.Context)`, `Close() error`.
- Consumes: `sql.DB` batch executor for `INSERT INTO ap_ledger_entry` and `UPDATE ap_wallet`.

- [ ] **Step 1: Write the failing unit test for LedgerRingBuffer**

In `/Users/wanghongjie/aiPoiject/agent-core-sdk/gateway/settlement/ringbuffer_test.go`:
Test `Enqueue` and verify batch flusher fires after timeout (100ms) or threshold (200 items), writing items in a single batch.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/wanghongjie/aiPoiject/agent-core-sdk/gateway && go test -v ./settlement/... -run TestLedgerRingBuffer`
Expected: FAIL.

- [ ] **Step 3: Implement `LedgerRingBuffer` in `ringbuffer.go`**

Implement worker loop with buffered channel, ticker (100ms), and batch buffer slice. Implement graceful shutdown on `Close()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/wanghongjie/aiPoiject/agent-core-sdk/gateway && go test -v ./settlement/... -run TestLedgerRingBuffer`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/wanghongjie/aiPoiject/agent-core-sdk
git add gateway/settlement/ringbuffer.go gateway/settlement/ringbuffer_test.go
git commit -m "feat(settlement): implement high-throughput memory RingBuffer for batch ledger writes"
```

---

### Task 5: OpenAI Compatible Handlers (`/v1/chat/completions` & `/v1/models`)

**Files:**
- Create: `/Users/wanghongjie/aiPoiject/agent-core-sdk/gateway/server/chat_handler.go`
- Modify: `/Users/wanghongjie/aiPoiject/agent-core-sdk/gateway/server/server.go`
- Test: `/Users/wanghongjie/aiPoiject/agent-core-sdk/gateway/server/chat_handler_test.go`

**Interfaces:**
- Produces: `handleChatCompletions(w http.ResponseWriter, r *http.Request)`
- Produces: `handleModelsList(w http.ResponseWriter, r *http.Request)`
- Consumes: `rcu.GetLLMRoute`, `proxy.StreamSniffer`, `upstreamauth.Apply`, `settlement.LedgerRingBuffer`.

- [ ] **Step 1: Write failing integration test for chat completion handler**

In `/Users/wanghongjie/aiPoiject/agent-core-sdk/gateway/server/chat_handler_test.go`:
Mock upstream OpenAI/DeepSeek HTTP server returning SSE chunks.
Send `POST /v1/chat/completions` through gateway and assert HTTP 200 SSE streaming response with correct hold, token metering, and balance deduction.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/wanghongjie/aiPoiject/agent-core-sdk/gateway && go test -v ./server/... -run TestChatCompletions`
Expected: FAIL.

- [ ] **Step 3: Implement `chat_handler.go` and wire into `server.go`**

- Register `/v1/chat/completions` and `/v1/models` in `server.go`.
- Inspect `req.Model`, lookup route via `rcu.GetLLMRoute`.
- Execute Hold based on estimated tokens ($Prompt + \min(max\_tokens, 4096)$).
- Forward to upstream using `upstreamauth` injected credentials.
- If `stream=true`, pipe through `StreamSniffer`.
- Enqueue final settlement event into `LedgerRingBuffer`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/wanghongjie/aiPoiject/agent-core-sdk/gateway && go test -v ./server/... -run TestChatCompletions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/wanghongjie/aiPoiject/agent-core-sdk
git add gateway/server/chat_handler.go gateway/server/server.go gateway/server/chat_handler_test.go
git commit -m "feat(server): implement /v1/chat/completions and /v1/models dispatchers with SSE metering"
```

---

### Task 6: Synchronize `agent-core-sdk` to `AgentFinOps` Gateway & CI Validation

**Files:**
- Modify: `AgentFinOps/services/gateway/vendor/` (sync from `agent-core-sdk/gateway/`)
- Test: `AgentFinOps/services/gateway`

- [ ] **Step 1: Synchronize vendor directory in `AgentFinOps/services/gateway`**

Copy updated packages (`admin`, `rcu`, `proxy`, `server`, `settlement`) from `agent-core-sdk/gateway/` to `AgentFinOps/services/gateway/vendor/github.com/open-agentpay/agent-core-sdk/gateway/`.

- [ ] **Step 2: Run gateway tests in `AgentFinOps`**

Run: `cd /Users/wanghongjie/aiPoiject/AgentFinOps && make gateway-test`
Expected: PASS (all gateway tests pass cleanly).

- [ ] **Step 3: Build gateway binary in `AgentFinOps`**

Run: `cd /Users/wanghongjie/aiPoiject/AgentFinOps && make gateway-build`
Expected: PASS (generates `services/gateway/bin/gateway`).

- [ ] **Step 4: Commit**

```bash
cd /Users/wanghongjie/aiPoiject/AgentFinOps
git add services/gateway/vendor/
git commit -m "feat(gateway): sync agent-core-sdk vendor with LLM streaming micro-billing"
```

---

### Task 7: Console Management UI - Model Route Wizard & API Key Management

**Files:**
- Modify: `AgentFinOps/apps/console/src/views/routes/index.vue`
- Create: `AgentFinOps/apps/console/src/views/routes/components/ModelRouteModal.vue`
- Modify: `AgentPay/apps/console/src/views/routes/index.vue`
- Create: `AgentPay/apps/console/src/views/routes/components/ModelRouteModal.vue`

**Interfaces:**
- Produces: "新建大模型路由" (Create LLM Route) modal with DeepSeek, 阿里云百炼, OpenAI preset cards.
- Produces: API Key masked input (`sk-***`), Ping connection test, and Input/Output Token pricing calculator.

- [ ] **Step 1: Create `ModelRouteModal.vue` in `AgentFinOps`**

Implement:
1. Preset selector: DeepSeek (`https://api.deepseek.com/v1`), 阿里云百炼 (`https://dashscope.aliyuncs.com/compatible-mode/v1`), OpenAI (`https://api.openai.com/v1`), Custom/Ollama.
2. Model identifier input (e.g. `deepseek-v3`, `qwen-plus`).
3. Upstream API Key input with password toggle and 【测试连通性 (Ping)】button.
4. Input Token price (¥/1k Tokens) & Output Token price (¥/1k Tokens) auto-converted to integer base units.

- [ ] **Step 2: Add LLM Route Filter and button to `routes/index.vue`**

Add filter tabs: `全部 / 传统 API / 大模型 (LLM)`. Show model badge and token pricing on LLM routes.

- [ ] **Step 3: Test Console build and Vitest in `AgentFinOps`**

Run: `cd /Users/wanghongjie/aiPoiject/AgentFinOps/apps/console && ./node_modules/.bin/vitest run`
Expected: PASS (all tests pass).

- [ ] **Step 4: Port `ModelRouteModal.vue` and filter to `AgentPay`**

Adapt currency label to support dynamic asset (`CNY` / `USD` / `Credits`).

- [ ] **Step 5: Commit**

```bash
cd /Users/wanghongjie/aiPoiject/AgentFinOps
git add apps/console/src/views/routes/
git commit -m "feat(console): add LLM route creation wizard with multi-provider presets and token pricing"

cd /Users/wanghongjie/aiPoiject/AgentPay
git add apps/console/src/views/routes/
git commit -m "feat(console): add LLM route creation wizard with multi-provider presets and token pricing"
```

---

### Task 8: Python & TypeScript SDK Helper Support in `AgentPay`

**Files:**
- Modify: `AgentPay/sdk/python/packages/agentpay/src/agentpay/client.py`
- Modify: `AgentPay/sdk/typescript/packages/client/src/index.ts`
- Test: `AgentPay/sdk/python/tests/unit/test_model_client.py`

**Interfaces:**
- Produces: Python `client.create_openai_client()` helper.
- Produces: TS `createOpenAIClient()` helper.
- Produces: Automatic handling of HTTP 402 `STREAM_BUDGET_EXHAUSTED` raising `BudgetExhaustedException`.

- [ ] **Step 1: Write unit test for Python OpenAI client helper**

In `AgentPay/sdk/python/tests/unit/test_model_client.py`:
Test that `create_openai_client(api_key="apk_xxx")` constructs an OpenAI client with `base_url` pointing to the gateway `/v1` endpoint.

- [ ] **Step 2: Implement Python helper in `client.py`**

- [ ] **Step 3: Implement TypeScript helper in `index.ts`**

- [ ] **Step 4: Run unit tests**

Run: `cd /Users/wanghongjie/aiPoiject/AgentPay && python3 -m pytest sdk/python/tests/unit/test_model_client.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/wanghongjie/aiPoiject/AgentPay
git add sdk/python/ sdk/typescript/
git commit -m "feat(sdk): add OpenAI client helper and budget exhausted exception handling"
```

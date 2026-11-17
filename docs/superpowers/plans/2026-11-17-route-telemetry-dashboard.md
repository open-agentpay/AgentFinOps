# Route Telemetry & LLM Token Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a high-performance, modular route telemetry overview in the Console Dashboard that visualizes total calls, LLM token count, success rate, and average latency.

**Architecture:** 
- Backend: Lightweight aggregated SQL queries with a 15-second in-memory TTL cache + SingleFlight deduplication in `gateway/admin`, exposed via `GET /api/v1/tenants/{tenantId}/analytics/routes-overview`.
- Frontend: Modular Vue 3 component `RouteTelemetryPanel.vue` with responsive metric cards and route breakdown table, embedded seamlessly into `Dashboard/index.vue`.

**Tech Stack:** Go 1.21, PostgreSQL, Vue 3, TypeScript, Element Plus, Vite.

**Spec:** Dashboard route telemetry panel supporting 1h/24h/7d time ranges, sub-millisecond cached responses, and zero main proxy request latency impact.

## Global Constraints
- High-Performance: Cached telemetry queries must respond in < 2ms from memory; database queries must complete within 20ms using indexed columns.
- Modular UI: UI components must live in dedicated files under `views/dashboard/components/` with scoped styling and type safety.
- Non-breaking: Preserve existing API routes and dashboard layout; fail gracefully if telemetry data is empty.

---

### Task 1: Backend Models & Telemetry Service (`agent-core-sdk/gateway`)

**Files:**
- Create: `gateway/admin/telemetry.go`
- Modify: `gateway/admin/service.go`
- Modify: `gateway/admin/postgres.go`
- Modify: `gateway/admin/handlers.go`
- Test: `gateway/admin/telemetry_test.go`

**Interfaces:**
- Produces: `RouteTelemetryOverviewResponse` containing `summary` (total calls, tokens, success rate, avg/p95 latency) and `routes` array.
- Endpoint: `GET /api/v1/tenants/{tenantId}/analytics/routes-overview?time_range=24h&project_id=...`

- [ ] **Step 1: Write the failing unit test**
Test that `GetRouteTelemetryOverview` correctly aggregates calls, tokens, success rates, and respects 15-second TTL cache in memory.

- [ ] **Step 2: Run test to verify it fails**
Run: `cd gateway && go test -v ./admin -run TestGetRouteTelemetryOverview`
Expected: FAIL (types / methods not defined)

- [ ] **Step 3: Define telemetry models and service contract**
In `gateway/admin/models.go` (or `telemetry.go`), define `RouteTelemetrySummary`, `RouteTelemetryItem`, `RouteTelemetryOverviewResponse`. Add `GetRouteTelemetryOverview(ctx context.Context, tenantID, timeRange, projectID, actorMemberID string) (*RouteTelemetryOverviewResponse, error)` to `admin.Service`.

- [ ] **Step 4: Implement memory and PostgreSQL telemetry service**
In `gateway/admin/service.go` and `gateway/admin/postgres.go`:
- Implement 15s in-memory TTL caching with `sync.RWMutex`.
- Execute optimized aggregation on `ap_request_records` and `ap_usage_events`.

- [ ] **Step 5: Register HTTP route in admin handlers**
In `gateway/admin/handlers.go`, add `case "analytics":` -> handle `routes-overview`.

- [ ] **Step 6: Run test to verify it passes**
Run: `cd gateway && go test -v ./admin -run TestGetRouteTelemetryOverview`
Expected: PASS

- [ ] **Step 7: Commit**
```bash
git add gateway/admin/
git commit -m "feat(admin): implement high-performance route telemetry aggregation API"
```

---

### Task 2: Frontend Types & API Client (`AgentFinOps/apps/console`)

**Files:**
- Create: `apps/console/src/types/telemetry.ts`
- Modify: `apps/console/src/api/client.ts`

**Interfaces:**
- Produces: `analyticsApi.getRouteTelemetry(tenantId: string, params?: { time_range?: string; project_id?: string })` returning `Promise<RouteTelemetryOverviewResponse>`

- [ ] **Step 1: Define TypeScript telemetry types**
Create `apps/console/src/types/telemetry.ts` defining `RouteTelemetrySummary`, `RouteTelemetryItem`, and `RouteTelemetryOverviewResponse`.

- [ ] **Step 2: Add `analyticsApi` to API client**
In `apps/console/src/api/client.ts`, add `analyticsApi` with `getRouteTelemetry`.

- [ ] **Step 3: Verify TypeScript compilation**
Run: `cd apps/console && pnpm run type-check` (or `npx vue-tsc --noEmit`)
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add apps/console/src/types/telemetry.ts apps/console/src/api/client.ts
git commit -m "feat(console): add telemetry API client and typescript types"
```

---

### Task 3: Modular Dashboard Component `RouteTelemetryPanel.vue`

**Files:**
- Create: `apps/console/src/views/dashboard/components/RouteTelemetryPanel.vue`
- Modify: `apps/console/src/views/dashboard/index.vue`

**Interfaces:**
- Consumes: `analyticsApi.getRouteTelemetry`
- Props: `tenantId: string`, `projectId?: string`

- [ ] **Step 1: Create modular `RouteTelemetryPanel.vue`**
Implement the component with:
- Time range switcher (`1h`, `24h`, `7d`).
- 4 KPI cards: Total Requests, Total LLM Tokens (with prompt/completion detail), Success Rate (with status badge), Average Latency (with P95).
- Route performance table showing call count, token usage, success rate progress bar, and avg duration.
- Loading skeleton and error fallback.

- [ ] **Step 2: Mount `RouteTelemetryPanel` into `views/dashboard/index.vue`**
Import `RouteTelemetryPanel` and embed it cleanly right below the project budget bar.

- [ ] **Step 3: Test build of console frontend**
Run: `cd apps/console && pnpm build`
Expected: SUCCESS

- [ ] **Step 4: Commit**
```bash
git add apps/console/src/views/dashboard/
git commit -m "feat(dashboard): add modular route telemetry panel"
```

---

### Task 4: End-to-End Build & Verification

- [ ] **Step 1: Run all gateway tests in `agent-core-sdk/gateway`**
Run: `cd gateway && go test ./...`
Expected: All tests pass.

- [ ] **Step 2: Build `AgentFinOps/services/gateway`**
Run: `cd services/gateway && go build ./cmd/gateway`
Expected: Build succeeds.

- [ ] **Step 3: Build `AgentFinOps/apps/console`**
Run: `cd apps/console && pnpm build`
Expected: Build succeeds.

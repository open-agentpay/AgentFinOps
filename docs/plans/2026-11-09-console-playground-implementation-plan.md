# 控制台免配置在线体验沙箱 (Playground) 研发实施计划 (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 AgentPay 控制台构建全屏交互式「资金防火墙在线体验沙箱 (Playground)」，实现免登录/免充值/零配置的公域极速体验，支持通过三栏交互实时模拟“Agent 发起调用 $\to$ 级联配额校验 $\to$ 402 异步挂起 $\to$ 手机飞书卡片一键审批 $\to$ 原子平账”，并在文末闭环引流至微信公众号与技术交流群。

**Architecture:** 
- 前端单页面三栏沉浸式响应架构（Vue 3 + Composition API + Element Plus + Scoped CSS）。
- 内置零后端依赖的高保真 HTTP 402/200/403 状态机引擎，支持秒级响应、轮询等待与解挂流转；同时保留切换真实网关接口的能力。
- 路由放行：开放 `/playground` 免鉴权直达（`requiresAuth: false`），并在登录页 `/login` 和侧边栏全局导航增加入口。

**Tech Stack:** Vue 3, TypeScript, Element Plus, Vue Router 4, Vitest, Scoped CSS (Light/Dark 主题自适应)。

**Spec:** 《AgentPay「30% 核心研发 + 70% 平台运营与宣传」战略执行规划纲要》与方案 A 设计。

---

## Global Constraints

- **Zero Auth Barrier**: `/playground` 必须支持未登录直接访问（`requiresAuth: false`），不能被路由守卫重定向到 `/login`。
- **No Raw Tailwind**: `apps/console` 不支持 Tailwind JIT，必须使用 Element Plus 组件配合 Scoped CSS，杜绝排版错乱。
- **Authentic Contacts Only**: 底部转化引导卡片中的联系方式必须严格使用真实信息：
  - 公众号：杰哥AI运营
  - 助理微信：jie125846
  - 技术邮箱：julywhj@163.com
- **Currency Compliance**: 严格使用人民币（¥ / CNY），使用 6 位微元整数精度逻辑，杜绝任何 Web3/代币概念。

---

## Review Focus

1. **未登录游客访问 `/playground`**：无论有无 Token，均直接渲染沙箱，不触发登录重定向。
2. **多预设场景切换**：切换“小额正常调用”、“50元触发402”、“5000元恶意熔断”时，参数面板、网关状态机和移动端卡片瞬时同步重置。
3. **人在回路（HITL）解挂流转**：触发 402 挂起后，中间时序动态呼吸等待；在右侧手机模拟器点击【批准放行】后，状态机必须在 300ms 内流转为【审批通过并平账】，中间报文切换为 200 OK 与最终 Token/扣款账单。
4. **驳回处理**：在手机模拟器点击【驳回请求】后，状态机流转为【审批拒绝 (403 Approval Rejected)】，记录风控事件。
5. **主题适配与响应式**：在浅色与暗色模式下，三栏高拟真卡片和终端代码字体（Monaco / JetBrains Mono）色彩对比度清晰。

---

## File Structure

```text
apps/console/
├── src/
│   ├── views/
│   │   ├── playground/
│   │   │   ├── index.vue                # 三栏沉浸式沙箱主视图
│   │   │   ├── components/
│   │   │   │   ├── ScenarioControls.vue # 左栏：预设场景选择与自定义参数表单
│   │   │   │   ├── PipelineTerminal.vue # 中栏：网关时序动画与 HTTP 报文终端
│   │   │   │   ├── FeishuCardSimulator.vue # 右栏：高拟真飞书/企微移动端卡片
│   │   │   │   └── ConversionFooter.vue # 底栏：公众号/技术群/GitHub引流面板
│   │   │   └── state/
│   │   │       └── playgroundEngine.ts  # 纯前端高保真状态机与模拟数据引擎
│   ├── router/
│   │   └── index.ts                     # 配置免鉴权路由与侧边栏菜单
│   ├── views/login/
│   │   └── index.vue                    # 登录页增加“免登录体验沙箱”按钮
│   └── i18n/locales/
│       ├── zh-CN.ts                     # 中文文案补充
│       └── en-US.ts                     # 英文文案补充
└── tests/
    └── playground.spec.ts               # 沙箱状态机与场景流转单元测试
```

---

## Task Decomposition

### Task 1: 沙箱核心状态机引擎与单元测试 (TDD)

**Files:**
- Create: `apps/console/src/views/playground/state/playgroundEngine.ts`
- Create: `apps/console/tests/playground.spec.ts`

- [ ] **Step 1: 编写状态机测试用例**
- [ ] **Step 2: 运行测试验证失败 (RED)**
- [ ] **Step 3: 实现 `playgroundEngine.ts` 状态机与场景逻辑**
- [ ] **Step 4: 运行测试验证全部通过 (GREEN)**

---

### Task 2: 拆分实现三栏核心组件

**Files:**
- Create: `apps/console/src/views/playground/components/ScenarioControls.vue`
- Create: `apps/console/src/views/playground/components/PipelineTerminal.vue`
- Create: `apps/console/src/views/playground/components/FeishuCardSimulator.vue`
- Create: `apps/console/src/views/playground/components/ConversionFooter.vue`

- [ ] **Step 1: 实现 `ScenarioControls.vue`（左侧控制栏）**：支持快速预设一键填入，滑块/输入框微调。
- [ ] **Step 2: 实现 `PipelineTerminal.vue`（中间时序链路与代码报文）**：动态脉冲动画，JSON 语法高亮，一键复制 cURL / 响应体。
- [ ] **Step 3: 实现 `FeishuCardSimulator.vue`（右侧高拟真移动端卡片）**：iOS 状态栏、飞书审批机器人头像、审批通过/驳回实时交互按钮。
- [ ] **Step 4: 实现 `ConversionFooter.vue`（底部获客闭环）**：微信公众号「杰哥AI运营」、助理微信「jie125846」、Gitee 仓库链接与 Star 引导。

---

### Task 3: 组装沙箱页面并配置免鉴权路由与导航入口

**Files:**
- Create: `apps/console/src/views/playground/index.vue`
- Modify: `apps/console/src/router/index.ts`
- Modify: `apps/console/src/views/login/index.vue`
- Modify: `apps/console/src/i18n/locales/zh-CN.ts` & `en-US.ts`

- [ ] **Step 1: 在 `apps/console/src/views/playground/index.vue` 中组合三栏与顶底布局**
- [ ] **Step 2: 更新 `router/index.ts`**：注入 `/playground` 路由，设置 `requiresAuth: false`，并在内层 Layout 中加入菜单。
- [ ] **Step 3: 在 `views/login/index.vue` 增加沙箱快捷入口**
- [ ] **Step 4: 补充中英文 i18n 词条**

---

### Task 4: 端到端测试与构建打包验证

- [ ] **Step 1: 运行 Vitest 单元测试集验证**
- [ ] **Step 2: 执行 `npm run build` 确保 TypeScript 0 错误、生产构建 100% 成功**
- [ ] **Step 3: 提交代码并推送至 Git 仓库**

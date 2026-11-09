<script setup lang="ts">
import { computed } from 'vue';
import type { AutonomousState, PlaygroundScenario } from '../state/playgroundEngine';

const props = defineProps<{
  autonomous: AutonomousState;
  scenario: PlaygroundScenario;
  executionStatus: 'idle' | 'running' | 'success' | 'warning' | 'error';
}>();

const statusTagType = computed(() => {
  switch (props.autonomous.status) {
    case 'passed':
      return 'success';
    case 'blocked_and_recovered':
      return 'warning';
    case 'circuit_broken':
      return 'danger';
    default:
      return 'info';
  }
});

const statusLabel = computed(() => {
  switch (props.autonomous.status) {
    case 'passed':
      return '正常履约中 · 账本已平';
    case 'blocked_and_recovered':
      return '自主策略自救 · 零人工介入';
    case 'circuit_broken':
      return '物理熔断 · 阻断失控';
    default:
      return '智能体就绪 · 等待触发';
  }
});

const ledgerBadge = computed(() => {
  switch (props.autonomous.ledger.action) {
    case 'HOLD_AND_CAPTURE':
      return { text: '两阶段原子核销 (Hold → Capture)', type: 'success' };
    case 'HOLD_AND_RELEASE':
      return { text: '瞬间解冻释放 (Hold → Release 零损失)', type: 'warning' };
    case 'CIRCUIT_REJECT':
      return { text: '前置物理阻断 (未入账本)', type: 'danger' };
    default:
      return { text: '账本静止', type: 'info' };
  }
});
</script>

<template>
  <div class="autonomous-monitor-card">
    <!-- Header -->
    <div class="card-header">
      <div class="header-left">
        <el-icon class="header-icon"><Cpu /></el-icon>
        <span class="header-title">智能体自治闭环与账本监视器</span>
      </div>
      <el-tag :type="statusTagType" size="small" effect="dark" class="status-badge">
        {{ statusLabel }}
      </el-tag>
    </div>

    <div class="card-subtitle">
      面向无人值守（Unattended）智能体：告别半夜等待人类审批，实现「事前预算管控 + 物理阻断 + 智能体自主自救 + 资金零损失解冻」
    </div>

    <!-- Monitor Content -->
    <div class="monitor-body">
      <!-- 1. LLM Autonomous Decision -->
      <div class="section-box decision-box">
        <div class="section-title">
          <el-icon class="mr-1 text-primary"><Compass /></el-icon>
          <span>智能体自治决策流 (Autonomous Decision Loop)</span>
        </div>
        <div v-if="autonomous.llmObservation" class="decision-content">
          <div class="decision-bubble" :class="'bubble-' + autonomous.status">
            <div class="bubble-header">
              <span class="agent-tag">{{ scenario.agentName }}</span>
              <span class="mode-tag">无人值守自治模式</span>
            </div>
            <p class="decision-text">{{ autonomous.llmObservation.agentDecision }}</p>
          </div>
        </div>
        <div v-else class="empty-placeholder">
          <span>点击左侧【发起沙箱模拟请求】查看智能体自主运行与风控决策</span>
        </div>
      </div>

      <!-- 2. Observation Payload (What the Agent Sees) -->
      <div class="section-box observation-box">
        <div class="section-title">
          <el-icon class="mr-1 text-warning"><View /></el-icon>
          <span>大模型 Observation 视角 (MCP Tool Response)</span>
        </div>
        <div v-if="autonomous.llmObservation" class="code-wrapper">
          <pre class="json-pre"><code>{{ autonomous.llmObservation.rawText }}</code></pre>
        </div>
        <div v-else class="empty-placeholder">
          <span>等待网关返回 Observation 结构化提示...</span>
        </div>
      </div>

      <!-- 3. Real-time Two-Phase Ledger Monitor -->
      <div class="section-box ledger-box">
        <div class="section-title">
          <div class="flex items-center">
            <el-icon class="mr-1 text-success"><Coin /></el-icon>
            <span>两阶段资金账本实时变动 (Two-Phase Settlement)</span>
          </div>
          <el-tag :type="ledgerBadge.type as any" size="small" effect="light">
            {{ ledgerBadge.text }}
          </el-tag>
        </div>

        <div class="ledger-grid">
          <div class="metric-item">
            <div class="metric-label">部门当前余额</div>
            <div class="metric-val text-primary">¥{{ autonomous.ledger.balanceAfter.toFixed(2) }}</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">预占中额度 (Hold)</div>
            <div class="metric-val text-warning">¥{{ autonomous.ledger.heldAmount.toFixed(2) }}</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">实扣金额 (Capture)</div>
            <div class="metric-val text-danger">¥{{ autonomous.ledger.capturedAmount.toFixed(2) }}</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">瞬时解冻释放 (Release)</div>
            <div class="metric-val text-success font-bold">¥{{ autonomous.ledger.releasedAmount.toFixed(2) }}</div>
          </div>
        </div>

        <div v-if="autonomous.ledger.releasedAmount > 0" class="zero-loss-alert">
          <el-icon class="mr-1 text-success"><CircleCheckFilled /></el-icon>
          <span>零资金损失保障：超额阻断时，预扣的 ¥{{ autonomous.ledger.releasedAmount.toFixed(2) }} 已瞬间解冻归还原账户，绝无资金挂账。</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.autonomous-monitor-card {
  background: var(--el-bg-color-overlay, #ffffff);
  border: 1px solid var(--el-border-color-light, #e2e8f0);
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--el-border-color-lighter, #f1f5f9);
  padding-bottom: 10px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  font-size: 18px;
  color: #0284c7;
}

.header-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--el-text-color-primary, #0f172a);
}

.card-subtitle {
  font-size: 11px;
  color: var(--el-text-color-secondary, #64748b);
  line-height: 1.5;
  background: var(--el-fill-color-light, #f8fafc);
  padding: 8px 10px;
  border-radius: 8px;
}

.monitor-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.section-box {
  background: var(--el-fill-color-blank, #ffffff);
  border: 1px solid var(--el-border-color-lighter, #f1f5f9);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-regular, #334155);
}

.decision-bubble {
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.6;
}

.bubble-passed {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
}

.bubble-blocked_and_recovered {
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
}

.bubble-circuit_broken {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
}

.bubble-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.agent-tag {
  font-weight: 700;
  font-size: 11px;
}

.mode-tag {
  font-size: 10px;
  opacity: 0.8;
}

.decision-text {
  margin: 0;
}

.code-wrapper {
  background: #090e1a;
  border-radius: 8px;
  padding: 8px 10px;
  overflow-x: auto;
}

.json-pre {
  margin: 0;
  font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
  font-size: 11px;
  line-height: 1.5;
  color: #38bdf8;
  white-space: pre-wrap;
  word-break: break-all;
}

.ledger-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.metric-item {
  background: var(--el-fill-color-light, #f8fafc);
  padding: 8px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.metric-label {
  font-size: 10px;
  color: var(--el-text-color-secondary, #64748b);
}

.metric-val {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 13px;
  font-weight: 700;
}

.zero-loss-alert {
  display: flex;
  align-items: center;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #065f46;
  font-size: 11px;
  padding: 6px 10px;
  border-radius: 6px;
  line-height: 1.4;
}

.empty-placeholder {
  font-size: 11px;
  color: var(--el-text-color-placeholder, #94a3b8);
  font-style: italic;
  padding: 10px 0;
  text-align: center;
}
</style>

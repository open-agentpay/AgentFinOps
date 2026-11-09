<script setup lang="ts">
import { ref } from 'vue';
import type { ApprovalState, PlaygroundScenario } from '../state/playgroundEngine';

defineProps<{
  approval: ApprovalState;
  scenario: PlaygroundScenario;
  executionStatus: 'idle' | 'running' | 'suspended' | 'success' | 'error';
}>();

const emit = defineEmits<{
  (e: 'approve'): void;
  (e: 'reject'): void;
}>();

const appPlatform = ref<'feishu' | 'wecom'>('feishu');
</script>

<template>
  <el-card class="feishu-card-simulator" shadow="never">
    <template #header>
      <div class="header-flex">
        <div class="header-title">
          <el-icon class="mr-1 text-primary"><Cellphone /></el-icon>
          <span>移动端协同审批模拟器</span>
        </div>
        <div class="platform-switch">
          <button
            :class="['platform-btn', { active: appPlatform === 'feishu' }]"
            @click="appPlatform = 'feishu'"
          >
            飞书
          </button>
          <button
            :class="['platform-btn', { active: appPlatform === 'wecom' }]"
            @click="appPlatform = 'wecom'"
          >
            企业微信
          </button>
        </div>
      </div>
    </template>

    <!-- Smartphone Bezel Shell -->
    <div class="phone-shell">
      <!-- Phone Speaker / Camera Notch -->
      <div class="phone-top-notch">
        <div class="camera-lens"></div>
        <div class="speaker-grill"></div>
      </div>

      <!-- Phone Status Bar -->
      <div class="phone-status-bar">
        <span class="phone-time">12:08</span>
        <div class="phone-icons">
          <span class="icon-signal">5G</span>
          <span class="icon-battery">98%</span>
        </div>
      </div>

      <!-- App Header Bar -->
      <div :class="['app-bar', appPlatform]">
        <div class="app-avatar">
          <img src="/logo.png" alt="Bot Logo" class="bot-img" />
        </div>
        <div class="app-bot-meta">
          <span class="bot-name">
            {{ appPlatform === 'feishu' ? 'AgentPay 飞书风控审批助手' : 'AgentPay 企微资金防火墙' }}
          </span>
          <span class="bot-tag">企业官方应用</span>
        </div>
      </div>

      <!-- Chat Screen Body -->
      <div class="chat-viewport">
        <!-- Timestamp in chat -->
        <div class="chat-time-tag">今天 12:08</div>

        <!-- Case 1: Pending Approval Card -->
        <div v-if="approval.status === 'pending'" class="approval-card-msg">
          <div class="msg-card-header">
            <div class="card-icon-wrap warning">
              <el-icon><Bell /></el-icon>
            </div>
            <div class="card-title-text">
              <span class="card-h">【资金预警】智能体大额调用审批</span>
              <span class="card-sub">单笔支出触发人在回路 (HITL) 阈值</span>
            </div>
          </div>

          <div class="card-data-fields">
            <div class="data-row">
              <span class="field-label">申请智能体:</span>
              <span class="field-val highlight">{{ scenario.agentName }}</span>
            </div>
            <div class="data-row">
              <span class="field-label">归属成本中心:</span>
              <span class="field-val">{{ scenario.departmentName }}</span>
            </div>
            <div class="data-row">
              <span class="field-label">申请消耗金额:</span>
              <span class="field-val amount-red">¥ {{ scenario.amount.toFixed(2) }}</span>
            </div>
            <div class="data-row">
              <span class="field-label">风控拦截规则:</span>
              <span class="field-val">单笔支出超出自主上限 (¥{{ scenario.hitlThreshold.toFixed(2) }})</span>
            </div>
            <div class="data-row">
              <span class="field-label">审批单号:</span>
              <span class="field-val mono">{{ approval.approvalId }}</span>
            </div>
            <div class="data-row">
              <span class="field-label">目标 Prompt:</span>
              <span class="field-val prompt-preview">"{{ scenario.prompt.slice(0, 36) }}..."</span>
            </div>
          </div>

          <!-- Card Actions (Direct click in simulator) -->
          <div class="card-btn-actions">
            <button class="mobile-btn approve-btn" @click="emit('approve')">
              ✅ 批准放行
            </button>
            <button class="mobile-btn reject-btn" @click="emit('reject')">
              ❌ 驳回请求
            </button>
          </div>
          <div class="card-hint">
            💡 点击上方按钮，中间网关链路将实时解除 402 挂起！
          </div>
        </div>

        <!-- Case 2: Approved Stamp Card -->
        <div v-else-if="approval.status === 'approved'" class="approval-card-msg approved-stamped">
          <div class="stamped-badge approved">已批准放行</div>
          <div class="msg-card-header">
            <div class="card-icon-wrap success">
              <el-icon><Check /></el-icon>
            </div>
            <div class="card-title-text">
              <span class="card-h">智能体调用已放行</span>
              <span class="card-sub">审批人：{{ approval.approver || '技术主管 (Zhang)' }}</span>
            </div>
          </div>
          <div class="card-data-fields">
            <div class="data-row">
              <span class="field-label">放行金额:</span>
              <span class="field-val">¥ {{ scenario.amount.toFixed(2) }}</span>
            </div>
            <div class="data-row">
              <span class="field-label">平账状态:</span>
              <span class="field-val text-success">已原子扣减并核销</span>
            </div>
          </div>
        </div>

        <!-- Case 3: Rejected Stamp Card -->
        <div v-else-if="approval.status === 'rejected'" class="approval-card-msg rejected-stamped">
          <div class="stamped-badge rejected">已驳回</div>
          <div class="msg-card-header">
            <div class="card-icon-wrap danger">
              <el-icon><Close /></el-icon>
            </div>
            <div class="card-title-text">
              <span class="card-h">调用请求已被阻断</span>
              <span class="card-sub">原因：{{ approval.rejectReason || '超出预期预算' }}</span>
            </div>
          </div>
          <div class="card-data-fields">
            <div class="data-row">
              <span class="field-label">阻断金额:</span>
              <span class="field-val">¥ {{ scenario.amount.toFixed(2) }}</span>
            </div>
            <div class="data-row">
              <span class="field-label">配额保护:</span>
              <span class="field-val text-success">已释放预扣，资金无损</span>
            </div>
          </div>
        </div>

        <!-- Case 4: Idle / Normal No Pending -->
        <div v-else class="idle-chat-state">
          <div class="idle-avatar-circle">
            <el-icon><CircleCheck /></el-icon>
          </div>
          <div class="idle-text-title">智能体资金巡检正常</div>
          <div class="idle-text-desc">
            当前无待办审批。当智能体单笔调用超出 HITL 阈值时，飞书/企微审批卡片将实时推送到此。
          </div>
        </div>
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.feishu-card-simulator {
  border-radius: 12px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
}

.header-flex {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  font-weight: 600;
  font-size: 15px;
  display: flex;
  align-items: center;
}

.platform-switch {
  display: flex;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  padding: 2px;
}

.platform-btn {
  border: none;
  background: transparent;
  padding: 2px 8px;
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--el-text-color-secondary);
}

.platform-btn.active {
  background: var(--el-fill-color-blank);
  color: var(--el-color-primary);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.phone-shell {
  width: 100%;
  max-width: 320px;
  margin: 0 auto;
  background: #f1f5f9;
  border-radius: 28px;
  border: 6px solid #1e293b;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

.phone-top-notch {
  height: 14px;
  background: #1e293b;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

.camera-lens {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #090e17;
}

.speaker-grill {
  width: 32px;
  height: 3px;
  border-radius: 2px;
  background: #334155;
}

.phone-status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 14px;
  font-size: 10px;
  font-weight: 600;
  color: #334155;
}

.app-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
}

.app-bar.feishu {
  border-top: 2px solid #3370ff;
}

.app-bar.wecom {
  border-top: 2px solid #2ba245;
}

.app-avatar {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: #4f46e5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bot-img {
  width: 20px;
  height: 20px;
}

.app-bot-meta {
  display: flex;
  flex-direction: column;
}

.bot-name {
  font-size: 12px;
  font-weight: 600;
  color: #0f172a;
}

.bot-tag {
  font-size: 9px;
  color: #64748b;
}

.chat-viewport {
  padding: 12px;
  min-height: 320px;
  max-height: 380px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.chat-time-tag {
  align-self: center;
  background: #e2e8f0;
  color: #64748b;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  margin-bottom: 12px;
}

.approval-card-msg {
  background: #ffffff;
  border-radius: 10px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
  position: relative;
}

.msg-card-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 10px;
}

.card-icon-wrap {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-icon-wrap.warning { background: #fef3c7; color: #d97706; }
.card-icon-wrap.success { background: #d1fae5; color: #059669; }
.card-icon-wrap.danger { background: #fee2e2; color: #dc2626; }

.card-title-text {
  display: flex;
  flex-direction: column;
}

.card-h {
  font-size: 12px;
  font-weight: 700;
  color: #0f172a;
}

.card-sub {
  font-size: 10px;
  color: #64748b;
}

.card-data-fields {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 11px;
  margin-bottom: 12px;
  padding: 8px;
  background: #f8fafc;
  border-radius: 6px;
}

.data-row {
  display: flex;
  justify-content: space-between;
}

.field-label {
  color: #64748b;
}

.field-val {
  color: #1e293b;
  font-weight: 500;
  text-align: right;
  max-width: 170px;
  word-break: break-all;
}

.field-val.highlight {
  color: #4f46e5;
  font-weight: 600;
}

.field-val.amount-red {
  color: #ef4444;
  font-weight: 700;
  font-size: 12px;
}

.field-val.mono {
  font-family: monospace;
  font-size: 10px;
  color: #64748b;
}

.prompt-preview {
  font-style: italic;
  color: #475569;
}

.card-btn-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.mobile-btn {
  flex: 1;
  padding: 7px 0;
  border-radius: 6px;
  border: none;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.mobile-btn:hover {
  opacity: 0.9;
}

.approve-btn {
  background: #10b981;
  color: #ffffff;
}

.reject-btn {
  background: #ef4444;
  color: #ffffff;
}

.card-hint {
  font-size: 10px;
  color: #6366f1;
  text-align: center;
  margin-top: 8px;
  line-height: 1.3;
}

.stamped-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 11px;
  font-weight: 700;
  border-radius: 4px;
  padding: 2px 6px;
  border: 1.5px solid;
}

.stamped-badge.approved {
  color: #059669;
  border-color: #059669;
  background: #ecfdf5;
}

.stamped-badge.rejected {
  color: #dc2626;
  border-color: #dc2626;
  background: #fef2f2;
}

.idle-chat-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: auto 0;
  text-align: center;
  padding: 20px;
}

.idle-avatar-circle {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #ecfdf5;
  color: #10b981;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin-bottom: 12px;
}

.idle-text-title {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 6px;
}

.idle-text-desc {
  font-size: 11px;
  color: #64748b;
  line-height: 1.5;
}
</style>

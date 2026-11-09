<script setup lang="ts">
import { computed } from 'vue';
import {
  PRESET_SCENARIOS,
  type PlaygroundScenario
} from '../state/playgroundEngine';

const props = defineProps<{
  scenario: PlaygroundScenario;
  executionStatus: 'idle' | 'running' | 'suspended' | 'success' | 'error';
}>();

const emit = defineEmits<{
  (e: 'selectScenario', id: PlaygroundScenario['id']): void;
  (e: 'execute'): void;
  (e: 'reset'): void;
}>();

const isExecuting = computed(() => props.executionStatus === 'running');
const isSuspended = computed(() => props.executionStatus === 'suspended');

const modelOptions = [
  { label: 'Claude 3.5 Sonnet (Anthropic)', value: 'claude-3-5-sonnet' },
  { label: 'GPT-4o Mini (OpenAI)', value: 'gpt-4o-mini' },
  { label: 'DeepSeek-V3 / R1 (深度求索)', value: 'deepseek-chat' },
  { label: 'Qwen-Max (通义千问)', value: 'qwen-max' }
];
</script>

<template>
  <el-card class="scenario-controls-card" shadow="never">
    <template #header>
      <div class="card-header-flex">
        <div class="header-title">
          <el-icon class="mr-1 text-primary"><Setting /></el-icon>
          <span>预设场景与参数配置</span>
        </div>
        <el-button size="small" text @click="emit('reset')">重置</el-button>
      </div>
    </template>

    <!-- Preset Scenarios Selector -->
    <div class="preset-selector-box">
      <div class="section-label">⚡ 快速选择业务场景</div>
      <div class="preset-cards-list">
        <div
          v-for="item in PRESET_SCENARIOS"
          :key="item.id"
          :class="['preset-item-card', { active: scenario.id === item.id }]"
          @click="emit('selectScenario', item.id)"
        >
          <div class="preset-item-top">
            <span class="preset-item-title">{{ item.title }}</span>
            <el-tag size="small" :type="item.badgeType" effect="dark">
              {{ item.badge }}
            </el-tag>
          </div>
          <div class="preset-item-desc">{{ item.description }}</div>
        </div>
      </div>
    </div>

    <el-divider style="margin: 16px 0" />

    <!-- Form Controls -->
    <el-form label-position="top" size="default">
      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="发起调用 Agent">
            <el-input v-model="scenario.agentName" placeholder="例如：CS-Bot" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="归属部门/成本中心">
            <el-input v-model="scenario.departmentName" placeholder="例如：市场增长部" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="调用模型 (LLM)">
            <el-select v-model="scenario.model" style="width: 100%">
              <el-option
                v-for="opt in modelOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="部门月度预算硬顶 (¥)">
            <el-input-number
              v-model="scenario.departmentQuota"
              :min="100"
              :step="1000"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <!-- Key FinOps Thresholds -->
      <div class="threshold-box">
        <div class="threshold-header">
          <span class="threshold-title">🛡️ 资金防火墙策略阈值</span>
        </div>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="HITL 审批阈值 (¥)" style="margin-bottom: 6px">
              <el-input-number
                v-model="scenario.hitlThreshold"
                :min="1"
                :step="5"
                style="width: 100%"
              />
            </el-form-item>
            <div class="help-text">超过此金额触发 402 挂起与审批</div>
          </el-col>
          <el-col :span="12">
            <el-form-item label="单笔熔断硬顶 (¥)" style="margin-bottom: 6px">
              <el-input-number
                v-model="scenario.maxSingleTxCap"
                :min="50"
                :step="100"
                style="width: 100%"
              />
            </el-form-item>
            <div class="help-text">超过此金额直接拦截 (403)</div>
          </el-col>
        </el-row>
      </div>

      <!-- Request Amount Slider -->
      <el-form-item label="本次调用预估消费金额 (¥)" class="amount-slider-item">
        <div class="amount-display-row">
          <span class="amount-val">¥ {{ scenario.amount.toFixed(2) }}</span>
          <el-tag
            v-if="scenario.amount > scenario.maxSingleTxCap"
            type="danger"
            effect="dark"
          >
            突破单笔熔断线
          </el-tag>
          <el-tag
            v-else-if="scenario.amount > scenario.hitlThreshold"
            type="warning"
            effect="dark"
          >
            触发 402 挂起
          </el-tag>
          <el-tag v-else type="success" effect="plain">
            正常小额放行
          </el-tag>
        </div>
        <el-slider
          v-model="scenario.amount"
          :min="0.01"
          :max="scenario.maxSingleTxCap * 1.5"
          :step="0.05"
        />
      </el-form-item>

      <el-form-item label="模拟请求 Prompt">
        <el-input
          v-model="scenario.prompt"
          type="textarea"
          :rows="2"
          placeholder="智能体当前正在执行的目标 Prompt"
        />
      </el-form-item>

      <div class="action-btn-row">
        <el-button
          type="primary"
          size="large"
          class="submit-exec-btn"
          :loading="isExecuting"
          @click="emit('execute')"
        >
          <el-icon class="mr-1"><VideoPlay /></el-icon>
          <span>模拟 Agent 发送调用</span>
        </el-button>
      </div>

      <div v-if="isSuspended" class="suspended-tip">
        <el-alert
          type="warning"
          :closable="false"
          show-icon
          title="请求已被挂起 (HTTP 402)"
          description="请在右侧「移动协同卡片模拟器」中点击【批准放行】或【驳回】以完成闭环！"
        />
      </div>
    </el-form>
  </el-card>
</template>

<style scoped>
.scenario-controls-card {
  border-radius: 12px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
}

.card-header-flex {
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

.preset-selector-box {
  margin-bottom: 8px;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
}

.preset-cards-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preset-item-card {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-blank);
  cursor: pointer;
  transition: all 0.2s ease;
}

.preset-item-card:hover {
  border-color: var(--el-color-primary-light-5);
  transform: translateY(-1px);
}

.preset-item-card.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.preset-item-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.preset-item-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.preset-item-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}

.threshold-box {
  background: var(--el-fill-color-light);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 16px;
  border: 1px dashed var(--el-border-color);
}

.threshold-header {
  margin-bottom: 8px;
}

.threshold-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.help-text {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}

.amount-slider-item {
  margin-bottom: 16px;
}

.amount-display-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.amount-val {
  font-size: 18px;
  font-weight: 700;
  color: var(--el-color-primary);
}

.action-btn-row {
  margin-top: 12px;
}

.submit-exec-btn {
  width: 100%;
  font-weight: 600;
  font-size: 15px;
  height: 44px;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
}

.suspended-tip {
  margin-top: 12px;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.01); }
  100% { transform: scale(1); }
}
</style>

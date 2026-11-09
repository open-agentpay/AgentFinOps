<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import type { PipelineStep, SimulatedResponse, PlaygroundScenario } from '../state/playgroundEngine';

const props = defineProps<{
  steps: PipelineStep[];
  response: SimulatedResponse | null;
  scenario: PlaygroundScenario;
  executionStatus: 'idle' | 'running' | 'suspended' | 'success' | 'error';
}>();

const activeTab = ref<'response' | 'curl' | 'audit'>('response');

const statusCodeType = computed(() => {
  if (!props.response) return 'info';
  if (props.response.statusCode === 200) return 'success';
  if (props.response.statusCode === 402) return 'warning';
  return 'danger';
});

const formattedJson = computed(() => {
  if (!props.response?.body) return '// 等待模拟请求执行...';
  return JSON.stringify(props.response.body, null, 2);
});

const generatedCurl = computed(() => {
  return `curl -X POST https://gateway.agentpay.top/v1/chat/completions \\
  -H "Authorization: Bearer sk-agent-live-playground-key" \\
  -H "Content-Type: application/json" \\
  -H "X-AgentPay-Agent-Id: ${props.scenario.agentName}" \\
  -H "X-AgentPay-Estimated-Cost: ${props.scenario.amount.toFixed(2)}" \\
  -d '{
    "model": "${props.scenario.model}",
    "messages": [{"role": "user", "content": "${props.scenario.prompt.slice(0, 30)}..."}]
  }'`;
});

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  ElMessage.success('已复制到剪贴板');
}
</script>

<template>
  <el-card class="pipeline-terminal-card" shadow="never">
    <template #header>
      <div class="terminal-header-flex">
        <div class="header-title">
          <el-icon class="mr-1 text-primary"><Monitor /></el-icon>
          <span>网关时序链路与报文终端</span>
        </div>
        <div v-if="response" class="status-pill">
          <el-tag :type="statusCodeType" effect="dark" size="small">
            HTTP {{ response.statusCode }} {{ response.statusText }}
          </el-tag>
          <span class="duration-text">{{ response.durationMs }}ms</span>
        </div>
      </div>
    </template>

    <!-- Visual Pipeline Progress Steps -->
    <div class="pipeline-flow-container">
      <div
        v-for="st in steps"
        :key="st.step"
        :class="['pipeline-step-item', `status-${st.status}`]"
      >
        <div class="step-indicator">
          <el-icon v-if="st.status === 'success'"><Check /></el-icon>
          <el-icon v-else-if="st.status === 'warning'"><Clock /></el-icon>
          <el-icon v-else-if="st.status === 'error'"><Close /></el-icon>
          <el-icon v-else-if="st.status === 'running'" class="is-loading"><Loading /></el-icon>
          <span v-else class="step-num">{{ st.step }}</span>
        </div>
        <div class="step-content">
          <div class="step-name-row">
            <span class="step-name">{{ st.name }}</span>
            <span v-if="st.timeMs" class="step-timing">{{ st.timeMs }}ms</span>
          </div>
          <div class="step-detail">{{ st.detail }}</div>
        </div>
      </div>
    </div>

    <!-- Terminal Inspector -->
    <div class="terminal-viewer-wrap">
      <div class="terminal-bar">
        <div class="window-dots">
          <span class="dot red"></span>
          <span class="dot yellow"></span>
          <span class="dot green"></span>
        </div>
        <div class="tab-buttons">
          <button
            :class="['terminal-tab-btn', { active: activeTab === 'response' }]"
            @click="activeTab = 'response'"
          >
            HTTP 响应报文
          </button>
          <button
            :class="['terminal-tab-btn', { active: activeTab === 'curl' }]"
            @click="activeTab = 'curl'"
          >
            cURL 命令
          </button>
          <button
            :class="['terminal-tab-btn', { active: activeTab === 'audit' }]"
            @click="activeTab = 'audit'"
          >
            全链路审计日志
          </button>
        </div>
        <div class="copy-action">
          <el-button
            size="small"
            text
            style="color: #94a3b8"
            @click="copyToClipboard(activeTab === 'curl' ? generatedCurl : formattedJson)"
          >
            <el-icon class="mr-1"><CopyDocument /></el-icon> 复制
          </el-button>
        </div>
      </div>

      <!-- Tab 1: Response Body -->
      <div v-if="activeTab === 'response'" class="code-editor-area">
        <div v-if="response?.headers" class="headers-strip">
          <div
            v-for="(v, k) in response.headers"
            :key="k"
            class="header-pair"
          >
            <span class="header-k">{{ k }}:</span>
            <span class="header-v">{{ v }}</span>
          </div>
        </div>
        <pre class="json-code"><code>{{ formattedJson }}</code></pre>
      </div>

      <!-- Tab 2: cURL -->
      <div v-else-if="activeTab === 'curl'" class="code-editor-area">
        <pre class="curl-code"><code>{{ generatedCurl }}</code></pre>
      </div>

      <!-- Tab 3: Audit Trace -->
      <div v-else class="code-editor-area audit-area">
        <div class="audit-log-line">
          <span class="log-time">[12:08:24.112]</span>
          <span class="log-tag tag-info">INGRESS</span>
          <span class="log-body">Agent [{{ scenario.agentName }}] request received from client SDK</span>
        </div>
        <div class="audit-log-line">
          <span class="log-time">[12:08:24.130]</span>
          <span class="log-tag tag-success">QUOTA</span>
          <span class="log-body">Dept [{{ scenario.departmentName }}] cascade check passed (Cap: ¥{{ scenario.departmentQuota }})</span>
        </div>
        <div class="audit-log-line">
          <span class="log-time">[12:08:24.145]</span>
          <span :class="['log-tag', scenario.amount > scenario.maxSingleTxCap ? 'tag-danger' : (scenario.amount > scenario.hitlThreshold ? 'tag-warning' : 'tag-success')]">
            POLICY
          </span>
          <span class="log-body">Evaluated tx amount ¥{{ scenario.amount.toFixed(2) }} vs threshold ¥{{ scenario.hitlThreshold }}</span>
        </div>
        <div v-if="response?.statusCode === 402" class="audit-log-line">
          <span class="log-time">[12:08:24.170]</span>
          <span class="log-tag tag-warning">HITL_HOLD</span>
          <span class="log-body">Suspension triggered: Webhook dispatched to Feishu/WeCom approval robot</span>
        </div>
        <div v-if="response?.statusCode === 200" class="audit-log-line">
          <span class="log-time">[12:08:24.380]</span>
          <span class="log-tag tag-success">CAPTURE</span>
          <span class="log-body">Double-entry ledger settled: -¥{{ scenario.amount.toFixed(2) }} from Department Ledger</span>
        </div>
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.pipeline-terminal-card {
  border-radius: 12px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
}

.terminal-header-flex {
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

.status-pill {
  display: flex;
  align-items: center;
  gap: 8px;
}

.duration-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.pipeline-flow-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.pipeline-step-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.pipeline-step-item.status-running {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-5);
}

.pipeline-step-item.status-success {
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.pipeline-step-item.status-warning {
  background: #fffbeb;
  border-color: #fef08a;
}

.pipeline-step-item.status-error {
  background: #fef2f2;
  border-color: #fecaca;
}

.step-indicator {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  background: var(--el-fill-color-dark);
  color: #fff;
  flex-shrink: 0;
}

.status-running .step-indicator {
  background: var(--el-color-primary);
}

.status-success .step-indicator {
  background: #10b981;
}

.status-warning .step-indicator {
  background: #f59e0b;
}

.status-error .step-indicator {
  background: #ef4444;
}

.step-content {
  flex: 1;
}

.step-name-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.step-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.step-timing {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.step-detail {
  font-size: 12px;
  color: var(--el-text-color-regular);
  margin-top: 2px;
  line-height: 1.4;
}

.terminal-viewer-wrap {
  border-radius: 8px;
  overflow: hidden;
  background: #0f172a;
  border: 1px solid #1e293b;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.terminal-bar {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
}

.window-dots {
  display: flex;
  gap: 6px;
  margin-right: 16px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot.red { background: #ef4444; }
.dot.yellow { background: #f59e0b; }
.dot.green { background: #10b981; }

.tab-buttons {
  display: flex;
  gap: 6px;
  flex: 1;
}

.terminal-tab-btn {
  background: transparent;
  border: none;
  outline: none;
  color: #94a3b8;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.terminal-tab-btn.active {
  background: #334155;
  color: #f8fafc;
  font-weight: 600;
}

.code-editor-area {
  padding: 12px 14px;
  min-height: 200px;
  max-height: 260px;
  overflow-y: auto;
  font-family: 'JetBrains Mono', 'Fira Code', 'Monaco', monospace;
  font-size: 12px;
  color: #e2e8f0;
}

.headers-strip {
  border-bottom: 1px dashed #334155;
  padding-bottom: 8px;
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.header-pair {
  font-size: 11px;
}

.header-k {
  color: #818cf8;
  margin-right: 6px;
}

.header-v {
  color: #cbd5e1;
}

.json-code, .curl-code {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
  color: #38bdf8;
}

.audit-area {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.audit-log-line {
  line-height: 1.4;
  font-size: 11px;
}

.log-time {
  color: #64748b;
  margin-right: 6px;
}

.log-tag {
  display: inline-block;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  margin-right: 6px;
}

.tag-info { background: #0369a1; color: #fff; }
.tag-success { background: #047857; color: #fff; }
.tag-warning { background: #b45309; color: #fff; }
.tag-danger { background: #b91c1c; color: #fff; }

.log-body {
  color: #cbd5e1;
}
</style>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { createPlaygroundEngine } from './state/playgroundEngine';
import ScenarioControls from './components/ScenarioControls.vue';
import PipelineTerminal from './components/PipelineTerminal.vue';
import AutonomousMonitor from './components/AutonomousMonitor.vue';
import ConversionFooter from './components/ConversionFooter.vue';

const router = useRouter();
const authStore = useAuthStore();
const engine = createPlaygroundEngine();

const statusTagType = computed(() => {
  switch (engine.executionStatus.value) {
    case 'running':
      return 'primary';
    case 'warning':
      return 'warning';
    case 'success':
      return 'success';
    case 'error':
      return 'danger';
    default:
      return 'info';
  }
});

const statusTagLabel = computed(() => {
  switch (engine.executionStatus.value) {
    case 'running':
      return '正在进行网关预检...';
    case 'warning':
      return 'HTTP 402 已阻断 (智能体自救降级)';
    case 'success':
      return '执行成功 (两阶段已平账)';
    case 'error':
      return '已阻断 / 熔断切断';
    default:
      return '沙箱就绪 (待发起)';
  }
});

function goHome() {
  if (authStore.isAuthenticated) {
    router.push('/dashboard');
  } else {
    router.push('/login');
  }
}
</script>

<template>
  <div class="playground-page-container">
    <!-- Top Nav Banner -->
    <div class="playground-top-header">
      <div class="header-left">
        <div class="logo-circle">
          <img src="/logo.png" alt="AgentPay Logo" class="brand-logo" />
        </div>
        <div class="header-titles">
          <div class="title-row">
            <span class="main-title">AgentPay 资金防火墙 · 免配置体验沙箱</span>
            <el-tag :type="statusTagType" effect="dark" size="small" class="status-tag">
              {{ statusTagLabel }}
            </el-tag>
          </div>
          <div class="sub-title">
            无需注册 / 免填 Key / 零费用：10 秒亲身体验「智能体超限 → 财务防火墙物理拦截 → 大模型自主降级自救 → 两阶段账本零损失解冻」
          </div>
        </div>
      </div>
      <div class="header-right">
        <el-button plain size="small" @click="goHome">
          <el-icon class="mr-1"><HomeFilled /></el-icon>
          <span>{{ authStore.isAuthenticated ? '进入完整控制台' : '管理控制台登录' }}</span>
        </el-button>
      </div>
    </div>

    <!-- Three-Column Layout -->
    <div class="playground-three-columns">
      <!-- Col 1: Left Scenario Controls -->
      <div class="col-panel col-left">
        <ScenarioControls
          :scenario="engine.currentScenario"
          :execution-status="engine.executionStatus.value"
          @select-scenario="engine.loadScenario"
          @execute="engine.executeSimulatedRequest"
          @reset="engine.resetState"
        />
      </div>

      <!-- Col 2: Middle Pipeline Terminal & Wire Inspector -->
      <div class="col-panel col-middle">
        <PipelineTerminal
          :steps="engine.pipelineSteps.value"
          :response="engine.simulatedResponse.value"
          :scenario="engine.currentScenario"
          :execution-status="engine.executionStatus.value"
        />
      </div>

      <!-- Col 3: Right Autonomous LLM Observation & Ledger Monitor -->
      <div class="col-panel col-right">
        <AutonomousMonitor
          :autonomous="engine.autonomousState.value"
          :scenario="engine.currentScenario"
          :execution-status="engine.executionStatus.value"
        />
      </div>
    </div>

    <!-- Bottom Conversion & Channel Funnel -->
    <ConversionFooter />
  </div>
</template>

<style scoped>
.playground-page-container {
  padding: 16px 20px;
  background: var(--el-bg-color-page, #f8fafc);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.playground-top-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 18px;
  background: var(--el-bg-color);
  border-radius: 12px;
  border: 1px solid var(--el-border-color-lighter);
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-circle {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: #4f46e5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-logo {
  width: 24px;
  height: 24px;
}

.header-titles {
  display: flex;
  flex-direction: column;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.main-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.status-tag {
  font-weight: 600;
}

.sub-title {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}

.playground-three-columns {
  display: grid;
  grid-template-columns: 1.15fr 1.35fr 1.1fr;
  gap: 16px;
  align-items: start;
}

@media (max-width: 1200px) {
  .playground-three-columns {
    grid-template-columns: 1fr;
  }
}

.col-panel {
  display: flex;
  flex-direction: column;
}
</style>

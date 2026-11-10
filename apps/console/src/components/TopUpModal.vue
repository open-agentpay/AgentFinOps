<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { t } from '@/i18n';
import { walletApi } from '@/api/client';
import type { TopUpOrder } from '@/types/wallet';

const props = defineProps<{
  modelValue: boolean;
  tenantId: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'success', order: TopUpOrder): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

// Amount options
const presetAmounts = [10, 50, 100, 500];
const selectedPreset = ref<number>(50);
const customAmount = ref<number | null>(null);
const selectedChannel = ref<'wechat_pay' | 'mock'>('wechat_pay');

const actualAmountYuan = computed(() => {
  if (customAmount.value !== null && customAmount.value > 0) {
    return customAmount.value;
  }
  return selectedPreset.value;
});

const actualAmountCents = computed(() => {
  return Math.round(actualAmountYuan.value * 100);
});

// Cashier State
const step = ref<'select' | 'pay' | 'success'>('select');
const creatingOrder = ref(false);
const activeOrder = ref<TopUpOrder | null>(null);
const codeUrl = ref('');
const countdown = ref(900); // 15 mins in seconds
const isSimulating = ref(false);

let pollTimer: any = null;
let countdownTimer: any = null;

function selectPreset(val: number) {
  selectedPreset.value = val;
  customAmount.value = null;
}

function onCustomInput(val: number | null) {
  if (val && val > 0) {
    selectedPreset.value = 0;
  }
}

async function handleCreateOrder() {
  if (actualAmountCents.value <= 0) {
    ElMessage.warning(t('充值金额必须大于 0'));
    return;
  }

  creatingOrder.value = true;
  try {
    const res = await walletApi.createTopUpOrder(props.tenantId, {
      amount_cents: actualAmountCents.value,
      channel: selectedChannel.value
    });

    activeOrder.value = res.topup_order;
    codeUrl.value = res.code_url;
    step.value = 'pay';
    countdown.value = 900;

    startPolling();
    startCountdown();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : t('创建充值订单失败');
    ElMessage.error(msg);
  } finally {
    creatingOrder.value = false;
  }
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(async () => {
    if (!activeOrder.value || !props.tenantId) return;
    try {
      const order = await walletApi.getTopUpOrderStatus(props.tenantId, activeOrder.value.topup_id);
      if (order.status === 'confirmed') {
        stopPolling();
        stopCountdown();
        activeOrder.value = order;
        step.value = 'success';
        ElMessage.success(t('充值到账成功！可用额度已实时刷新。'));
        emit('success', order);
        setTimeout(() => {
          visible.value = false;
        }, 2000);
      } else if (order.status === 'failed' || order.status === 'expired') {
        stopPolling();
        stopCountdown();
        ElMessage.error(t('订单已失效或支付失败'));
      }
    } catch {
      // transient poll error, continue polling
    }
  }, 2000);
}

function startCountdown() {
  stopCountdown();
  countdownTimer = setInterval(() => {
    if (countdown.value > 0) {
      countdown.value--;
    } else {
      stopCountdown();
      stopPolling();
    }
  }, 1000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

async function handleSimulatePay() {
  if (!activeOrder.value) return;
  isSimulating.value = true;
  try {
    const res = await walletApi.simulateMockPayment(activeOrder.value.topup_id);
    if (res.success) {
      stopPolling();
      stopCountdown();
      activeOrder.value = res.order;
      step.value = 'success';
      ElMessage.success(t('沙箱模拟支付成功！额度已到账。'));
      emit('success', res.order);
      setTimeout(() => {
        visible.value = false;
      }, 1500);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : t('模拟支付失败');
    ElMessage.error(msg);
  } finally {
    isSimulating.value = false;
  }
}

function formatCountdown(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function reset() {
  stopPolling();
  stopCountdown();
  step.value = 'select';
  activeOrder.value = null;
  codeUrl.value = '';
}

watch(visible, (val) => {
  if (!val) {
    reset();
  }
});

onUnmounted(() => {
  stopPolling();
  stopCountdown();
});
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="$t('⚡ 组织账户在线充值')"
    width="540px"
    destroy-on-close
    :close-on-click-modal="false"
  >
    <!-- Step 1: Select Amount -->
    <div v-if="step === 'select'" class="topup-container">
      <div class="section-title">{{ $t('请选择充值金额') }}</div>
      
      <div class="preset-grid">
        <div
          v-for="amt in presetAmounts"
          :key="amt"
          class="preset-card"
          :class="{ active: selectedPreset === amt && customAmount === null }"
          @click="selectPreset(amt)"
        >
          <div class="preset-cny">¥{{ amt }}.00</div>
          <div class="preset-points">{{ (amt * 100).toLocaleString() }} {{ $t('分') }}</div>
        </div>
      </div>

      <div class="custom-amount-row">
        <span class="custom-label">{{ $t('其他金额:') }}</span>
        <el-input-number
          v-model="customAmount"
          :min="1"
          :max="50000"
          :precision="2"
          :step="10"
          :placeholder="$t('自定义金额 (元)')"
          style="width: 200px"
          @change="onCustomInput"
        />
        <span class="unit-text">CNY (元)</span>
      </div>

      <div class="section-title" style="margin-top: 24px;">{{ $t('支付渠道') }}</div>
      <div class="channel-grid">
        <div
          class="channel-card"
          :class="{ active: selectedChannel === 'wechat_pay' }"
          @click="selectedChannel = 'wechat_pay'"
        >
          <span class="channel-icon">🟢</span>
          <div>
            <div class="channel-name">{{ $t('微信支付') }} (WeChat Pay)</div>
            <div class="channel-desc">{{ $t('微信扫码极速到账，个人/企业微信均可扫码') }}</div>
          </div>
        </div>

        <div
          class="channel-card"
          :class="{ active: selectedChannel === 'mock' }"
          @click="selectedChannel = 'mock'"
        >
          <span class="channel-icon">🧪</span>
          <div>
            <div class="channel-name">{{ $t('沙箱模拟通道 (Dev Sandbox)') }}</div>
            <div class="channel-desc">{{ $t('无需真实付款，开发测试环境下提供一键模拟到账') }}</div>
          </div>
        </div>
      </div>

      <div class="amount-summary-bar">
        <span>{{ $t('应付金额:') }}</span>
        <strong class="summary-amount">¥{{ actualAmountYuan.toFixed(2) }}</strong>
        <span class="summary-sub">({{ actualAmountCents.toLocaleString() }} {{ $t('分整型入账') }})</span>
      </div>

      <div class="footer-actions">
        <el-button @click="visible = false">{{ $t('取消') }}</el-button>
        <el-button
          type="primary"
          :loading="creatingOrder"
          @click="handleCreateOrder"
        >
          {{ $t('确认并生成支付二维码') }}
        </el-button>
      </div>
    </div>

    <!-- Step 2: Pay QR View -->
    <div v-else-if="step === 'pay'" class="cashier-container">
      <div class="cashier-header">
        <div class="cashier-amount">¥{{ actualAmountYuan.toFixed(2) }}</div>
        <div class="cashier-order-id">
          {{ $t('订单号:') }} <code>{{ activeOrder?.topup_id }}</code>
        </div>
      </div>

      <div class="qr-box">
        <!-- Render QR using public SVG service or direct image -->
        <img
          :src="`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(codeUrl)}`"
          class="qr-image"
          alt="Payment QR"
        />
        <div class="qr-tip">
          <span>{{ selectedChannel === 'wechat_pay' ? $t('请使用微信扫一扫完成支付') : $t('沙箱测试二维码') }}</span>
        </div>
        <div class="countdown-badge">
          ⏱️ {{ $t('二维码有效时间:') }} <strong>{{ formatCountdown(countdown) }}</strong>
        </div>
      </div>

      <div v-if="selectedChannel === 'mock'" class="mock-debug-box">
        <div class="mock-title">🛠️ {{ $t('沙箱快捷调试面板 (Dev Only)') }}</div>
        <div class="mock-desc">{{ $t('当前处于沙箱模式，点击下方按钮可直接向网关发送确认报文：') }}</div>
        <el-button
          type="success"
          size="small"
          :loading="isSimulating"
          @click="handleSimulatePay"
        >
          ⚡ {{ $t('模拟手机扫码支付成功') }}
        </el-button>
      </div>

      <div class="cashier-footer">
        <el-button @click="reset">{{ $t('返回重新选择') }}</el-button>
      </div>
    </div>

    <!-- Step 3: Success View -->
    <div v-else-if="step === 'success'" class="success-container">
      <el-result
        icon="success"
        :title="$t('充值成功！')"
        :sub-title="`${$t('已为当前租户成功入账')} ¥${actualAmountYuan.toFixed(2)} (${actualAmountCents.toLocaleString()} 分)`"
      />
    </div>
  </el-dialog>
</template>

<style scoped>
.topup-container, .cashier-container, .success-container {
  padding: 8px 4px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.preset-card {
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  padding: 14px 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #fafafa;
}

.preset-card:hover {
  border-color: #409eff;
  background: #f0f7ff;
}

.preset-card.active {
  border-color: #409eff;
  background: #ecf5ff;
  box-shadow: 0 0 0 1px #409eff;
}

.preset-cny {
  font-size: 16px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 4px;
}

.preset-points {
  font-size: 12px;
  color: #909399;
}

.custom-amount-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.custom-label {
  font-size: 13px;
  color: #606266;
}

.unit-text {
  font-size: 13px;
  color: #909399;
}

.channel-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 24px;
}

.channel-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.channel-card:hover {
  border-color: #409eff;
  background: #fafafa;
}

.channel-card.active {
  border-color: #409eff;
  background: #ecf5ff;
  box-shadow: 0 0 0 1px #409eff;
}

.channel-icon {
  font-size: 24px;
}

.channel-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 2px;
}

.channel-desc {
  font-size: 12px;
  color: #909399;
}

.amount-summary-bar {
  display: flex;
  align-items: baseline;
  gap: 8px;
  background: #f8fafc;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  margin-bottom: 24px;
  font-size: 14px;
  color: #475569;
}

.summary-amount {
  font-size: 22px;
  color: #0f172a;
}

.summary-sub {
  font-size: 12px;
  color: #64748b;
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* Cashier */
.cashier-header {
  text-align: center;
  margin-bottom: 20px;
}

.cashier-amount {
  font-size: 32px;
  font-weight: bold;
  color: #16a34a;
  margin-bottom: 4px;
}

.cashier-order-id {
  font-size: 12px;
  color: #909399;
}

.qr-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
}

.qr-image {
  width: 200px;
  height: 200px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px;
  background: #fff;
  margin-bottom: 12px;
}

.qr-tip {
  font-size: 14px;
  font-weight: 500;
  color: #334155;
  margin-bottom: 8px;
}

.countdown-badge {
  font-size: 12px;
  color: #64748b;
  background: #f1f5f9;
  padding: 4px 10px;
  border-radius: 20px;
}

.mock-debug-box {
  background: #fefce8;
  border: 1px dashed #eab308;
  border-radius: 8px;
  padding: 12px 16px;
  text-align: center;
  margin-bottom: 20px;
}

.mock-title {
  font-size: 13px;
  font-weight: 600;
  color: #854d0e;
  margin-bottom: 4px;
}

.mock-desc {
  font-size: 12px;
  color: #a16207;
  margin-bottom: 10px;
}

.cashier-footer {
  display: flex;
  justify-content: center;
}
</style>

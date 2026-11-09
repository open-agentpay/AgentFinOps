<script setup lang="ts">
import { ElMessage } from 'element-plus';

function copyWechat() {
  navigator.clipboard.writeText('jie125846');
  ElMessage.success('已复制助理微信 jie125846，添加请备注「智能体防火墙」！');
}

function openUrl(url: string) {
  window.open(url, '_blank');
}
</script>

<template>
  <el-card class="conversion-footer-card" shadow="never">
    <div class="footer-grid">
      <!-- Col 1: Branding & Community -->
      <div class="col-brand">
        <div class="brand-row">
          <img src="/logo.png" alt="AgentPay" class="brand-logo" />
          <span class="brand-title">AgentPay 开源社区</span>
          <el-tag size="small" type="success" effect="plain">企业级资金防火墙</el-tag>
        </div>
        <p class="brand-desc">
          专为国内企业落地 AI 智能体打造的 HTTP 402 行为审计与资金防火墙网关。
          告别 Prompt 死循环刷爆账单，让每一个自主 Agent 安全可控！
        </p>
      </div>

      <!-- Col 2: Channels & Authentic Contacts -->
      <div class="col-contacts">
        <div class="contact-item">
          <span class="contact-label">📢 微信公众号:</span>
          <span class="contact-val">杰哥AI运营</span>
        </div>
        <div class="contact-item">
          <span class="contact-label">💬 技术交流群:</span>
          <span class="contact-val">添加助理 <strong>jie125846</strong> 备注「智能体防火墙」</span>
          <el-button size="small" type="primary" link @click="copyWechat">复制微信号</el-button>
        </div>
        <div class="contact-item">
          <span class="contact-label">✉️ 架构交流邮箱:</span>
          <span class="contact-val">julywhj@163.com</span>
        </div>
      </div>

      <!-- Col 3: Repos & Fast CTA -->
      <div class="col-actions">
        <el-button
          type="danger"
          plain
          class="repo-btn"
          @click="openUrl('https://gitee.com/julywhj/AgentFinOps')"
        >
          <el-icon class="mr-1"><Star /></el-icon>
          <span>Gitee 仓库 (求 Star ⭐)</span>
        </el-button>
        <el-button
          type="info"
          plain
          class="repo-btn"
          @click="openUrl('https://github.com/open-agentpay/AgentFinOps')"
        >
          <el-icon class="mr-1"><Share /></el-icon>
          <span>GitHub 开源主页</span>
        </el-button>
        <el-button
          type="primary"
          class="repo-btn"
          @click="copyWechat"
        >
          <el-icon class="mr-1"><ChatDotRound /></el-icon>
          <span>加入架构师私域群</span>
        </el-button>
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.conversion-footer-card {
  border-radius: 12px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
  margin-top: 16px;
}

.footer-grid {
  display: grid;
  grid-template-columns: 1.2fr 1.3fr 1fr;
  gap: 24px;
  align-items: center;
}

@media (max-width: 992px) {
  .footer-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}

.brand-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.brand-logo {
  width: 24px;
  height: 24px;
}

.brand-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.brand-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
  margin: 0;
}

.col-contacts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 12px;
  border-left: 1px dashed var(--el-border-color);
  border-right: 1px dashed var(--el-border-color);
}

@media (max-width: 992px) {
  .col-contacts {
    border: none;
    padding: 0;
  }
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.contact-label {
  color: var(--el-text-color-secondary);
}

.contact-val {
  color: var(--el-text-color-primary);
}

.col-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.repo-btn {
  width: 100%;
  font-weight: 600;
  justify-content: center;
}
</style>

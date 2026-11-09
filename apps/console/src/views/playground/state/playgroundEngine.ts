import { ref, reactive } from 'vue';

export interface PlaygroundScenario {
  id: 'normal_small' | 'hitl_suspension' | 'circuit_break';
  title: string;
  badge: string;
  badgeType: 'success' | 'warning' | 'danger';
  description: string;
  agentName: string;
  departmentName: string;
  amount: number;
  departmentQuota: number;
  hitlThreshold: number;
  maxSingleTxCap: number;
  model: string;
  prompt: string;
}

export interface PipelineStep {
  step: number;
  name: string;
  status: 'idle' | 'running' | 'success' | 'warning' | 'error';
  detail: string;
  timeMs?: number;
}

export interface SimulatedResponse {
  statusCode: number;
  statusText: string;
  durationMs: number;
  headers: Record<string, string>;
  body: Record<string, any>;
}

export interface ApprovalState {
  status: 'none' | 'pending' | 'approved' | 'rejected';
  approvalId?: string;
  requestedAt?: string;
  decidedAt?: string;
  approver?: string;
  rejectReason?: string;
}

export const PRESET_SCENARIOS: PlaygroundScenario[] = [
  {
    id: 'normal_small',
    title: '场景 1：小额日常智能体推理',
    badge: '极速放行 200 OK',
    badgeType: 'success',
    description: '单笔金额 0.05 元，远低于 HITL 阈值（10元）。网关毫秒级预检放行，原子扣减账本。',
    agentName: '客服问答智能体 (CS-Bot)',
    departmentName: '客户支持中心 (Customer Care)',
    amount: 0.05,
    departmentQuota: 5000.0,
    hitlThreshold: 10.0,
    maxSingleTxCap: 500.0,
    model: 'gpt-4o-mini',
    prompt: '你好，请帮我查询订单 #2026110901 的实时物流配送状态。'
  },
  {
    id: 'hitl_suspension',
    title: '场景 2：Prompt 循环/高额调用触发风控',
    badge: '人在回路 HTTP 402',
    badgeType: 'warning',
    description: '单笔金额 50.00 元，超过 HITL 阈值（10元）。网关自动挂起请求，推送移动端审批卡片等待放行。',
    agentName: '数据分析自主智能体 (Data-Analyst)',
    departmentName: '市场增长部 (Growth Team)',
    amount: 50.0,
    departmentQuota: 10000.0,
    hitlThreshold: 10.0,
    maxSingleTxCap: 500.0,
    model: 'claude-3-5-sonnet',
    prompt: '执行全网竞品价格深度清洗与 100 个维度因子多轮自适应建模（预估消耗 120,000 Tokens）。'
  },
  {
    id: 'circuit_break',
    title: '场景 3：恶意失控/越权刷爆单笔硬顶',
    badge: '熔断拦截 403 Forbidden',
    badgeType: 'danger',
    description: '单笔金额 5000.00 元，突破单笔交易硬顶（500元）。网关直接拒绝，记录恶意告警并阻断链路。',
    agentName: '爬虫聚合智能体 (Web-Crawler-Agent)',
    departmentName: '技术平台研发部 (Tech Infra)',
    amount: 5000.0,
    departmentQuota: 20000.0,
    hitlThreshold: 10.0,
    maxSingleTxCap: 500.0,
    model: 'gpt-4-turbo',
    prompt: '并发抓取全量行业数据库并进行多模态超大规模向量化批处理。'
  }
];

export function createPlaygroundEngine() {
  const currentScenario = reactive<PlaygroundScenario>({ ...PRESET_SCENARIOS[1] });
  const executionStatus = ref<'idle' | 'running' | 'suspended' | 'success' | 'error'>('idle');
  const approvalState = ref<ApprovalState>({ status: 'none' });
  const simulatedResponse = ref<SimulatedResponse | null>(null);

  const initialSteps: PipelineStep[] = [
    { step: 1, name: '网关入口与身份验签 (Ingress & Auth)', status: 'idle', detail: '等待请求接入...' },
    { step: 2, name: '企业级联配额校验 (Cascade Quota Check)', status: 'idle', detail: '部门可用预算与硬顶预检' },
    { step: 3, name: '风控策略与人在回路判定 (Policy Engine)', status: 'idle', detail: '对比 HITL 阈值与单笔上限' },
    { step: 4, name: '资金防火墙动作执行 (Firewall Action)', status: 'idle', detail: 'HTTP 200 放行 / 402 挂起 / 403 熔断' },
    { step: 5, name: '上游模型调用与原子账本核销 (Settlement)', status: 'idle', detail: 'Token 计费与 Hold/Capture 状态机' }
  ];

  const pipelineSteps = ref<PipelineStep[]>(JSON.parse(JSON.stringify(initialSteps)));

  function resetState() {
    executionStatus.value = 'idle';
    approvalState.value = { status: 'none' };
    simulatedResponse.value = null;
    pipelineSteps.value = JSON.parse(JSON.stringify(initialSteps));
  }

  function loadScenario(id: PlaygroundScenario['id']) {
    const found = PRESET_SCENARIOS.find((s) => s.id === id);
    if (found) {
      Object.assign(currentScenario, found);
      resetState();
    }
  }

  async function executeSimulatedRequest() {
    resetState();
    executionStatus.value = 'running';

    // Step 1: Ingress
    pipelineSteps.value[0].status = 'running';
    pipelineSteps.value[0].detail = `校验 Agent: [${currentScenario.agentName}] API Key 有效性...`;
    pipelineSteps.value[0].timeMs = 12;
    pipelineSteps.value[0].status = 'success';

    // Step 2: Quota Check
    pipelineSteps.value[1].status = 'running';
    pipelineSteps.value[1].detail = `所属部门 [${currentScenario.departmentName}] 剩余可用额度 ¥${currentScenario.departmentQuota.toFixed(2)}`;
    pipelineSteps.value[1].timeMs = 18;
    pipelineSteps.value[1].status = 'success';

    // Step 3: Policy Engine
    pipelineSteps.value[2].status = 'running';
    pipelineSteps.value[2].timeMs = 15;

    // Check circuit break
    if (currentScenario.amount > currentScenario.maxSingleTxCap) {
      pipelineSteps.value[2].status = 'error';
      pipelineSteps.value[2].detail = `请求金额 ¥${currentScenario.amount.toFixed(2)} 突破单笔上限 ¥${currentScenario.maxSingleTxCap.toFixed(2)}，触发防火墙熔断！`;

      pipelineSteps.value[3].status = 'error';
      pipelineSteps.value[3].detail = 'HTTP 403 Forbidden: SINGLE_TX_CAP_EXCEEDED';
      pipelineSteps.value[3].timeMs = 2;

      pipelineSteps.value[4].status = 'idle';
      pipelineSteps.value[4].detail = '已阻断，未转发上游模型';

      executionStatus.value = 'error';
      simulatedResponse.value = {
        statusCode: 403,
        statusText: 'Forbidden',
        durationMs: 47,
        headers: {
          'content-type': 'application/json',
          'x-agentpay-action': 'CIRCUIT_BREAK',
          'x-agentpay-risk-level': 'CRITICAL'
        },
        body: {
          error: 'SINGLE_TX_CAP_EXCEEDED',
          message: `Request amount ¥${currentScenario.amount.toFixed(2)} exceeds single transaction cap ¥${currentScenario.maxSingleTxCap.toFixed(2)}`,
          agent_id: 'agent_crawler_9082',
          risk_action: 'REJECT_AND_ALERT',
          timestamp: new Date().toISOString()
        }
      };
      return;
    }

    // Check HITL threshold
    if (currentScenario.amount > currentScenario.hitlThreshold) {
      pipelineSteps.value[2].status = 'warning';
      pipelineSteps.value[2].detail = `请求金额 ¥${currentScenario.amount.toFixed(2)} 超过风控阈值 ¥${currentScenario.hitlThreshold.toFixed(2)}，触发人在回路 (HITL) 审批`;

      const approvalId = `appr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      approvalState.value = {
        status: 'pending',
        approvalId,
        requestedAt: new Date().toLocaleTimeString('zh-CN', { hour12: false })
      };

      pipelineSteps.value[3].status = 'warning';
      pipelineSteps.value[3].detail = `生成审批单 ${approvalId}，推送飞书/企微审批卡片，返回 402 挂起`;
      pipelineSteps.value[3].timeMs = 25;

      pipelineSteps.value[4].status = 'running';
      pipelineSteps.value[4].detail = '等待审批人放行... (客户端退避轮询中)';

      executionStatus.value = 'suspended';
      simulatedResponse.value = {
        statusCode: 402,
        statusText: 'Payment Required',
        durationMs: 70,
        headers: {
          'content-type': 'application/json',
          'x-agentpay-status': 'APPROVAL_REQUIRED',
          'x-agentpay-approval-id': approvalId,
          'retry-after': '5'
        },
        body: {
          error: 'APPROVAL_REQUIRED',
          approval_id: approvalId,
          amount_cny: currentScenario.amount,
          agent_name: currentScenario.agentName,
          reason: 'High transaction value exceeds autonomous threshold',
          message: 'Request held by AgentPay financial firewall. Awaiting human approval via Feishu / WeCom.',
          poll_url: `/v1/approvals/${approvalId}/status`
        }
      };
      return;
    }

    // Small amount normal pass
    pipelineSteps.value[2].status = 'success';
    pipelineSteps.value[2].detail = `请求金额 ¥${currentScenario.amount.toFixed(2)} 低于阈值 ¥${currentScenario.hitlThreshold.toFixed(2)}，策略放行`;

    pipelineSteps.value[3].status = 'success';
    pipelineSteps.value[3].detail = 'HTTP 200 OK: 预扣额度 (Hold)';
    pipelineSteps.value[3].timeMs = 10;

    pipelineSteps.value[4].status = 'success';
    pipelineSteps.value[4].detail = `模型 [${currentScenario.model}] 推理完成，消耗 320 Tokens，实扣 ¥${currentScenario.amount.toFixed(2)} (Capture)`;
    pipelineSteps.value[4].timeMs = 180;

    executionStatus.value = 'success';
    simulatedResponse.value = {
      statusCode: 200,
      statusText: 'OK',
      durationMs: 235,
      headers: {
        'content-type': 'application/json',
        'x-agentpay-hold-id': 'hold_90823412',
        'x-agentpay-cost-cny': currentScenario.amount.toFixed(2)
      },
      body: {
        code: 'SUCCESS',
        model: currentScenario.model,
        tokens_used: 320,
        cost_cny: currentScenario.amount,
        settlement_status: 'CAPTURED',
        reply: '订单 #2026110901 正在由顺丰速运派送中，快递员已出发，预计今日 15:30 前送达。'
      }
    };
  }

  async function approveSuspendedRequest(approverName = '技术主管 (Zhang)') {
    if (approvalState.value.status !== 'pending') return;

    approvalState.value.status = 'approved';
    approvalState.value.approver = approverName;
    approvalState.value.decidedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false });

    // Update steps
    pipelineSteps.value[3].status = 'success';
    pipelineSteps.value[3].detail = `审批单 ${approvalState.value.approvalId} 已获 [${approverName}] 批准放行！一次性凭证已核销。`;

    pipelineSteps.value[4].status = 'success';
    pipelineSteps.value[4].detail = `上游模型 [${currentScenario.model}] 推理完成，核销配额并记入账本 (Capture ¥${currentScenario.amount.toFixed(2)})`;
    pipelineSteps.value[4].timeMs = 210;

    executionStatus.value = 'success';
    simulatedResponse.value = {
      statusCode: 200,
      statusText: 'OK (Resumed after HITL Approval)',
      durationMs: 285,
      headers: {
        'content-type': 'application/json',
        'x-agentpay-approval-id': approvalState.value.approvalId || '',
        'x-agentpay-approver': approverName,
        'x-agentpay-cost-cny': currentScenario.amount.toFixed(2)
      },
      body: {
        code: 'SUCCESS',
        approval_id: approvalState.value.approvalId,
        approved_by: approverName,
        model: currentScenario.model,
        settlement_status: 'CAPTURED',
        tokens_used: 12450,
        actual_deduction_cny: currentScenario.amount,
        reply: '竞品多维清洗建模完成：已输出 100 个因子特征及最新价格敏感度矩阵分析报告。'
      }
    };
  }

  async function rejectSuspendedRequest(reason = '单次批量调用超出当周实验预算，请优化 Prompt') {
    if (approvalState.value.status !== 'pending') return;

    approvalState.value.status = 'rejected';
    approvalState.value.rejectReason = reason;
    approvalState.value.decidedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false });

    pipelineSteps.value[3].status = 'error';
    pipelineSteps.value[3].detail = `审批单 ${approvalState.value.approvalId} 已被驳回。原因：${reason}`;

    pipelineSteps.value[4].status = 'idle';
    pipelineSteps.value[4].detail = '已释放预扣额度 (Release Hold)，未调用上游模型';

    executionStatus.value = 'error';
    simulatedResponse.value = {
      statusCode: 403,
      statusText: 'Forbidden (Approval Rejected)',
      durationMs: 60,
      headers: {
        'content-type': 'application/json',
        'x-agentpay-approval-status': 'REJECTED'
      },
      body: {
        error: 'APPROVAL_REJECTED',
        approval_id: approvalState.value.approvalId,
        reason,
        message: 'The request was explicitly rejected by the human approver in Feishu / WeCom.'
      }
    };
  }

  return {
    currentScenario,
    executionStatus,
    approvalState,
    pipelineSteps,
    simulatedResponse,
    loadScenario,
    resetState,
    executeSimulatedRequest,
    approveSuspendedRequest,
    rejectSuspendedRequest
  };
}

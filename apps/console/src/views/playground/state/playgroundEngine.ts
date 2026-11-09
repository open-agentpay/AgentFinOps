import { ref, reactive } from 'vue';

export interface PlaygroundScenario {
  id: 'normal_small' | 'budget_cap_block' | 'circuit_break';
  title: string;
  badge: string;
  badgeType: 'success' | 'warning' | 'danger';
  description: string;
  agentName: string;
  departmentName: string;
  amount: number;
  departmentQuota: number;
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

export interface AutonomousState {
  status: 'idle' | 'passed' | 'blocked_and_recovered' | 'circuit_broken';
  llmObservation?: {
    isError: boolean;
    errorCode?: string;
    rawText: string;
    agentDecision: string;
  };
  ledger: {
    action: 'NONE' | 'HOLD_AND_CAPTURE' | 'HOLD_AND_RELEASE' | 'CIRCUIT_REJECT';
    heldAmount: number;
    capturedAmount: number;
    releasedAmount: number;
    balanceBefore: number;
    balanceAfter: number;
  };
}

export const PRESET_SCENARIOS: PlaygroundScenario[] = [
  {
    id: 'normal_small',
    title: '场景 1：小额日常智能体推理',
    badge: '极速放行 200 OK',
    badgeType: 'success',
    description: '单笔金额 0.05 元，配额充沛。网关毫秒级预检放行，执行两阶段 Hold → Capture 原子扣减账本。',
    agentName: '客服问答智能体 (CS-Bot)',
    departmentName: '客户支持中心 (Customer Care)',
    amount: 0.05,
    departmentQuota: 5000.0,
    maxSingleTxCap: 50.0,
    model: 'gpt-4o-mini',
    prompt: '你好，请帮我查询订单 #2026110901 的实时物流配送状态。'
  },
  {
    id: 'budget_cap_block',
    title: '场景 2：单笔超限物理阻断与大模型自救',
    badge: '超限阻断 402 Payment Required',
    badgeType: 'warning',
    description: '单笔预估 50.00 元，超过单笔上限（10.00元）。网关毫秒级物理阻断并瞬间解冻（Hold → Release，零资金损失），返回友好错误引导大模型自主降级，无需人工干预。',
    agentName: '数据分析自主智能体 (Data-Analyst)',
    departmentName: '市场增长部 (Growth Team)',
    amount: 50.0,
    departmentQuota: 10000.0,
    maxSingleTxCap: 10.0,
    model: 'claude-3-5-sonnet',
    prompt: '执行全网竞品价格深度清洗与 100 个维度因子多轮自适应建模（预估消耗 120,000 Tokens）。'
  },
  {
    id: 'circuit_break',
    title: '场景 3：恶意失控/高频死循环秒级熔断',
    badge: '熔断拦截 403 Forbidden',
    badgeType: 'danger',
    description: '单笔金额 5000.00 元或高频递归刷量突破硬顶。网关 3 秒内秒级熔断物理切断链路，杜绝账单刷爆。',
    agentName: '爬虫聚合智能体 (Web-Crawler-Agent)',
    departmentName: '技术平台研发部 (Tech Infra)',
    amount: 5000.0,
    departmentQuota: 20000.0,
    maxSingleTxCap: 500.0,
    model: 'gpt-4-turbo',
    prompt: '并发抓取全量行业数据库并进行多模态超大规模向量化批处理。'
  }
];

export function createPlaygroundEngine() {
  const currentScenario = reactive<PlaygroundScenario>({ ...PRESET_SCENARIOS[1] });
  const executionStatus = ref<'idle' | 'running' | 'success' | 'warning' | 'error'>('idle');
  const simulatedResponse = ref<SimulatedResponse | null>(null);

  const autonomousState = ref<AutonomousState>({
    status: 'idle',
    ledger: {
      action: 'NONE',
      heldAmount: 0,
      capturedAmount: 0,
      releasedAmount: 0,
      balanceBefore: currentScenario.departmentQuota,
      balanceAfter: currentScenario.departmentQuota
    }
  });

  const initialSteps: PipelineStep[] = [
    { step: 1, name: '网关入口与身份验签 (Ingress & Auth)', status: 'idle', detail: '等待请求接入...' },
    { step: 2, name: '企业级联配额校验 (Cascade Quota Check)', status: 'idle', detail: '部门可用预算与硬顶预检' },
    { step: 3, name: '风控策略与单笔预算判定 (Policy Engine)', status: 'idle', detail: '对比单笔预算上限与频率限制' },
    { step: 4, name: '资金防火墙动作执行 (Firewall Action)', status: 'idle', detail: 'HTTP 200 放行 / 402 超限阻断 / 403 熔断' },
    { step: 5, name: '两阶段原子结算与大模型自救 (Settlement & Self-Recovery)', status: 'idle', detail: 'Hold/Capture/Release 状态机与大模型自救' }
  ];

  const pipelineSteps = ref<PipelineStep[]>(JSON.parse(JSON.stringify(initialSteps)));

  function resetState() {
    executionStatus.value = 'idle';
    simulatedResponse.value = null;
    autonomousState.value = {
      status: 'idle',
      ledger: {
        action: 'NONE',
        heldAmount: 0,
        capturedAmount: 0,
        releasedAmount: 0,
        balanceBefore: currentScenario.departmentQuota,
        balanceAfter: currentScenario.departmentQuota
      }
    };
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

    // Check circuit break (Scenario 3: 极端超额 5000 元)
    if (currentScenario.amount > 1000.0) {
      pipelineSteps.value[2].status = 'error';
      pipelineSteps.value[2].detail = `请求金额 ¥${currentScenario.amount.toFixed(2)} 突破极值单笔上限 ¥${currentScenario.maxSingleTxCap.toFixed(2)}，触发防火墙秒级熔断！`;

      pipelineSteps.value[3].status = 'error';
      pipelineSteps.value[3].detail = 'HTTP 403 Forbidden: SINGLE_TX_CAP_EXCEEDED (链路物理掐断)';
      pipelineSteps.value[3].timeMs = 2;

      pipelineSteps.value[4].status = 'idle';
      pipelineSteps.value[4].detail = '已物理阻断，未调用上游外部模型，账本无资金消耗';

      executionStatus.value = 'error';
      autonomousState.value = {
        status: 'circuit_broken',
        llmObservation: {
          isError: true,
          errorCode: 'SINGLE_TX_CAP_EXCEEDED',
          rawText: `{"isError": true, "content": [{"type": "text", "text": "【AgentFinOps 财务防火墙拦截】当前单笔费用 ¥${currentScenario.amount.toFixed(2)} 突破上限 ¥${currentScenario.maxSingleTxCap.toFixed(2)}，请求已被网关物理熔断阻断。"}]}`,
          agentDecision: '【智能体感知】检测到单笔超额硬阻断，根据 FinOps 安全规范立刻停止当前批处理，避免死循环重试，将错误原因记入审计日志并休眠。'
        },
        ledger: {
          action: 'CIRCUIT_REJECT',
          heldAmount: 0,
          capturedAmount: 0,
          releasedAmount: 0,
          balanceBefore: currentScenario.departmentQuota,
          balanceAfter: currentScenario.departmentQuota
        }
      };

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

    // Check Single Tx Cap (Scenario 2: 单笔超限 50.00 > 10.00，物理阻断 + 瞬间解冻 + 大模型自救)
    if (currentScenario.amount > currentScenario.maxSingleTxCap) {
      pipelineSteps.value[2].status = 'warning';
      pipelineSteps.value[2].detail = `请求金额 ¥${currentScenario.amount.toFixed(2)} 超出单笔限额 ¥${currentScenario.maxSingleTxCap.toFixed(2)}，触发物理拦截`;

      pipelineSteps.value[3].status = 'warning';
      pipelineSteps.value[3].detail = 'HTTP 402 Payment Required: SINGLE_TX_CAP_EXCEEDED，瞬间解冻释放预扣';
      pipelineSteps.value[3].timeMs = 15;

      pipelineSteps.value[4].status = 'success';
      pipelineSteps.value[4].detail = `【两阶段无损平账】Hold ¥${currentScenario.amount.toFixed(2)} → 瞬间 Release 解冻（零损失）；大模型收到友好引导自动降级至轻量缓存`;
      pipelineSteps.value[4].timeMs = 85;

      executionStatus.value = 'warning';
      autonomousState.value = {
        status: 'blocked_and_recovered',
        llmObservation: {
          isError: true,
          errorCode: 'SINGLE_TX_CAP_EXCEEDED',
          rawText: `{"isError": true, "content": [{"type": "text", "text": "【AgentFinOps 财务防火墙拦截】当前单笔费用 ¥${currentScenario.amount.toFixed(2)} 超出项目限额 ¥${currentScenario.maxSingleTxCap.toFixed(2)}。建议切换低成本模型或本地缓存。"}]}`,
          agentDecision: '【智能体自主决策】收到预算限制信号，主动放弃昂贵的高精度多轮模型，自动切换至「本地历史缓存 + 轻量分析小模型」完成竞品分析，无需半夜唤醒人类！'
        },
        ledger: {
          action: 'HOLD_AND_RELEASE',
          heldAmount: currentScenario.amount,
          capturedAmount: 0,
          releasedAmount: currentScenario.amount,
          balanceBefore: currentScenario.departmentQuota,
          balanceAfter: currentScenario.departmentQuota
        }
      };

      simulatedResponse.value = {
        statusCode: 402,
        statusText: 'Payment Required',
        durationMs: 65,
        headers: {
          'content-type': 'application/json',
          'x-agentpay-status': 'POLICY_DENIED',
          'x-agentpay-error-code': 'SINGLE_TX_CAP_EXCEEDED',
          'x-agentpay-release-hold': 'COMPLETED'
        },
        body: {
          error: 'SINGLE_TX_CAP_EXCEEDED',
          amount_cny: currentScenario.amount,
          max_single_tx_cap: currentScenario.maxSingleTxCap,
          agent_name: currentScenario.agentName,
          reason: 'Single call cost exceeds project cap',
          message: 'Request denied by AgentFinOps financial firewall. Held quota instantly released with zero loss. Structured guide provided to agent for autonomous fallback.',
          autonomous_guidance: 'SWITCH_TO_LOWER_COST_MODEL_OR_CACHE'
        }
      };
      return;
    }

    // Scenario 1: Small amount normal pass (Hold -> Capture)
    pipelineSteps.value[2].status = 'success';
    pipelineSteps.value[2].detail = `请求金额 ¥${currentScenario.amount.toFixed(2)} 低于单笔限额 ¥${currentScenario.maxSingleTxCap.toFixed(2)}，策略放行`;

    pipelineSteps.value[3].status = 'success';
    pipelineSteps.value[3].detail = 'HTTP 200 OK: 预扣额度 (Hold ¥0.05)';
    pipelineSteps.value[3].timeMs = 10;

    pipelineSteps.value[4].status = 'success';
    pipelineSteps.value[4].detail = `模型 [${currentScenario.model}] 推理完成，消耗 320 Tokens，实扣 ¥${currentScenario.amount.toFixed(2)} (Capture)`;
    pipelineSteps.value[4].timeMs = 180;

    executionStatus.value = 'success';
    autonomousState.value = {
      status: 'passed',
      llmObservation: {
        isError: false,
        rawText: '{"code": "SUCCESS", "tokens_used": 320, "reply": "订单 #2026110901 正在由顺丰速运派送中，快递员已出发，预计今日 15:30 前送达。"}',
        agentDecision: '【智能体正常履约】调用成功，接收到上游真实数据，向终端用户输出准确结果。'
      },
      ledger: {
        action: 'HOLD_AND_CAPTURE',
        heldAmount: currentScenario.amount,
        capturedAmount: currentScenario.amount,
        releasedAmount: 0,
        balanceBefore: currentScenario.departmentQuota,
        balanceAfter: currentScenario.departmentQuota - currentScenario.amount
      }
    };

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

  return {
    currentScenario,
    executionStatus,
    autonomousState,
    pipelineSteps,
    simulatedResponse,
    loadScenario,
    resetState,
    executeSimulatedRequest,
  };
}

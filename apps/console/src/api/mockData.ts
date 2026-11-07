import type { Tenant, Project } from '@/types/tenant';
import type { UserProfile } from '@/types/auth';

export const MOCK_TENANTS: Tenant[] = [
  {
    tenant_id: 'ten_9a8b7c6d5e',
    name: 'Acme Autonomous AI Corp',
    currency: 'CNY',
    status: 'active',
    created_at: '2026-10-01T08:00:00Z'
  },
  {
    tenant_id: 'ten_3f4e5d6c7b',
    name: 'DevLab Testing Org',
    currency: 'USD',
    status: 'active',
    created_at: '2026-10-10T12:00:00Z'
  }
];

export const MOCK_PROJECTS: Project[] = [
  {
    project_id: 'prj_1a2b3c4d5e',
    tenant_id: 'ten_9a8b7c6d5e',
    name: 'LLM Agent Swarm Production',
    budget_cap_base_units: 5000000000, // 5000 算力点数 (Credits)
    status: 'active',
    created_at: '2026-10-02T10:00:00Z'
  },
  {
    project_id: 'prj_8e7d6c5b4a',
    tenant_id: 'ten_9a8b7c6d5e',
    name: 'Market Data Aggregator',
    budget_cap_base_units: 1000000000, // 1000 算力点数 (Credits)
    status: 'active',
    created_at: '2026-10-05T14:30:00Z'
  },
  {
    project_id: 'prj_dev_sandbox_01',
    tenant_id: 'ten_3f4e5d6c7b',
    name: 'Devnet Sandbox Environment',
    budget_cap_base_units: 100000000, // 100 算力点数 (Credits)
    status: 'active',
    created_at: '2026-10-10T12:30:00Z'
  }
];

export const MOCK_USERS: Record<string, UserProfile> = {
  owner: {
    member_id: 'usr_8f7e6d5c4b',
    email: 'owner@agentpay.io',
    name: 'Alice (Owner)',
    role: 'owner',
    status: 'active',
    tenant_id: 'ten_9a8b7c6d5e'
  },
  admin: {
    member_id: 'usr_1a2b3c4d5e',
    email: 'admin@agentpay.io',
    name: 'Bob (Admin)',
    role: 'admin',
    status: 'active',
    tenant_id: 'ten_9a8b7c6d5e'
  },
  operator: {
    member_id: 'usr_6f5e4d3c2b',
    email: 'operator@agentpay.io',
    name: 'Charlie (Operator)',
    role: 'operator',
    status: 'active',
    tenant_id: 'ten_9a8b7c6d5e'
  },
  viewer: {
    member_id: 'usr_9e8d7c6b5a',
    email: 'viewer@agentpay.io',
    name: 'Dana (Viewer / Readonly)',
    role: 'viewer',
    status: 'active',
    tenant_id: 'ten_9a8b7c6d5e'
  }
};

export const MOCK_WALLETS: Record<string, import('@/types/wallet').Wallet> = {
  ten_9a8b7c6d5e: {
    wallet_id: 'wal_ten_9a8b7c6d5e',
    tenant_id: 'ten_9a8b7c6d5e',
    asset: '算力点数 (Credits)',
    status: 'active',
    version: 4,
    available_cache: 4950000, // 4.95 算力点数 (Credits)
    held_cache: 50000,        // 0.05 算力点数 (Credits)
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-18T19:30:00Z'
  },
  ten_3f4e5d6c7b: {
    wallet_id: 'wal_ten_3f4e5d6c7b',
    tenant_id: 'ten_3f4e5d6c7b',
    asset: '算力点数 (Credits)',
    status: 'frozen_arrears',
    version: 3,
    available_cache: -250000, // -0.25 算力点数 (Credits) (Arrears)
    held_cache: 0,
    created_at: '2026-10-10T12:00:00Z',
    updated_at: '2026-10-17T11:00:00Z'
  }
};

export const MOCK_LEDGER_ENTRIES: Record<string, import('@/types/wallet').LedgerEntry[]> = {
  wal_ten_9a8b7c6d5e: [
    {
      entry_id: 'ent_8e9f0a1b2c',
      wallet_id: 'wal_ten_9a8b7c6d5e',
      tenant_id: 'ten_9a8b7c6d5e',
      type: 'capture',
      amount: -50000,
      balance_after: 4950000,
      idempotency_key: 'cap_pi_7a8b9c0d1e',
      ref_type: 'PaymentIntent',
      ref_id: 'pi_7a8b9c0d1e',
      operator_id: 'sys_gateway_settler',
      reason: 'DeepSeek-V3 API 路由调用确认结算 (Hold Capture)',
      created_at: '2026-10-18T19:30:00Z'
    },
    {
      entry_id: 'ent_1b2c3d4e5f',
      wallet_id: 'wal_ten_9a8b7c6d5e',
      tenant_id: 'ten_9a8b7c6d5e',
      type: 'topup_credit',
      amount: 5000000,
      balance_after: 5000000,
      idempotency_key: 'top_ord_init_001',
      ref_type: 'TopUpOrder',
      ref_id: 'top_ord_init_001',
      operator_id: 'usr_8f7e6d5c4b',
      reason: '平台入驻管理员初始发放 (Admin Grant)',
      created_at: '2026-10-01T08:05:00Z'
    }
  ],
  wal_ten_3f4e5d6c7b: [
    {
      entry_id: 'ent_3f4e5d6c_rev',
      wallet_id: 'wal_ten_3f4e5d6c7b',
      tenant_id: 'ten_3f4e5d6c7b',
      type: 'reversal',
      amount: -250000,
      balance_after: -250000,
      idempotency_key: 'rev_chargeback_001',
      ref_type: 'Chargeback',
      ref_id: 'cb_77665544',
      operator_id: 'sys_risk_engine',
      reason: '争议冲正导致账户透支，触发 W6 欠费冻结',
      created_at: '2026-10-17T11:00:00Z'
    },
    {
      entry_id: 'ent_3f4e5d6c_cap',
      wallet_id: 'wal_ten_3f4e5d6c7b',
      tenant_id: 'ten_3f4e5d6c7b',
      type: 'capture',
      amount: -1000000,
      balance_after: 0,
      idempotency_key: 'cap_pi_sandbox_test',
      ref_type: 'PaymentIntent',
      ref_id: 'pi_sandbox_test',
      operator_id: 'sys_gateway_settler',
      reason: '沙箱批量并发测试调用扣费',
      created_at: '2026-10-12T16:00:00Z'
    },
    {
      entry_id: 'ent_3f4e5d6c_top',
      wallet_id: 'wal_ten_3f4e5d6c7b',
      tenant_id: 'ten_3f4e5d6c7b',
      type: 'topup_credit',
      amount: 1000000,
      balance_after: 1000000,
      idempotency_key: 'top_ord_sandbox_001',
      ref_type: 'TopUpOrder',
      ref_id: 'top_ord_sandbox_001',
      operator_id: 'usr_8f7e6d5c4b',
      reason: 'DevLab 初始沙箱额度',
      created_at: '2026-10-10T12:05:00Z'
    }
  ]
};

export const MOCK_TOPUP_ORDERS: Record<string, import('@/types/wallet').TopUpOrder[]> = {
  wal_ten_9a8b7c6d5e: [
    {
      topup_id: 'top_ord_fiat_002',
      wallet_id: 'wal_ten_9a8b7c6d5e',
      tenant_id: 'ten_9a8b7c6d5e',
      channel: 'fiat',
      amount: 10000000, // 10 算力点数 (Credits)
      asset: '算力点数 (Credits)',
      status: 'confirmed',
      external_ref: 'bank_transfer_20261015_01',
      operator_id: 'sys_audit',
      reason: '国内专线集群 (East-China-1) 企业对公转账充值确认',
      created_at: '2026-10-15T14:20:00Z',
      confirmed_at: '2026-10-15T14:22:15Z'
    },
    {
      topup_id: 'top_ord_init_001',
      wallet_id: 'wal_ten_9a8b7c6d5e',
      tenant_id: 'ten_9a8b7c6d5e',
      channel: 'admin_grant',
      amount: 5000000, // 5 算力点数 (Credits)
      asset: '算力点数 (Credits)',
      status: 'confirmed',
      external_ref: 'idem_init_grant_001',
      operator_id: 'usr_8f7e6d5c4b',
      reason: '平台入驻管理员初始发放 (Admin Grant)',
      created_at: '2026-10-01T08:05:00Z',
      confirmed_at: '2026-10-01T08:05:00Z'
    }
  ],
  wal_ten_3f4e5d6c7b: [
    {
      topup_id: 'top_ord_sandbox_001',
      wallet_id: 'wal_ten_3f4e5d6c7b',
      tenant_id: 'ten_3f4e5d6c7b',
      channel: 'admin_grant',
      amount: 1000000, // 1 算力点数 (Credits)
      asset: '算力点数 (Credits)',
      status: 'confirmed',
      external_ref: 'idem_sandbox_001',
      operator_id: 'usr_8f7e6d5c4b',
      reason: 'DevLab 初始沙箱额度',
      created_at: '2026-10-10T12:05:00Z',
      confirmed_at: '2026-10-10T12:05:00Z'
    }
  ]
};

export const MOCK_AGENTS: Record<string, import('@/types/agent').Agent[]> = {
  ten_9a8b7c6d5e: [
    {
      agent_id: 'agt_spider_01',
      tenant_id: 'ten_9a8b7c6d5e',
      project_id: 'prj_1a2b3c4d5e',
      name: 'Autonomous Research Spider',
      status: 'active',
      requests_count: 1420,
      total_spend_base_units: 45200000, // 45.20 算力点数 (Credits)
      reject_rate: '0.2%',
      created_at: 1727769600,
      updated_at: 1729279800,
      policy_config: {
        budget_cap_base_units: 500000000, // 500 算力点数 (Credits)
        rate_limit_rpm: 60,
        rate_limit_qps: 5,
        route_allowlist: ['/v1/chat/completions', '/v1/embeddings']
      },
      kya_profile: {
        model_provider: 'DeepSeek',
        model_version: 'deepseek-v3',
        framework: 'LangChain v0.3',
        hosting_env: 'TEE Confidential Cloud (Azure DCsv3)',
        owner_name: 'Alice Wang',
        owner_email: 'alice@agentpay.io',
        department: 'Autonomous Intelligence Lab',
        authorized_by: 'Bob (Director of Infrastructure)',
        autonomy_level: 'L3_fully_autonomous',
        risk_level: 'medium',
        status: 'verified',
        max_single_spend: 5000000, // 5 算力点数 (Credits)
        allowed_tools: ['web_search', 'pdf_extract', 'vector_store'],
        attestation_hash: 'sha256_9e8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a',
        verified_at: '2026-10-02T10:00:00Z',
        notes: '通过 TEE 远程证明验证，具备受限网络自治采集权限'
      }
    },
    {
      agent_id: 'agt_analyst_02',
      tenant_id: 'ten_9a8b7c6d5e',
      project_id: 'prj_8e7d6c5b4a',
      name: 'Portfolio Rebalancer Agent',
      status: 'active',
      requests_count: 240,
      total_spend_base_units: 120000000, // 120.00 算力点数 (Credits)
      reject_rate: '0.0%',
      created_at: 1728115200,
      updated_at: 1729279800,
      policy_config: {
        budget_cap_base_units: 1000000000, // 1000 算力点数 (Credits)
        rate_limit_rpm: 30,
        rate_limit_qps: 2,
        route_allowlist: ['/v1/market/quote', '/v1/trade/order']
      },
      kya_profile: {
        model_provider: 'Anthropic',
        model_version: 'claude-3-5-sonnet',
        framework: 'CrewAI',
        hosting_env: 'Self-hosted Kubernetes',
        owner_name: 'Charlie Lin',
        owner_email: 'charlie@agentpay.io',
        department: 'Quantitative Strategy Group',
        authorized_by: 'Alice Wang',
        autonomy_level: 'L2_semi_autonomous',
        risk_level: 'low',
        status: 'verified',
        max_single_spend: 10000000, // 10 算力点数 (Credits)
        allowed_tools: ['market_feed', 'order_sim', 'slack_notify'],
        attestation_hash: 'sha256_3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d',
        verified_at: '2026-10-06T15:00:00Z',
        notes: '投资组合重平衡半自主执行，超限需 Slack 双重审批'
      }
    },
    {
      agent_id: 'agt_scraper_03',
      tenant_id: 'ten_9a8b7c6d5e',
      project_id: 'prj_1a2b3c4d5e',
      name: 'Unverified High-Frequency Scraper',
      status: 'suspended',
      requests_count: 8920,
      total_spend_base_units: 580400000, // 580.40 算力点数 (Credits)
      reject_rate: '14.8%',
      created_at: 1728374400,
      updated_at: 1729251000,
      policy_config: {
        budget_cap_base_units: 100000000, // 100 算力点数 (Credits)
        rate_limit_rpm: 120,
        rate_limit_qps: 10
      },
      kya_profile: {
        model_provider: 'OpenAI',
        model_version: 'gpt-4o-mini',
        framework: 'Custom Swarm SDK',
        hosting_env: 'Third-party Serverless',
        owner_name: 'Guest Developer',
        owner_email: 'dev@external-swarm.org',
        department: 'Experimental Growth',
        authorized_by: 'Pending Approval',
        autonomy_level: 'L3_fully_autonomous',
        risk_level: 'critical',
        status: 'pending_review',
        max_single_spend: 1000000,
        allowed_tools: ['raw_curl'],
        notes: '检测到调用频率异常激增与策略频发拒绝，已被一键熔断 (Kill Switch)'
      }
    }
  ],
  ten_3f4e5d6c7b: [
    {
      agent_id: 'agt_dev_bot_01',
      tenant_id: 'ten_3f4e5d6c7b',
      project_id: 'prj_dev_sandbox_01',
      name: 'DevLab Sandbox Test Runner',
      status: 'active',
      requests_count: 50,
      total_spend_base_units: 500000,
      reject_rate: '0.0%',
      created_at: 1728561600,
      updated_at: 1729166400,
      policy_config: {
        budget_cap_base_units: 50000000,
        rate_limit_rpm: 60
      },
      kya_profile: {
        model_provider: 'DeepSeek',
        model_version: 'deepseek-chat',
        framework: 'AutoGen',
        hosting_env: 'Local Machine Sandbox',
        owner_name: 'Test Engineer',
        owner_email: 'tester@devlab.org',
        department: 'QA & Integration',
        authorized_by: 'DevLab Lead',
        autonomy_level: 'L1_assisted',
        risk_level: 'low',
        status: 'unverified',
        max_single_spend: 500000,
        allowed_tools: ['echo', 'mock_weather']
      }
    }
  ]
};

export const MOCK_AGENT_KEYS: Record<string, import('@/types/agent').AgentAPIKey[]> = {
  agt_spider_01: [
    {
      key_id: 'key_spider_prod_01',
      tenant_id: 'ten_9a8b7c6d5e',
      project_id: 'prj_1a2b3c4d5e',
      agent_id: 'agt_spider_01',
      name: 'Spider Cluster Primary Key',
      key_prefix: 'agp_live_sp8f9a',
      scopes: ['route:invoke', 'wallet:spend'],
      status: 'active',
      created_at: 1727769600,
      last_used_at: 1729279800
    }
  ],
  agt_analyst_02: [
    {
      key_id: 'key_analyst_prod_01',
      tenant_id: 'ten_9a8b7c6d5e',
      project_id: 'prj_8e7d6c5b4a',
      agent_id: 'agt_analyst_02',
      name: 'Quant Engine Dedicated Key',
      key_prefix: 'agp_live_an1a2b',
      scopes: ['route:invoke', 'wallet:spend'],
      status: 'active',
      created_at: 1728115200,
      last_used_at: 1729279800
    }
  ],
  agt_scraper_03: [
    {
      key_id: 'key_scraper_revoked_01',
      tenant_id: 'ten_9a8b7c6d5e',
      project_id: 'prj_1a2b3c4d5e',
      agent_id: 'agt_scraper_03',
      name: 'Rogue Ingress Token (Revoked)',
      key_prefix: 'agp_live_sc9e8d',
      scopes: ['route:invoke'],
      status: 'revoked',
      created_at: 1728374400,
      last_used_at: 1729250000
    }
  ]
};

export const MOCK_AGENT_TIMELINE: Record<string, import('@/types/agent').AgentTimelineEvent[]> = {
  agt_spider_01: [
    {
      event_id: 'evt_sp_001',
      event_type: 'agent.request',
      occurred_at: '2026-10-18T19:35:10Z',
      actor: 'agent',
      summary: '成功调用 DeepSeek-V3 模型路由 (/v1/chat/completions)',
      observed: {
        tenant_id: 'ten_9a8b7c6d5e',
        project_id: 'prj_1a2b3c4d5e',
        agent_id: 'agt_spider_01',
        request_id: 'req_spider_9a8b7c',
        route_id: 'rte_deepseek_v3_paid',
        config_version: 'ver_snapshot_prod_v2',
        status_code: 200,
        latency_ms: 680,
        cost_base_units: 50000, // 0.05 算力点数 (Credits)
        policy_decision: 'allow',
        payment_intent_id: 'pi_7a8b9c0d1e',
        settlement_id: 'set_1a2b3c4d5e',
        hold_id: 'hld_8e9f0a1b',
        request_hash: 'sha256:7f8a9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a'
      },
      declared: {
        session_id: 'sess_research_alpha',
        task_id: 'task_crawl_arxiv_ai',
        tool_name: 'paper_summarizer',
        user_prompt_summary: '总结最新 Agent 经济学论文核心结论'
      }
    },
    {
      event_id: 'evt_sp_002',
      event_type: 'agent.policy_decision',
      occurred_at: '2026-10-18T19:35:09Z',
      actor: 'system',
      summary: '网关策略决策器判定通过 (ALLOW)',
      observed: {
        tenant_id: 'ten_9a8b7c6d5e',
        project_id: 'prj_1a2b3c4d5e',
        agent_id: 'agt_spider_01',
        request_id: 'req_spider_9a8b7c',
        route_id: 'rte_deepseek_v3_paid',
        policy_decision: 'allow'
      },
      declared: {
        session_id: 'sess_research_alpha',
        task_id: 'task_crawl_arxiv_ai'
      }
    },
    {
      event_id: 'evt_sp_003',
      event_type: 'agent.spend',
      occurred_at: '2026-10-18T19:35:08Z',
      actor: 'system',
      summary: '虚拟组织账户成功预扣冻结 (Hold: 0.05 算力点数 (Credits))',
      observed: {
        tenant_id: 'ten_9a8b7c6d5e',
        project_id: 'prj_1a2b3c4d5e',
        agent_id: 'agt_spider_01',
        request_id: 'req_spider_9a8b7c',
        cost_base_units: 50000,
        payment_intent_id: 'pi_7a8b9c0d1e',
        hold_id: 'hld_8e9f0a1b'
      },
      declared: {
        session_id: 'sess_research_alpha'
      }
    },
    {
      event_id: 'evt_sp_004',
      event_type: 'agent.request',
      occurred_at: '2026-10-18T18:10:00Z',
      actor: 'agent',
      summary: '调用向量提取接口 (/v1/embeddings) 完成文档切片向量化',
      observed: {
        tenant_id: 'ten_9a8b7c6d5e',
        project_id: 'prj_1a2b3c4d5e',
        agent_id: 'agt_spider_01',
        request_id: 'req_spider_887766',
        route_id: 'rte_text_embedding_3',
        status_code: 200,
        latency_ms: 120,
        cost_base_units: 2000, // 0.002 算力点数 (Credits)
        policy_decision: 'allow'
      },
      declared: {
        session_id: 'sess_research_alpha',
        task_id: 'task_embed_chunks',
        tool_name: 'vector_store'
      }
    }
  ],
  agt_scraper_03: [
    {
      event_id: 'evt_sc_001',
      event_type: 'agent.control',
      occurred_at: '2026-10-18T12:00:00Z',
      actor: 'admin',
      summary: '管理员触发一键熔断停用 (Kill Switch) 并作废关联凭证',
      observed: {
        tenant_id: 'ten_9a8b7c6d5e',
        project_id: 'prj_1a2b3c4d5e',
        agent_id: 'agt_scraper_03',
        request_id: 'ctrl_kill_998877',
        operator_id: 'usr_8f7e6d5c4b',
        control_reason: '高频连续触发策略超限熔断，疑似逻辑死循环'
      }
    },
    {
      event_id: 'evt_sc_002',
      event_type: 'agent.anomaly',
      occurred_at: '2026-10-18T11:59:45Z',
      actor: 'system',
      summary: '风控检测器触发告警：Agent 拒绝率达到 14.8%，超过安全基线 10%',
      observed: {
        tenant_id: 'ten_9a8b7c6d5e',
        project_id: 'prj_1a2b3c4d5e',
        agent_id: 'agt_scraper_03',
        request_id: 'anom_rate_spike_01',
        policy_decision: 'deny',
        reject_code: 'RATE_LIMIT_EXCEEDED'
      },
      declared: {
        session_id: 'sess_wild_loop_09'
      }
    },
    {
      event_id: 'evt_sc_003',
      event_type: 'agent.policy_decision',
      occurred_at: '2026-10-18T11:59:40Z',
      actor: 'system',
      summary: '策略拦截：超出单分钟 RPM 限额 (60 RPM)',
      observed: {
        tenant_id: 'ten_9a8b7c6d5e',
        project_id: 'prj_1a2b3c4d5e',
        agent_id: 'agt_scraper_03',
        request_id: 'req_scraper_deny_01',
        policy_decision: 'deny',
        reject_code: 'ERR_RATE_LIMIT'
      },
      declared: {
        session_id: 'sess_wild_loop_09',
        task_id: 'task_infinite_probe'
      }
    }
  ]
};

export const MOCK_PAYMENTS: Record<string, import('@/types/payment').PaymentAuditRecord[]> = {
  ten_9a8b7c6d5e: [
    {
      intent_id: 'pi_req_spider_9a8b7c',
      tenant_id: 'ten_9a8b7c6d5e',
      project_id: 'prj_1a2b3c4d5e',
      agent_id: 'agt_spider_01',
      route_id: 'rte_deepseek_v3_paid',
      request_id: 'req_spider_9a8b7c',
      idempotency_key: 'idem_sp_paper_001',
      payment_method: 'wallet',
      amount_base_units: 50000,
      asset: '算力点数 (Credits)',
      display_status: 'COMPLETED',
      display_note: '扣费确权且上游交付成功，交易顺利完成',
      is_recovery_required: false,
      intent_status: 'completed',
      settlement_status: 'confirmed',
      fulfillment_status: 'succeeded',
      intent: {
        intent_id: 'pi_req_spider_9a8b7c',
        tenant_id: 'ten_9a8b7c6d5e',
        project_id: 'prj_1a2b3c4d5e',
        agent_id: 'agt_spider_01',
        route_id: 'rte_deepseek_v3_paid',
        idempotency_key: 'idem_sp_paper_001',
        request_id: 'req_spider_9a8b7c',
        payment_method: 'wallet',
        amount_base_units: 50000,
        asset: '算力点数 (Credits)',
        status: 'completed',
        config_version_id: 'ver_snapshot_prod_v2',
        created_at: '2026-10-18T19:35:10Z',
        updated_at: '2026-10-18T19:35:11Z'
      },
      settlement: {
        settlement_id: 'stl_hld_8e9f0a1b',
        intent_id: 'pi_req_spider_9a8b7c',
        payment_method: 'wallet',
        asset_address: '算力点数 (Credits)',
        payer_address: 'wlt_tenant_master_01',
        amount_base_units: 50000,
        status: 'confirmed',
        created_at: '2026-10-18T19:35:10Z',
        updated_at: '2026-10-18T19:35:11Z'
      },
      fulfillment: {
        fulfillment_id: 'ful_req_spider_9a8b7c',
        intent_id: 'pi_req_spider_9a8b7c',
        upstream_url: 'https://api.deepseek.com/v1/chat/completions',
        upstream_status: 200,
        latency_ms: 680,
        response_body_hash: 'sha256:7f8a9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a',
        status: 'succeeded',
        created_at: '2026-10-18T19:35:10Z',
        updated_at: '2026-10-18T19:35:11Z'
      },
      hold: {
        hold_id: 'hld_8e9f0a1b',
        wallet_id: 'wlt_tenant_master_01',
        amount: 50000,
        status: 'captured',
        expires_at: '2026-10-18T19:37:10Z'
      },
      ledger: {
        entry_id: 'led_hld_8e9f0a1b',
        wallet_id: 'wlt_tenant_master_01',
        type: 'capture',
        amount: -50000,
        created_at: '2026-10-18T19:35:11Z'
      },
      created_at: '2026-10-18T19:35:10Z',
      updated_at: '2026-10-18T19:35:11Z'
    },
    {
      intent_id: 'pi_req_analyst_887766',
      tenant_id: 'ten_9a8b7c6d5e',
      project_id: 'prj_8e7d6c5b4a',
      agent_id: 'agt_analyst_02',
      route_id: 'rte_alpha_vantage_paid',
      request_id: 'req_analyst_887766',
      idempotency_key: 'idem_an_sec_filing_404',
      payment_method: 'wallet',
      amount_base_units: 30000,
      asset: '算力点数 (Credits)',
      display_status: 'RELEASED_UNBILLED',
      display_note: '上游请求失败，组织账户冻结已无损全额解冻，买方未产生扣费',
      is_recovery_required: false,
      intent_status: 'failed',
      settlement_status: 'released',
      fulfillment_status: 'failed',
      intent: {
        intent_id: 'pi_req_analyst_887766',
        tenant_id: 'ten_9a8b7c6d5e',
        project_id: 'prj_8e7d6c5b4a',
        agent_id: 'agt_analyst_02',
        route_id: 'rte_alpha_vantage_paid',
        idempotency_key: 'idem_an_sec_filing_404',
        request_id: 'req_analyst_887766',
        payment_method: 'wallet',
        amount_base_units: 30000,
        asset: '算力点数 (Credits)',
        status: 'failed',
        created_at: '2026-10-18T18:40:00Z',
        updated_at: '2026-10-18T18:40:01Z'
      },
      settlement: {
        settlement_id: 'stl_hld_rel_7766',
        intent_id: 'pi_req_analyst_887766',
        payment_method: 'wallet',
        asset_address: '算力点数 (Credits)',
        payer_address: 'wlt_tenant_master_01',
        amount_base_units: 30000,
        status: 'released',
        created_at: '2026-10-18T18:40:00Z',
        updated_at: '2026-10-18T18:40:01Z'
      },
      fulfillment: {
        fulfillment_id: 'ful_req_analyst_887766',
        intent_id: 'pi_req_analyst_887766',
        upstream_url: 'https://api.alphavantage.co/query?function=OVERVIEW',
        upstream_status: 404,
        latency_ms: 210,
        status: 'failed',
        created_at: '2026-10-18T18:40:00Z',
        updated_at: '2026-10-18T18:40:01Z'
      },
      hold: {
        hold_id: 'hld_rel_7766',
        wallet_id: 'wlt_tenant_master_01',
        amount: 30000,
        status: 'released',
        expires_at: '2026-10-18T18:42:00Z'
      },
      ledger: {
        entry_id: 'led_hld_rel_7766',
        wallet_id: 'wlt_tenant_master_01',
        type: 'hold_release',
        amount: 30000,
        created_at: '2026-10-18T18:40:01Z'
      },
      created_at: '2026-10-18T18:40:00Z',
      updated_at: '2026-10-18T18:40:01Z'
    },
    {
      intent_id: 'pi_req_analyst_timeout_01',
      tenant_id: 'ten_9a8b7c6d5e',
      project_id: 'prj_8e7d6c5b4a',
      agent_id: 'agt_analyst_02',
      route_id: 'rte_bloomberg_feed_paid',
      request_id: 'req_analyst_timeout_01',
      idempotency_key: 'idem_an_bberg_timeout',
      payment_method: 'wallet',
      amount_base_units: 100000,
      asset: '算力点数 (Credits)',
      display_status: 'RECOVERY_REQUIRED',
      display_note: '上游出现异常或超时，组织账户冻结严格锁定中，等待幂等重试或人工对账',
      is_recovery_required: true,
      intent_status: 'needs_review',
      settlement_status: 'held',
      fulfillment_status: 'unknown',
      intent: {
        intent_id: 'pi_req_analyst_timeout_01',
        tenant_id: 'ten_9a8b7c6d5e',
        project_id: 'prj_8e7d6c5b4a',
        agent_id: 'agt_analyst_02',
        route_id: 'rte_bloomberg_feed_paid',
        idempotency_key: 'idem_an_bberg_timeout',
        request_id: 'req_analyst_timeout_01',
        payment_method: 'wallet',
        amount_base_units: 100000,
        asset: '算力点数 (Credits)',
        status: 'needs_review',
        created_at: '2026-10-18T17:15:00Z',
        updated_at: '2026-10-18T17:15:30Z'
      },
      settlement: {
        settlement_id: 'stl_hld_timeout_88',
        intent_id: 'pi_req_analyst_timeout_01',
        payment_method: 'wallet',
        asset_address: '算力点数 (Credits)',
        payer_address: 'wlt_tenant_master_01',
        amount_base_units: 100000,
        status: 'held',
        created_at: '2026-10-18T17:15:00Z',
        updated_at: '2026-10-18T17:15:30Z'
      },
      fulfillment: {
        fulfillment_id: 'ful_req_analyst_timeout_01',
        intent_id: 'pi_req_analyst_timeout_01',
        upstream_url: 'https://feed.bloomberg.com/v1/quotes',
        upstream_status: 504,
        latency_ms: 30000,
        status: 'unknown',
        created_at: '2026-10-18T17:15:00Z',
        updated_at: '2026-10-18T17:15:30Z'
      },
      hold: {
        hold_id: 'hld_timeout_88',
        wallet_id: 'wlt_tenant_master_01',
        amount: 100000,
        status: 'held',
        expires_at: '2026-10-18T17:17:00Z'
      },
      created_at: '2026-10-18T17:15:00Z',
      updated_at: '2026-10-18T17:15:30Z'
    },
    {
      intent_id: 'pi_req_domestic_feed_01',
      tenant_id: 'ten_9a8b7c6d5e',
      project_id: 'prj_1a2b3c4d5e',
      agent_id: 'agt_spider_01',
      route_id: 'rte_domestic_market_feed',
      request_id: 'req_domestic_feed_01',
      idempotency_key: 'idem_feed_tx_001',
      payment_method: 'wallet',
      amount_base_units: 20000,
      asset: '算力点数 (Credits)',
      display_status: 'COMPLETED',
      display_note: '扣费确权且上游交付成功，交易顺利完成',
      is_recovery_required: false,
      intent_status: 'completed',
      settlement_status: 'confirmed',
      fulfillment_status: 'succeeded',
      intent: {
        intent_id: 'pi_req_domestic_feed_01',
        tenant_id: 'ten_9a8b7c6d5e',
        project_id: 'prj_1a2b3c4d5e',
        agent_id: 'agt_spider_01',
        route_id: 'rte_domestic_market_feed',
        request_id: 'req_domestic_feed_01',
        payment_method: 'wallet',
        amount_base_units: 20000,
        asset: '算力点数 (Credits)',
        status: 'completed',
        created_at: '2026-10-18T16:00:00Z',
        updated_at: '2026-10-18T16:00:02Z'
      },
      settlement: {
        settlement_id: 'stl_quota_domestic_01',
        intent_id: 'pi_req_domestic_feed_01',
        payment_method: 'wallet',
        amount_base_units: 20000,
        status: 'confirmed',
        created_at: '2026-10-18T16:00:00Z',
        updated_at: '2026-10-18T16:00:02Z'
      },
      fulfillment: {
        fulfillment_id: 'ful_req_domestic_feed_01',
        intent_id: 'pi_req_domestic_feed_01',
        upstream_url: 'https://feed.internal.net/v1/feed',
        upstream_status: 200,
        latency_ms: 320,
        status: 'succeeded',
        created_at: '2026-10-18T16:00:00Z',
        updated_at: '2026-10-18T16:00:02Z'
      },
      created_at: '2026-10-18T16:00:00Z',
      updated_at: '2026-10-18T16:00:02Z'
    },
    {
      intent_id: 'pi_req_scraper_insufficient_01',
      tenant_id: 'ten_9a8b7c6d5e',
      project_id: 'prj_1a2b3c4d5e',
      agent_id: 'agt_scraper_03',
      route_id: 'rte_premium_data_feed',
      request_id: 'req_scraper_insufficient_01',
      payment_method: 'wallet',
      amount_base_units: 500000,
      asset: '算力点数 (Credits)',
      display_status: 'PAYMENT_FAILED',
      display_note: '资金划转失败或余额不足，未发起履约交付',
      is_recovery_required: false,
      intent_status: 'failed',
      settlement_status: 'failed',
      fulfillment_status: 'not_started',
      intent: {
        intent_id: 'pi_req_scraper_insufficient_01',
        tenant_id: 'ten_9a8b7c6d5e',
        project_id: 'prj_1a2b3c4d5e',
        agent_id: 'agt_scraper_03',
        route_id: 'rte_premium_data_feed',
        request_id: 'req_scraper_insufficient_01',
        payment_method: 'wallet',
        amount_base_units: 500000,
        asset: '算力点数 (Credits)',
        status: 'failed',
        created_at: '2026-10-18T11:45:00Z',
        updated_at: '2026-10-18T11:45:00Z'
      },
      settlement: {
        settlement_id: 'stl_req_scraper_insufficient_01',
        intent_id: 'pi_req_scraper_insufficient_01',
        payment_method: 'wallet',
        asset_address: '算力点数 (Credits)',
        payer_address: 'wlt_tenant_master_01',
        amount_base_units: 500000,
        status: 'failed',
        error_message: 'ERR_WALLET_INSUFFICIENT_BALANCE',
        created_at: '2026-10-18T11:45:00Z',
        updated_at: '2026-10-18T11:45:00Z'
      },
      created_at: '2026-10-18T11:45:00Z',
      updated_at: '2026-10-18T11:45:00Z'
    }
  ]
};


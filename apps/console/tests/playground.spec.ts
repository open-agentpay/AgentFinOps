import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPlaygroundEngine,
  PRESET_SCENARIOS
} from '../src/views/playground/state/playgroundEngine';

describe('Playground Engine & Financial Firewall State Machine', () => {
  let engine: ReturnType<typeof createPlaygroundEngine>;

  beforeEach(() => {
    engine = createPlaygroundEngine();
  });

  it('should initialize with default presets and idle state', () => {
    expect(PRESET_SCENARIOS.length).toBe(3);
    expect(engine.currentScenario.id).toBe('hitl_suspension');
    expect(engine.executionStatus.value).toBe('idle');
    expect(engine.approvalState.value.status).toBe('none');
    expect(engine.pipelineSteps.value.length).toBeGreaterThan(0);
  });

  it('should switch scenario and update parameters correctly', () => {
    engine.loadScenario('normal_small');
    expect(engine.currentScenario.amount).toBe(0.05);
    expect(engine.currentScenario.id).toBe('normal_small');
    expect(engine.approvalState.value.status).toBe('none');

    engine.loadScenario('circuit_break');
    expect(engine.currentScenario.amount).toBe(5000);
    expect(engine.currentScenario.id).toBe('circuit_break');
  });

  it('should execute small amount and pass with 200 OK without suspension', async () => {
    engine.loadScenario('normal_small');
    await engine.executeSimulatedRequest();

    expect(engine.executionStatus.value).toBe('success');
    expect(engine.simulatedResponse.value?.statusCode).toBe(200);
    expect(engine.simulatedResponse.value?.body?.code).toBe('SUCCESS');
    expect(engine.approvalState.value.status).toBe('none');
  });

  it('should trigger 402 suspension and generate approval card when amount exceeds HITL threshold', async () => {
    engine.loadScenario('hitl_suspension');
    await engine.executeSimulatedRequest();

    expect(engine.executionStatus.value).toBe('suspended');
    expect(engine.simulatedResponse.value?.statusCode).toBe(402);
    expect(engine.simulatedResponse.value?.body?.error).toBe('APPROVAL_REQUIRED');
    expect(engine.approvalState.value.status).toBe('pending');
    expect(engine.approvalState.value.approvalId).toMatch(/^appr_/);
  });

  it('should resume and settle 200 OK when mobile card approves the suspended request', async () => {
    engine.loadScenario('hitl_suspension');
    await engine.executeSimulatedRequest();
    expect(engine.approvalState.value.status).toBe('pending');

    await engine.approveSuspendedRequest('approver_zhang@corp.internal');
    expect(engine.approvalState.value.status).toBe('approved');
    expect(engine.executionStatus.value).toBe('success');
    expect(engine.simulatedResponse.value?.statusCode).toBe(200);
    expect(engine.simulatedResponse.value?.body?.settlement_status).toBe('CAPTURED');
  });

  it('should reject request with 403 when mobile card rejects the request', async () => {
    engine.loadScenario('hitl_suspension');
    await engine.executeSimulatedRequest();
    expect(engine.approvalState.value.status).toBe('pending');

    await engine.rejectSuspendedRequest('风险过高，超出单次调用预算预期');
    expect(engine.approvalState.value.status).toBe('rejected');
    expect(engine.executionStatus.value).toBe('error');
    expect(engine.simulatedResponse.value?.statusCode).toBe(403);
    expect(engine.simulatedResponse.value?.body?.error).toBe('APPROVAL_REJECTED');
  });

  it('should immediately circuit break with 403 when amount exceeds single transaction cap', async () => {
    engine.loadScenario('circuit_break');
    await engine.executeSimulatedRequest();

    expect(engine.executionStatus.value).toBe('error');
    expect(engine.simulatedResponse.value?.statusCode).toBe(403);
    expect(engine.simulatedResponse.value?.body?.error).toBe('SINGLE_TX_CAP_EXCEEDED');
  });
});

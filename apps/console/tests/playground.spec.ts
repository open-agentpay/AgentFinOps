import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPlaygroundEngine,
  PRESET_SCENARIOS
} from '../src/views/playground/state/playgroundEngine';

describe('Playground Engine & Autonomous Financial Firewall State Machine', () => {
  let engine: ReturnType<typeof createPlaygroundEngine>;

  beforeEach(() => {
    engine = createPlaygroundEngine();
  });

  it('should initialize with default presets and autonomous idle state', () => {
    expect(PRESET_SCENARIOS.length).toBe(3);
    expect(engine.currentScenario.id).toBe('budget_cap_block');
    expect(engine.executionStatus.value).toBe('idle');
    expect(engine.autonomousState.value.status).toBe('idle');
    expect(engine.pipelineSteps.value.length).toBeGreaterThan(0);
  });

  it('should switch scenario and update parameters correctly', () => {
    engine.loadScenario('normal_small');
    expect(engine.currentScenario.amount).toBe(0.05);
    expect(engine.currentScenario.id).toBe('normal_small');
    expect(engine.autonomousState.value.status).toBe('idle');

    engine.loadScenario('circuit_break');
    expect(engine.currentScenario.amount).toBe(5000);
    expect(engine.currentScenario.id).toBe('circuit_break');
  });

  it('should execute small amount and pass with 200 OK and Hold->Capture settlement', async () => {
    engine.loadScenario('normal_small');
    await engine.executeSimulatedRequest();

    expect(engine.executionStatus.value).toBe('success');
    expect(engine.simulatedResponse.value?.statusCode).toBe(200);
    expect(engine.simulatedResponse.value?.body?.code).toBe('SUCCESS');
    expect(engine.autonomousState.value.status).toBe('passed');
    expect(engine.autonomousState.value.ledger.action).toBe('HOLD_AND_CAPTURE');
    expect(engine.autonomousState.value.ledger.capturedAmount).toBe(0.05);
  });

  it('should physically block 402, release hold with zero loss, and guide autonomous agent recovery when cap is breached', async () => {
    engine.loadScenario('budget_cap_block');
    await engine.executeSimulatedRequest();

    expect(engine.executionStatus.value).toBe('warning');
    expect(engine.simulatedResponse.value?.statusCode).toBe(402);
    expect(engine.simulatedResponse.value?.body?.error).toBe('SINGLE_TX_CAP_EXCEEDED');
    expect(engine.autonomousState.value.status).toBe('blocked_and_recovered');
    expect(engine.autonomousState.value.ledger.action).toBe('HOLD_AND_RELEASE');
    expect(engine.autonomousState.value.ledger.releasedAmount).toBe(50.0);
    expect(engine.autonomousState.value.ledger.capturedAmount).toBe(0);
    expect(engine.autonomousState.value.llmObservation?.isError).toBe(true);
    expect(engine.autonomousState.value.llmObservation?.agentDecision).toContain('主动放弃');
  });

  it('should immediately circuit break with 403 when extreme loop or cap is breached', async () => {
    engine.loadScenario('circuit_break');
    await engine.executeSimulatedRequest();

    expect(engine.executionStatus.value).toBe('error');
    expect(engine.simulatedResponse.value?.statusCode).toBe(403);
    expect(engine.simulatedResponse.value?.body?.error).toBe('SINGLE_TX_CAP_EXCEEDED');
    expect(engine.autonomousState.value.status).toBe('circuit_broken');
    expect(engine.autonomousState.value.ledger.capturedAmount).toBe(0);
  });
});

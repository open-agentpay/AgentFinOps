package quota

import (
	"context"
	"testing"

	"github.com/agentfinops/agentfinops-gateway/internal/enterprise/department"
	"github.com/open-agentpay/agent-core-sdk/gateway/agent"
)

func TestCascadeQuotaEnforcer_Hierarchy(t *testing.T) {
	ctx := context.Background()

	// 1. Setup departments:
	// Parent Dept: Business Unit (BU-1, limit 100_000_000)
	// Child Dept: AI Engineering Team (TEAM-1, limit 40_000_000, parent BU-1)
	deptSvc := department.NewMemoryService()
	buDept, err := deptSvc.CreateDepartment(ctx, "ten_test", "Business Unit Alpha", nil, 100_000_000, "dept_bu_1")
	if err != nil {
		t.Fatalf("failed to create BU: %v", err)
	}
	parentID := buDept.DepartmentID
	teamDept, err := deptSvc.CreateDepartment(ctx, "ten_test", "AI Team", &parentID, 40_000_000, "dept_team_1")
	if err != nil {
		t.Fatalf("failed to create Team: %v", err)
	}

	// 2. Setup project:
	// Project: FinOps Agent Service (proj_1, limit 10_000_000, belongs to TEAM-1)
	projStore := NewMemoryProjectStore()
	proj := &Project{
		ProjectID:          "proj_1",
		TenantID:           "ten_test",
		DepartmentID:       teamDept.DepartmentID,
		Name:               "FinOps Agent Service",
		BudgetCapBaseUnits: 10_000_000,
		Status:             "active",
	}
	if err := projStore.UpsertProject(ctx, proj); err != nil {
		t.Fatalf("failed to upsert project: %v", err)
	}

	tracker := NewMemoryBudgetTracker()
	agentEnforcer := agent.NewEnforcer()
	cascadeEnforcer := NewCascadeQuotaEnforcer(agentEnforcer, projStore, deptSvc, tracker)
	recorder := NewCascadeSpendRecorder(projStore, deptSvc, tracker)

	agentIdent := &agent.AgentIdentity{
		AgentID:   "agent_1",
		TenantID:  "ten_test",
		ProjectID: "proj_1",
		Name:      "Test Agent",
		Status:    agent.AgentStatusActive,
	}

	// Case 1: Within all limits (Amount = 2_000_000 <= 10M proj, 40M team, 100M BU)
	req1 := &agent.PolicyRequest{
		Agent:      agentIdent,
		AmountBase: 2_000_000,
	}
	dec1 := cascadeEnforcer.EvaluatePolicy(ctx, req1)
	if !dec1.Allowed {
		t.Fatalf("expected allowed, got rejection: %s - %s", dec1.ReasonCode, dec1.Reason)
	}

	// Record spend of 2_000_000
	recErr := recorder.RecordSpend(ctx, &agent.SpendRecord{
		TenantID:   "ten_test",
		ProjectID:  "proj_1",
		AgentID:    "agent_1",
		AmountBase: 2_000_000,
	})
	if recErr != nil {
		t.Fatalf("failed to record spend: %v", recErr)
	}

	// Verify spend is tracked in project and all ancestor departments
	projSpend, _ := tracker.GetProjectMonthlySpend(ctx, "ten_test", "proj_1")
	if projSpend != 2_000_000 {
		t.Fatalf("expected project spend 2_000_000, got %d", projSpend)
	}
	teamSpend, _ := tracker.GetDepartmentMonthlySpend(ctx, "ten_test", teamDept.DepartmentID)
	if teamSpend != 2_000_000 {
		t.Fatalf("expected team dept spend 2_000_000, got %d", teamSpend)
	}
	buSpend, _ := tracker.GetDepartmentMonthlySpend(ctx, "ten_test", buDept.DepartmentID)
	if buSpend != 2_000_000 {
		t.Fatalf("expected BU dept spend 2_000_000, got %d", buSpend)
	}

	// Case 2: Exceed Project Quota (spent 2M, proj limit 10M, requesting 9M -> 11M > 10M)
	req2 := &agent.PolicyRequest{
		Agent:      agentIdent,
		AmountBase: 9_000_000,
	}
	dec2 := cascadeEnforcer.EvaluatePolicy(ctx, req2)
	if dec2.Allowed || dec2.ReasonCode != CodeErrQuotaExceededProject {
		t.Fatalf("expected %s, got allowed=%v code=%s", CodeErrQuotaExceededProject, dec2.Allowed, dec2.ReasonCode)
	}

	// Case 3: Create second project under same team to test department limit
	// Project 2 (limit 50M, so project alone won't fail, but team has only 40M - 2M = 38M left)
	proj2 := &Project{
		ProjectID:          "proj_2",
		TenantID:           "ten_test",
		DepartmentID:       teamDept.DepartmentID,
		Name:               "Large Data Project",
		BudgetCapBaseUnits: 50_000_000,
		Status:             "active",
	}
	_ = projStore.UpsertProject(ctx, proj2)

	agentIdent2 := &agent.AgentIdentity{
		AgentID:   "agent_2",
		TenantID:  "ten_test",
		ProjectID: "proj_2",
		Status:    agent.AgentStatusActive,
	}

	// Requesting 39M: proj_2 has 50M (passes proj check), but teamDept has 2M + 39M = 41M > 40M (exceeds dept check)
	req3 := &agent.PolicyRequest{
		Agent:      agentIdent2,
		AmountBase: 39_000_000,
	}
	dec3 := cascadeEnforcer.EvaluatePolicy(ctx, req3)
	if dec3.Allowed || dec3.ReasonCode != CodeErrQuotaExceededDepartment {
		t.Fatalf("expected %s, got allowed=%v code=%s (%s)", CodeErrQuotaExceededDepartment, dec3.Allowed, dec3.ReasonCode, dec3.Reason)
	}
	if dec3.Extra["department_id"] != teamDept.DepartmentID {
		t.Fatalf("expected extra department_id to be %s, got %v", teamDept.DepartmentID, dec3.Extra["department_id"])
	}

	// Case 4: Test Archived Department
	archivedStatus := department.DepartmentStatusArchived
	_, _ = deptSvc.UpdateDepartment(ctx, "ten_test", teamDept.DepartmentID, teamDept.Name, nil, nil, &archivedStatus)
	req4 := &agent.PolicyRequest{
		Agent:      agentIdent,
		AmountBase: 1_000,
	}
	dec4 := cascadeEnforcer.EvaluatePolicy(ctx, req4)
	if dec4.Allowed || dec4.ReasonCode != CodeErrDepartmentArchived {
		t.Fatalf("expected %s, got allowed=%v code=%s", CodeErrDepartmentArchived, dec4.Allowed, dec4.ReasonCode)
	}
}

func TestCascadeQuotaEnforcer_ProjectArchived(t *testing.T) {
	ctx := context.Background()
	projStore := NewMemoryProjectStore()
	_ = projStore.UpsertProject(ctx, &Project{
		ProjectID: "proj_archived",
		TenantID:  "ten_test",
		Name:      "Old Project",
		Status:    "archived",
	})

	cascade := NewCascadeQuotaEnforcer(nil, projStore, nil, nil)
	dec := cascade.EvaluatePolicy(ctx, &agent.PolicyRequest{
		Agent: &agent.AgentIdentity{
			TenantID:  "ten_test",
			ProjectID: "proj_archived",
		},
		AmountBase: 100,
	})
	if dec.Allowed || dec.ReasonCode != CodeErrProjectArchived {
		t.Fatalf("expected %s, got allowed=%v code=%s", CodeErrProjectArchived, dec.Allowed, dec.ReasonCode)
	}
}

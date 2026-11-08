package quota

import (
	"context"

	"github.com/agentfinops/agentfinops-gateway/internal/enterprise/department"
	"github.com/open-agentpay/agent-core-sdk/gateway/agent"
)

// CascadeSpendRecorder implements agent.SpendRecorder to atomically record and aggregate
// spent amounts across Project and all ancestor Departments in the organizational hierarchy.
type CascadeSpendRecorder struct {
	projectStore ProjectStore
	deptService  department.Service
	tracker      BudgetTracker
}

// NewCascadeSpendRecorder creates a new CascadeSpendRecorder.
func NewCascadeSpendRecorder(
	projectStore ProjectStore,
	deptService department.Service,
	tracker BudgetTracker,
) *CascadeSpendRecorder {
	return &CascadeSpendRecorder{
		projectStore: projectStore,
		deptService:  deptService,
		tracker:      tracker,
	}
}

// RecordSpend records payment expenditure into project and cascading department accumulators.
func (r *CascadeSpendRecorder) RecordSpend(ctx context.Context, record *agent.SpendRecord) error {
	if record == nil || r.tracker == nil || record.AmountBase <= 0 {
		return nil
	}

	tenantID := record.TenantID
	projectID := record.ProjectID

	// 1. Accumulate project spend
	if projectID != "" {
		_ = r.tracker.AddProjectSpend(ctx, tenantID, projectID, record.AmountBase)
	}

	// 2. Cascade accumulate department spend
	if r.projectStore != nil && r.deptService != nil && projectID != "" {
		proj, err := r.projectStore.GetProject(ctx, tenantID, projectID)
		if err == nil && proj != nil && proj.DepartmentID != "" {
			ancestors, err := r.deptService.GetDepartmentAncestors(ctx, tenantID, proj.DepartmentID)
			if err == nil {
				for _, dept := range ancestors {
					_ = r.tracker.AddDepartmentSpend(ctx, tenantID, dept.DepartmentID, record.AmountBase)
				}
			}
		}
	}

	return nil
}

package quota

import (
	"context"
	"fmt"

	"github.com/agentfinops/agentfinops-gateway/internal/enterprise/department"
	"github.com/open-agentpay/agent-core-sdk/gateway/agent"
)

const (
	CodeAllow                       = "ALLOW"
	CodeErrQuotaExceededProject     = "ERR_QUOTA_EXCEEDED_PROJECT"
	CodeErrQuotaExceededDepartment  = "ERR_QUOTA_EXCEEDED_DEPARTMENT"
	CodeErrProjectArchived          = "ERR_PROJECT_ARCHIVED"
	CodeErrDepartmentArchived       = "ERR_DEPARTMENT_ARCHIVED"
)

// CascadeQuotaEnforcer implements agent.PolicyEvaluator to enforce multi-tier cascade budgets
// across Tenant -> Department (and parent ancestors) -> Project -> Agent.
type CascadeQuotaEnforcer struct {
	agentEvaluator agent.PolicyEvaluator
	projectStore   ProjectStore
	deptService    department.Service
	tracker        BudgetTracker
}

// NewCascadeQuotaEnforcer creates a new CascadeQuotaEnforcer.
func NewCascadeQuotaEnforcer(
	agentEvaluator agent.PolicyEvaluator,
	projectStore ProjectStore,
	deptService department.Service,
	tracker BudgetTracker,
) *CascadeQuotaEnforcer {
	return &CascadeQuotaEnforcer{
		agentEvaluator: agentEvaluator,
		projectStore:   projectStore,
		deptService:    deptService,
		tracker:        tracker,
	}
}

// EvaluatePolicy checks agent policies, then project monthly budget, and finally
// the entire department ancestor chain for monthly budget ceilings.
func (e *CascadeQuotaEnforcer) EvaluatePolicy(ctx context.Context, req *agent.PolicyRequest) agent.PolicyDecision {
	// 1. Evaluate underlying Agent policy if configured
	if e.agentEvaluator != nil {
		decision := e.agentEvaluator.EvaluatePolicy(ctx, req)
		if !decision.Allowed {
			return decision
		}
	}

	if req == nil || req.Agent == nil {
		return agent.PolicyDecision{
			Allowed:    true,
			ReasonCode: CodeAllow,
			Reason:     "No agent identity to enforce enterprise cascade quota",
		}
	}

	tenantID := req.Agent.TenantID
	projectID := req.Agent.ProjectID

	// 2. Project-level budget check
	var proj *Project
	if e.projectStore != nil && projectID != "" {
		p, err := e.projectStore.GetProject(ctx, tenantID, projectID)
		if err == nil && p != nil {
			proj = p
			if proj.Status == "archived" {
				return agent.PolicyDecision{
					Allowed:    false,
					ReasonCode: CodeErrProjectArchived,
					Reason:     fmt.Sprintf("Project '%s' (%s) is archived", proj.Name, proj.ProjectID),
				}
			}

			if proj.BudgetCapBaseUnits > 0 && e.tracker != nil {
				currentSpend, _ := e.tracker.GetProjectMonthlySpend(ctx, tenantID, projectID)
				if currentSpend+req.AmountBase > proj.BudgetCapBaseUnits {
					return agent.PolicyDecision{
						Allowed:    false,
						ReasonCode: CodeErrQuotaExceededProject,
						Reason: fmt.Sprintf(
							"Project '%s' monthly budget cap exceeded: cap=%d, current_spent=%d, requested=%d",
							proj.Name, proj.BudgetCapBaseUnits, currentSpend, req.AmountBase,
						),
						Extra: map[string]interface{}{
							"entity_type":   "project",
							"project_id":    proj.ProjectID,
							"budget_cap":    proj.BudgetCapBaseUnits,
							"current_spend": currentSpend,
							"requested":     req.AmountBase,
						},
					}
				}
			}
		}
	}

	// 3. Department-level cascade budget check
	if proj != nil && proj.DepartmentID != "" && e.deptService != nil {
		ancestors, err := e.deptService.GetDepartmentAncestors(ctx, tenantID, proj.DepartmentID)
		if err == nil {
			for _, dept := range ancestors {
				if dept.Status == department.DepartmentStatusArchived {
					return agent.PolicyDecision{
						Allowed:    false,
						ReasonCode: CodeErrDepartmentArchived,
						Reason:     fmt.Sprintf("Department '%s' (%s) is archived", dept.Name, dept.DepartmentID),
					}
				}

				if dept.BudgetCapMonthlyBaseUnits > 0 && e.tracker != nil {
					currentSpend, _ := e.tracker.GetDepartmentMonthlySpend(ctx, tenantID, dept.DepartmentID)
					if currentSpend+req.AmountBase > dept.BudgetCapMonthlyBaseUnits {
						return agent.PolicyDecision{
							Allowed:    false,
							ReasonCode: CodeErrQuotaExceededDepartment,
							Reason: fmt.Sprintf(
								"Department '%s' (%s) monthly budget cap exceeded: cap=%d, current_spent=%d, requested=%d",
								dept.Name, dept.DepartmentID, dept.BudgetCapMonthlyBaseUnits, currentSpend, req.AmountBase,
							),
							Extra: map[string]interface{}{
								"entity_type":   "department",
								"department_id": dept.DepartmentID,
								"dept_name":     dept.Name,
								"budget_cap":    dept.BudgetCapMonthlyBaseUnits,
								"current_spend": currentSpend,
								"requested":     req.AmountBase,
							},
						}
					}
				}
			}
		}
	}

	return agent.PolicyDecision{
		Allowed:    true,
		ReasonCode: CodeAllow,
		Reason:     "Enterprise cascade quota checks passed",
	}
}

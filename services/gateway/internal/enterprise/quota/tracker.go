package quota

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// BudgetTracker tracks accumulated expenditure across projects and departments.
type BudgetTracker interface {
	GetProjectMonthlySpend(ctx context.Context, tenantID, projectID string) (int64, error)
	AddProjectSpend(ctx context.Context, tenantID, projectID string, amount int64) error
	GetDepartmentMonthlySpend(ctx context.Context, tenantID, deptID string) (int64, error)
	AddDepartmentSpend(ctx context.Context, tenantID, deptID string, amount int64) error
	Reset() // Clears state (useful for testing)
}

// MemoryBudgetTracker is a thread-safe in-memory budget spend tracker.
type MemoryBudgetTracker struct {
	mu        sync.RWMutex
	projSpend map[string]int64 // key: tenantID:projectID:YYYYMM
	deptSpend map[string]int64 // key: tenantID:deptID:YYYYMM
}

// NewMemoryBudgetTracker creates a new in-memory budget tracker.
func NewMemoryBudgetTracker() *MemoryBudgetTracker {
	return &MemoryBudgetTracker{
		projSpend: make(map[string]int64),
		deptSpend: make(map[string]int64),
	}
}

func currentMonthKey(tenantID, entityID string) string {
	now := time.Now().UTC()
	return fmt.Sprintf("%s:%s:%04d%02d", tenantID, entityID, now.Year(), now.Month())
}

func (t *MemoryBudgetTracker) GetProjectMonthlySpend(_ context.Context, tenantID, projectID string) (int64, error) {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.projSpend[currentMonthKey(tenantID, projectID)], nil
}

func (t *MemoryBudgetTracker) AddProjectSpend(_ context.Context, tenantID, projectID string, amount int64) error {
	t.mu.Lock()
	defer t.mu.Unlock()
	key := currentMonthKey(tenantID, projectID)
	t.projSpend[key] += amount
	return nil
}

func (t *MemoryBudgetTracker) GetDepartmentMonthlySpend(_ context.Context, tenantID, deptID string) (int64, error) {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.deptSpend[currentMonthKey(tenantID, deptID)], nil
}

func (t *MemoryBudgetTracker) AddDepartmentSpend(_ context.Context, tenantID, deptID string, amount int64) error {
	t.mu.Lock()
	defer t.mu.Unlock()
	key := currentMonthKey(tenantID, deptID)
	t.deptSpend[key] += amount
	return nil
}

func (t *MemoryBudgetTracker) Reset() {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.projSpend = make(map[string]int64)
	t.deptSpend = make(map[string]int64)
}

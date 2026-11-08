package quota

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
)

// Project represents an organizational project entity in AgentFinOps.
type Project struct {
	ProjectID          string `json:"project_id"`
	TenantID           string `json:"tenant_id"`
	DepartmentID       string `json:"department_id,omitempty"`
	Name               string `json:"name"`
	BudgetCapBaseUnits int64  `json:"budget_cap_base_units"` // 0 = unlimited
	Status             string `json:"status"`                // "active", "archived"
}

// ProjectStore provides access to project metadata.
type ProjectStore interface {
	GetProject(ctx context.Context, tenantID, projectID string) (*Project, error)
	UpsertProject(ctx context.Context, project *Project) error
}

// MemoryProjectStore is an in-memory thread-safe implementation of ProjectStore.
type MemoryProjectStore struct {
	mu       sync.RWMutex
	projects map[string]*Project // key: tenantID + ":" + projectID
}

// NewMemoryProjectStore creates a new in-memory project store.
func NewMemoryProjectStore() *MemoryProjectStore {
	return &MemoryProjectStore{
		projects: make(map[string]*Project),
	}
}

func (s *MemoryProjectStore) GetProject(_ context.Context, tenantID, projectID string) (*Project, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	key := tenantID + ":" + projectID
	proj, ok := s.projects[key]
	if !ok {
		return nil, fmt.Errorf("project not found: %s", projectID)
	}
	// Return a copy
	cp := *proj
	return &cp, nil
}

func (s *MemoryProjectStore) UpsertProject(_ context.Context, project *Project) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	key := project.TenantID + ":" + project.ProjectID
	cp := *project
	s.projects[key] = &cp
	return nil
}

// PostgresProjectStore queries PostgreSQL for project details.
type PostgresProjectStore struct {
	db *sql.DB
}

// NewPostgresProjectStore creates a PostgreSQL-backed project store.
func NewPostgresProjectStore(db *sql.DB) *PostgresProjectStore {
	return &PostgresProjectStore{db: db}
}

func (s *PostgresProjectStore) GetProject(ctx context.Context, tenantID, projectID string) (*Project, error) {
	query := `
		SELECT project_id, tenant_id, COALESCE(department_id, ''), name, budget_cap_base_units, status
		FROM ap_project
		WHERE tenant_id = $1 AND project_id = $2
	`
	var p Project
	err := s.db.QueryRowContext(ctx, query, tenantID, projectID).Scan(
		&p.ProjectID,
		&p.TenantID,
		&p.DepartmentID,
		&p.Name,
		&p.BudgetCapBaseUnits,
		&p.Status,
	)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *PostgresProjectStore) UpsertProject(ctx context.Context, p *Project) error {
	query := `
		INSERT INTO ap_project (project_id, tenant_id, department_id, name, budget_cap_base_units, status)
		VALUES ($1, $2, NULLIF($3, ''), $4, $5, $6)
		ON CONFLICT (project_id) DO UPDATE SET
			department_id = NULLIF(EXCLUDED.department_id, ''),
			name = EXCLUDED.name,
			budget_cap_base_units = EXCLUDED.budget_cap_base_units,
			status = EXCLUDED.status
	`
	_, err := s.db.ExecContext(ctx, query,
		p.ProjectID,
		p.TenantID,
		p.DepartmentID,
		p.Name,
		p.BudgetCapBaseUnits,
		p.Status,
	)
	return err
}

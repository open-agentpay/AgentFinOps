package department

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"
)

type Service interface {
	CreateDepartment(ctx context.Context, tenantID, name string, parentID *string, budgetCapMonthly int64, departmentID string) (*Department, error)
	GetDepartment(ctx context.Context, tenantID, departmentID string) (*Department, error)
	ListDepartments(ctx context.Context, tenantID string) ([]*Department, error)
	UpdateDepartment(ctx context.Context, tenantID, departmentID string, name string, parentID *string, budgetCapMonthly *int64, status *DepartmentStatus) (*Department, error)
	DeleteDepartment(ctx context.Context, tenantID, departmentID string) error
	GetDepartmentAncestors(ctx context.Context, tenantID, departmentID string) ([]*Department, error)
}

// ----------------------------------------------------------------------------
// In-Memory Implementation
// ----------------------------------------------------------------------------

type MemoryService struct {
	mu          sync.RWMutex
	departments map[string]*Department
}

func NewMemoryService() *MemoryService {
	return &MemoryService{
		departments: make(map[string]*Department),
	}
}

func (s *MemoryService) CreateDepartment(ctx context.Context, tenantID, name string, parentID *string, budgetCapMonthly int64, departmentID string) (*Department, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	cleanName := strings.TrimSpace(name)
	if cleanName == "" {
		return nil, fmt.Errorf("department name cannot be empty")
	}

	for _, d := range s.departments {
		if d.TenantID == tenantID && d.Name == cleanName {
			return nil, ErrDepartmentAlreadyExists
		}
	}

	if parentID != nil && *parentID != "" {
		p, ok := s.departments[*parentID]
		if !ok || p.TenantID != tenantID {
			return nil, ErrDepartmentNotFound
		}
	}

	did := departmentID
	if did == "" {
		did = GenerateDepartmentID()
	}

	now := time.Now().Unix()
	dept := &Department{
		DepartmentID:              did,
		TenantID:                  tenantID,
		ParentID:                  parentID,
		Name:                      cleanName,
		BudgetCapMonthlyBaseUnits: budgetCapMonthly,
		Status:                    DepartmentStatusActive,
		CreatedAt:                 now,
		UpdatedAt:                 now,
	}
	s.departments[did] = dept
	return dept, nil
}

func (s *MemoryService) GetDepartment(ctx context.Context, tenantID, departmentID string) (*Department, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	d, ok := s.departments[departmentID]
	if !ok {
		return nil, ErrDepartmentNotFound
	}
	if tenantID != "" && d.TenantID != tenantID {
		return nil, ErrDepartmentTenantMismatch
	}
	return d, nil
}

func (s *MemoryService) ListDepartments(ctx context.Context, tenantID string) ([]*Department, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	res := make([]*Department, 0)
	for _, d := range s.departments {
		if tenantID == "" || d.TenantID == tenantID {
			res = append(res, d)
		}
	}
	return res, nil
}

func (s *MemoryService) UpdateDepartment(ctx context.Context, tenantID, departmentID string, name string, parentID *string, budgetCapMonthly *int64, status *DepartmentStatus) (*Department, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	d, ok := s.departments[departmentID]
	if !ok {
		return nil, ErrDepartmentNotFound
	}
	if d.TenantID != tenantID {
		return nil, ErrDepartmentTenantMismatch
	}

	if name != "" {
		cleanName := strings.TrimSpace(name)
		for _, other := range s.departments {
			if other.DepartmentID != departmentID && other.TenantID == tenantID && other.Name == cleanName {
				return nil, ErrDepartmentAlreadyExists
			}
		}
		d.Name = cleanName
	}

	if parentID != nil {
		if *parentID != "" {
			if *parentID == departmentID {
				return nil, ErrDepartmentCycleDetected
			}
			// Cycle check: walk up ancestor tree
			curr := *parentID
			for curr != "" {
				if curr == departmentID {
					return nil, ErrDepartmentCycleDetected
				}
				parentDept, ok := s.departments[curr]
				if !ok || parentDept.TenantID != tenantID {
					return nil, ErrDepartmentNotFound
				}
				if parentDept.ParentID == nil {
					break
				}
				curr = *parentDept.ParentID
			}
			d.ParentID = parentID
		} else {
			d.ParentID = nil
		}
	}

	if budgetCapMonthly != nil {
		d.BudgetCapMonthlyBaseUnits = *budgetCapMonthly
	}
	if status != nil {
		d.Status = *status
	}
	d.UpdatedAt = time.Now().Unix()
	return d, nil
}

func (s *MemoryService) DeleteDepartment(ctx context.Context, tenantID, departmentID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	d, ok := s.departments[departmentID]
	if !ok {
		return ErrDepartmentNotFound
	}
	if d.TenantID != tenantID {
		return ErrDepartmentTenantMismatch
	}

	// Unlink children
	for _, child := range s.departments {
		if child.ParentID != nil && *child.ParentID == departmentID {
			child.ParentID = nil
		}
	}

	delete(s.departments, departmentID)
	return nil
}

func (s *MemoryService) GetDepartmentAncestors(ctx context.Context, tenantID, departmentID string) ([]*Department, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	ancestors := make([]*Department, 0)
	currID := departmentID
	visited := make(map[string]bool)

	for currID != "" {
		if visited[currID] {
			return nil, ErrDepartmentCycleDetected
		}
		visited[currID] = true

		d, ok := s.departments[currID]
		if !ok || d.TenantID != tenantID {
			break
		}
		ancestors = append(ancestors, d)
		if d.ParentID == nil {
			break
		}
		currID = *d.ParentID
	}
	return ancestors, nil
}

// ----------------------------------------------------------------------------
// PostgreSQL Implementation
// ----------------------------------------------------------------------------

type PostgresService struct {
	db *sql.DB
}

func NewPostgresService(db *sql.DB) *PostgresService {
	svc := &PostgresService{db: db}
	_ = svc.InitSchema(context.Background())
	return svc
}

// InitSchema ensures that ap_department, related foreign keys, indexes, triggers, and HITL tables exist.
func (p *PostgresService) InitSchema(ctx context.Context) error {
	ddl := `
	CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
	RETURNS TRIGGER AS $$
	BEGIN
		NEW.updated_at = CURRENT_TIMESTAMP;
		RETURN NEW;
	END;
	$$ LANGUAGE plpgsql;

	CREATE TABLE IF NOT EXISTS ap_tenant (
		tenant_id VARCHAR(64) PRIMARY KEY,
		name VARCHAR(128) NOT NULL,
		currency VARCHAR(16) NOT NULL DEFAULT 'CNY',
		status VARCHAR(32) NOT NULL DEFAULT 'active',
		created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	DO $$
	BEGIN
		IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tenant_updated_at') THEN
			CREATE TRIGGER trg_tenant_updated_at BEFORE UPDATE ON ap_tenant
				FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
		END IF;
	END $$;

	CREATE TABLE IF NOT EXISTS ap_department (
		department_id VARCHAR(64) PRIMARY KEY,
		tenant_id VARCHAR(64) NOT NULL REFERENCES ap_tenant(tenant_id) ON DELETE CASCADE,
		parent_id VARCHAR(64) NULL REFERENCES ap_department(department_id) ON DELETE CASCADE,
		name VARCHAR(128) NOT NULL,
		budget_cap_monthly_base_units BIGINT NOT NULL DEFAULT 0 CHECK (budget_cap_monthly_base_units >= 0),
		status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
		created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
		CONSTRAINT uq_tenant_department_name UNIQUE (tenant_id, name)
	);

	CREATE INDEX IF NOT EXISTS idx_department_tenant ON ap_department(tenant_id);
	CREATE INDEX IF NOT EXISTS idx_department_parent ON ap_department(parent_id);

	DO $$
	BEGIN
		IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_department_updated_at') THEN
			CREATE TRIGGER trg_department_updated_at BEFORE UPDATE ON ap_department
				FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
		END IF;
	END $$;

	CREATE TABLE IF NOT EXISTS ap_project (
		project_id VARCHAR(64) PRIMARY KEY,
		tenant_id VARCHAR(64) NOT NULL REFERENCES ap_tenant(tenant_id) ON DELETE CASCADE,
		department_id VARCHAR(64) NULL REFERENCES ap_department(department_id) ON DELETE SET NULL,
		name VARCHAR(128) NOT NULL,
		budget_cap_base_units BIGINT NOT NULL DEFAULT 0 CHECK (budget_cap_base_units >= 0),
		status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
		created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
		CONSTRAINT uq_tenant_project_name UNIQUE (tenant_id, name)
	);

	CREATE INDEX IF NOT EXISTS idx_project_tenant ON ap_project(tenant_id);
	CREATE INDEX IF NOT EXISTS idx_project_department ON ap_project(department_id);

	DO $$
	BEGIN
		IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_project_updated_at') THEN
			CREATE TRIGGER trg_project_updated_at BEFORE UPDATE ON ap_project
				FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
		END IF;
	END $$;

	DO $$
	BEGIN
		IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ap_project') THEN
			ALTER TABLE ap_project ADD COLUMN IF NOT EXISTS department_id VARCHAR(64) NULL REFERENCES ap_department(department_id) ON DELETE SET NULL;
			CREATE INDEX IF NOT EXISTS idx_project_department ON ap_project(department_id);
		END IF;

		IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ap_payment_intent') THEN
			ALTER TABLE ap_payment_intent ADD COLUMN IF NOT EXISTS department_id VARCHAR(64) NULL REFERENCES ap_department(department_id) ON DELETE SET NULL;
			CREATE INDEX IF NOT EXISTS idx_intent_department ON ap_payment_intent(department_id);
		END IF;

		IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ap_usage_event') THEN
			ALTER TABLE ap_usage_event ADD COLUMN IF NOT EXISTS department_id VARCHAR(64) NULL REFERENCES ap_department(department_id) ON DELETE SET NULL;
			CREATE INDEX IF NOT EXISTS idx_usage_department ON ap_usage_event(department_id, created_at);
		END IF;

		IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ap_agent_audit_event') THEN
			ALTER TABLE ap_agent_audit_event ADD COLUMN IF NOT EXISTS department_id VARCHAR(64) NULL REFERENCES ap_department(department_id) ON DELETE SET NULL;
			CREATE INDEX IF NOT EXISTS idx_agent_audit_department ON ap_agent_audit_event(department_id, occurred_at DESC);
		END IF;
	END $$;

	CREATE TABLE IF NOT EXISTS ap_approval_request (
		approval_id VARCHAR(64) PRIMARY KEY,
		tenant_id VARCHAR(64) NOT NULL REFERENCES ap_tenant(tenant_id) ON DELETE CASCADE,
		department_id VARCHAR(64) NULL REFERENCES ap_department(department_id) ON DELETE SET NULL,
		project_id VARCHAR(64) NOT NULL REFERENCES ap_project(project_id) ON DELETE CASCADE,
		agent_id VARCHAR(64) NOT NULL REFERENCES ap_agent(agent_id) ON DELETE CASCADE,
		intent_id VARCHAR(64) NULL,
		amount_base_units BIGINT NOT NULL CHECK (amount_base_units > 0),
		asset VARCHAR(16) NOT NULL DEFAULT 'CNY',
		status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'consumed')),
		trigger_reason VARCHAR(64) NOT NULL DEFAULT 'threshold_exceeded',
		channel VARCHAR(32) NULL,
		card_msg_id VARCHAR(128) NULL,
		decided_by VARCHAR(64) NULL,
		decided_at TIMESTAMPTZ NULL,
		rejection_reason TEXT NULL,
		nonce VARCHAR(64) NOT NULL,
		expires_at TIMESTAMPTZ NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
		CONSTRAINT uq_approval_nonce UNIQUE (tenant_id, nonce)
	);

	CREATE INDEX IF NOT EXISTS idx_approval_status ON ap_approval_request(tenant_id, status);
	CREATE INDEX IF NOT EXISTS idx_approval_agent ON ap_approval_request(agent_id, created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_approval_department ON ap_approval_request(department_id);

	DO $$
	BEGIN
		IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_approval_updated_at') THEN
			CREATE TRIGGER trg_approval_updated_at BEFORE UPDATE ON ap_approval_request
				FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
		END IF;
	END $$;
	`
	_, err := p.db.ExecContext(ctx, ddl)
	return err
}

func (p *PostgresService) CreateDepartment(ctx context.Context, tenantID, name string, parentID *string, budgetCapMonthly int64, departmentID string) (*Department, error) {
	cleanName := strings.TrimSpace(name)
	if cleanName == "" {
		return nil, fmt.Errorf("department name cannot be empty")
	}

	var exists bool
	_ = p.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM ap_department WHERE tenant_id = $1 AND name = $2);`, tenantID, cleanName).Scan(&exists)
	if exists {
		return nil, ErrDepartmentAlreadyExists
	}

	if parentID != nil && *parentID != "" {
		var parentExists bool
		_ = p.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM ap_department WHERE tenant_id = $1 AND department_id = $2);`, tenantID, *parentID).Scan(&parentExists)
		if !parentExists {
			return nil, ErrDepartmentNotFound
		}
	}

	did := departmentID
	if did == "" {
		did = GenerateDepartmentID()
	}

	now := time.Now()
	nowUnix := now.Unix()
	if _, err := p.db.ExecContext(ctx, `
		INSERT INTO ap_department (department_id, tenant_id, parent_id, name, budget_cap_monthly_base_units, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, 'active', $6, $6);
	`, did, tenantID, parentID, cleanName, budgetCapMonthly, now); err != nil {
		return nil, err
	}

	return &Department{
		DepartmentID:              did,
		TenantID:                  tenantID,
		ParentID:                  parentID,
		Name:                      cleanName,
		BudgetCapMonthlyBaseUnits: budgetCapMonthly,
		Status:                    DepartmentStatusActive,
		CreatedAt:                 nowUnix,
		UpdatedAt:                 nowUnix,
	}, nil
}

func (p *PostgresService) GetDepartment(ctx context.Context, tenantID, departmentID string) (*Department, error) {
	var dept Department
	err := p.db.QueryRowContext(ctx, `
		SELECT department_id, tenant_id, parent_id, name, budget_cap_monthly_base_units, status,
		       EXTRACT(EPOCH FROM created_at)::bigint, EXTRACT(EPOCH FROM updated_at)::bigint
		FROM ap_department
		WHERE department_id = $1;
	`, departmentID).Scan(
		&dept.DepartmentID, &dept.TenantID, &dept.ParentID, &dept.Name, &dept.BudgetCapMonthlyBaseUnits, &dept.Status, &dept.CreatedAt, &dept.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrDepartmentNotFound
	}
	if err != nil {
		return nil, err
	}
	if tenantID != "" && dept.TenantID != tenantID {
		return nil, ErrDepartmentTenantMismatch
	}
	return &dept, nil
}

func (p *PostgresService) ListDepartments(ctx context.Context, tenantID string) ([]*Department, error) {
	rows, err := p.db.QueryContext(ctx, `
		SELECT department_id, tenant_id, parent_id, name, budget_cap_monthly_base_units, status,
		       EXTRACT(EPOCH FROM created_at)::bigint, EXTRACT(EPOCH FROM updated_at)::bigint
		FROM ap_department
		WHERE tenant_id = $1
		ORDER BY created_at ASC;
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	depts := make([]*Department, 0)
	for rows.Next() {
		var dept Department
		if err := rows.Scan(&dept.DepartmentID, &dept.TenantID, &dept.ParentID, &dept.Name, &dept.BudgetCapMonthlyBaseUnits, &dept.Status, &dept.CreatedAt, &dept.UpdatedAt); err != nil {
			return nil, err
		}
		depts = append(depts, &dept)
	}
	return depts, nil
}

func (p *PostgresService) UpdateDepartment(ctx context.Context, tenantID, departmentID string, name string, parentID *string, budgetCapMonthly *int64, status *DepartmentStatus) (*Department, error) {
	dept, err := p.GetDepartment(ctx, tenantID, departmentID)
	if err != nil {
		return nil, err
	}

	if name != "" {
		cleanName := strings.TrimSpace(name)
		var exists bool
		_ = p.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM ap_department WHERE tenant_id = $1 AND name = $2 AND department_id != $3);`, tenantID, cleanName, departmentID).Scan(&exists)
		if exists {
			return nil, ErrDepartmentAlreadyExists
		}
		dept.Name = cleanName
	}

	if parentID != nil {
		if *parentID != "" {
			if *parentID == departmentID {
				return nil, ErrDepartmentCycleDetected
			}
			curr := *parentID
			for curr != "" {
				if curr == departmentID {
					return nil, ErrDepartmentCycleDetected
				}
				var parentOfCurr *string
				err := p.db.QueryRowContext(ctx, `SELECT parent_id FROM ap_department WHERE tenant_id = $1 AND department_id = $2;`, tenantID, curr).Scan(&parentOfCurr)
				if errors.Is(err, sql.ErrNoRows) {
					return nil, ErrDepartmentNotFound
				}
				if err != nil {
					return nil, err
				}
				if parentOfCurr == nil {
					break
				}
				curr = *parentOfCurr
			}
			dept.ParentID = parentID
		} else {
			dept.ParentID = nil
		}
	}

	if budgetCapMonthly != nil {
		dept.BudgetCapMonthlyBaseUnits = *budgetCapMonthly
	}
	if status != nil {
		dept.Status = *status
	}

	if _, err := p.db.ExecContext(ctx, `
		UPDATE ap_department
		SET name = $1, parent_id = $2, budget_cap_monthly_base_units = $3, status = $4, updated_at = NOW()
		WHERE department_id = $5;
	`, dept.Name, dept.ParentID, dept.BudgetCapMonthlyBaseUnits, string(dept.Status), departmentID); err != nil {
		return nil, err
	}

	dept.UpdatedAt = time.Now().Unix()
	return dept, nil
}

func (p *PostgresService) DeleteDepartment(ctx context.Context, tenantID, departmentID string) error {
	_, err := p.GetDepartment(ctx, tenantID, departmentID)
	if err != nil {
		return err
	}

	_, err = p.db.ExecContext(ctx, `DELETE FROM ap_department WHERE department_id = $1 AND tenant_id = $2;`, departmentID, tenantID)
	return err
}

func (p *PostgresService) GetDepartmentAncestors(ctx context.Context, tenantID, departmentID string) ([]*Department, error) {
	ancestors := make([]*Department, 0)
	currID := departmentID
	visited := make(map[string]bool)

	for currID != "" {
		if visited[currID] {
			return nil, ErrDepartmentCycleDetected
		}
		visited[currID] = true

		d, err := p.GetDepartment(ctx, tenantID, currID)
		if err != nil {
			break
		}
		ancestors = append(ancestors, d)
		if d.ParentID == nil {
			break
		}
		currID = *d.ParentID
	}
	return ancestors, nil
}

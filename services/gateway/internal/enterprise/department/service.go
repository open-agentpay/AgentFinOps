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
	return &PostgresService{db: db}
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

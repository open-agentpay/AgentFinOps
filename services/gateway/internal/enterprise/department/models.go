package department

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
)

var (
	ErrDepartmentNotFound       = errors.New("department not found")
	ErrDepartmentAlreadyExists  = errors.New("department with same name already exists in tenant")
	ErrDepartmentArchived       = errors.New("department is archived")
	ErrDepartmentTenantMismatch = errors.New("department does not belong to specified tenant")
	ErrDepartmentCycleDetected  = errors.New("department hierarchy cycle detected")
)

type DepartmentStatus string

const (
	DepartmentStatusActive   DepartmentStatus = "active"
	DepartmentStatusArchived DepartmentStatus = "archived"
)

type Department struct {
	DepartmentID              string           `json:"department_id"`
	TenantID                  string           `json:"tenant_id"`
	ParentID                  *string          `json:"parent_id,omitempty"`
	Name                      string           `json:"name"`
	BudgetCapMonthlyBaseUnits int64            `json:"budget_cap_monthly_base_units"`
	Status                    DepartmentStatus `json:"status"`
	CreatedAt                 int64            `json:"created_at"`
	UpdatedAt                 int64            `json:"updated_at"`
}

func GenerateDepartmentID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return fmt.Sprintf("dept_%s", hex.EncodeToString(b))
}

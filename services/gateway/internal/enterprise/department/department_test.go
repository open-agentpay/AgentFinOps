package department

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDepartmentMemoryService(t *testing.T) {
	ctx := context.Background()
	svc := NewMemoryService()

	// 1. Create Root Department
	root, err := svc.CreateDepartment(ctx, "ten_01", "研发部", nil, 50000000, "dept_rd")
	if err != nil {
		t.Fatalf("CreateDepartment root failed: %v", err)
	}
	if root.DepartmentID != "dept_rd" || root.BudgetCapMonthlyBaseUnits != 50000000 {
		t.Errorf("Unexpected root dept: %+v", root)
	}

	// 2. Duplicate Name in same tenant should fail
	_, err = svc.CreateDepartment(ctx, "ten_01", "研发部", nil, 10000, "")
	if err != ErrDepartmentAlreadyExists {
		t.Errorf("Expected ErrDepartmentAlreadyExists, got %v", err)
	}

	// 3. Create Child Department
	child, err := svc.CreateDepartment(ctx, "ten_01", "AI实验室", &root.DepartmentID, 20000000, "dept_ai")
	if err != nil {
		t.Fatalf("Create child department failed: %v", err)
	}
	if child.ParentID == nil || *child.ParentID != root.DepartmentID {
		t.Errorf("Expected parent ID %s, got %v", root.DepartmentID, child.ParentID)
	}

	// 4. Create Sub-Child Department
	subChild, err := svc.CreateDepartment(ctx, "ten_01", "LLM智能体组", &child.DepartmentID, 10000000, "dept_llm")
	if err != nil {
		t.Fatalf("Create sub-child department failed: %v", err)
	}

	// 5. Test Ancestor Hierarchy Walk
	ancestors, err := svc.GetDepartmentAncestors(ctx, "ten_01", subChild.DepartmentID)
	if err != nil {
		t.Fatalf("GetDepartmentAncestors failed: %v", err)
	}
	if len(ancestors) != 3 {
		t.Fatalf("Expected 3 ancestors (self -> parent -> root), got %d", len(ancestors))
	}
	if ancestors[0].DepartmentID != "dept_llm" || ancestors[1].DepartmentID != "dept_ai" || ancestors[2].DepartmentID != "dept_rd" {
		t.Errorf("Ancestors chain order incorrect: %+v", ancestors)
	}

	// 6. Test Cycle Detection
	_, err = svc.UpdateDepartment(ctx, "ten_01", root.DepartmentID, "", &subChild.DepartmentID, nil, nil)
	if err != ErrDepartmentCycleDetected {
		t.Errorf("Expected ErrDepartmentCycleDetected, got %v", err)
	}

	// 7. Test Self Cycle
	_, err = svc.UpdateDepartment(ctx, "ten_01", root.DepartmentID, "", &root.DepartmentID, nil, nil)
	if err != ErrDepartmentCycleDetected {
		t.Errorf("Expected ErrDepartmentCycleDetected for self, got %v", err)
	}

	// 8. Test Delete unlinks child
	if err := svc.DeleteDepartment(ctx, "ten_01", child.DepartmentID); err != nil {
		t.Fatalf("DeleteDepartment failed: %v", err)
	}
	refreshedSubChild, err := svc.GetDepartment(ctx, "ten_01", subChild.DepartmentID)
	if err != nil {
		t.Fatalf("GetDepartment failed: %v", err)
	}
	if refreshedSubChild.ParentID != nil {
		t.Errorf("Expected deleted parent to unlink, got: %v", *refreshedSubChild.ParentID)
	}
}

func TestDepartmentHTTPHandler(t *testing.T) {
	svc := NewMemoryService()
	h := NewHandler(svc)

	// POST /api/v1/tenants/ten_demo/departments
	createBody := map[string]interface{}{
		"name":                          "运营中心",
		"budget_cap_monthly_base_units": 30000000,
	}
	bodyBytes, _ := json.Marshal(createBody)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/tenants/ten_demo/departments", bytes.NewReader(bodyBytes))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("Expected StatusCreated 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var createResp struct {
		Department Department `json:"department"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &createResp)
	if createResp.Department.Name != "运营中心" {
		t.Errorf("Expected 运营中心, got %s", createResp.Department.Name)
	}

	// GET /api/v1/tenants/ten_demo/departments
	reqGet := httptest.NewRequest(http.MethodGet, "/api/v1/tenants/ten_demo/departments", nil)
	recGet := httptest.NewRecorder()
	h.ServeHTTP(recGet, reqGet)

	if recGet.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d", recGet.Code)
	}
}

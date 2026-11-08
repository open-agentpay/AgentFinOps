package department

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
)

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// NewHTTPHandler is an alias for NewHandler for explicit naming.
func NewHTTPHandler(svc Service) *Handler {
	return NewHandler(svc)
}

// ServeHTTP handles requests under /api/v1/tenants/{tenantID}/departments.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Path pattern: /api/v1/tenants/{tenantID}/departments[/{deptID}]
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	// Expected parts: ["api", "v1", "tenants", tenantID, "departments", ...optional deptID]
	if len(parts) < 5 || parts[2] != "tenants" || parts[4] != "departments" {
		http.NotFound(w, r)
		return
	}

	tenantID := parts[3]
	var deptID string
	if len(parts) >= 6 {
		deptID = parts[5]
	}

	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case http.MethodGet:
		if deptID == "" {
			depts, err := h.svc.ListDepartments(r.Context(), tenantID)
			if err != nil {
				h.writeError(w, http.StatusInternalServerError, err)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"departments": depts})
			return
		}
		dept, err := h.svc.GetDepartment(r.Context(), tenantID, deptID)
		if err != nil {
			h.handleDomainError(w, err)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"department": dept})

	case http.MethodPost:
		if deptID != "" {
			http.Error(w, `{"error":{"message":"Method not allowed"}}`, http.StatusMethodNotAllowed)
			return
		}
		var body struct {
			Name                      string  `json:"name"`
			ParentID                  *string `json:"parent_id"`
			BudgetCapMonthlyBaseUnits int64   `json:"budget_cap_monthly_base_units"`
			DepartmentID              string  `json:"department_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, `{"error":{"message":"Invalid JSON payload"}}`, http.StatusBadRequest)
			return
		}
		dept, err := h.svc.CreateDepartment(r.Context(), tenantID, body.Name, body.ParentID, body.BudgetCapMonthlyBaseUnits, body.DepartmentID)
		if err != nil {
			h.handleDomainError(w, err)
			return
		}
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"department": dept})

	case http.MethodPatch:
		if deptID == "" {
			http.Error(w, `{"error":{"message":"Department ID is required"}}`, http.StatusBadRequest)
			return
		}
		var body struct {
			Name                      string            `json:"name"`
			ParentID                  *string           `json:"parent_id"`
			BudgetCapMonthlyBaseUnits *int64            `json:"budget_cap_monthly_base_units"`
			Status                    *DepartmentStatus `json:"status"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, `{"error":{"message":"Invalid JSON payload"}}`, http.StatusBadRequest)
			return
		}
		dept, err := h.svc.UpdateDepartment(r.Context(), tenantID, deptID, body.Name, body.ParentID, body.BudgetCapMonthlyBaseUnits, body.Status)
		if err != nil {
			h.handleDomainError(w, err)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"department": dept})

	case http.MethodDelete:
		if deptID == "" {
			http.Error(w, `{"error":{"message":"Department ID is required"}}`, http.StatusBadRequest)
			return
		}
		if err := h.svc.DeleteDepartment(r.Context(), tenantID, deptID); err != nil {
			h.handleDomainError(w, err)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"deleted": true, "department_id": deptID})

	default:
		http.Error(w, `{"error":{"message":"Method not allowed"}}`, http.StatusMethodNotAllowed)
	}
}

func (h *Handler) handleDomainError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrDepartmentNotFound):
		h.writeError(w, http.StatusNotFound, err)
	case errors.Is(err, ErrDepartmentAlreadyExists):
		h.writeError(w, http.StatusConflict, err)
	case errors.Is(err, ErrDepartmentCycleDetected):
		h.writeError(w, http.StatusBadRequest, err)
	case errors.Is(err, ErrDepartmentTenantMismatch):
		h.writeError(w, http.StatusForbidden, err)
	default:
		h.writeError(w, http.StatusInternalServerError, err)
	}
}

func (h *Handler) writeError(w http.ResponseWriter, status int, err error) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"error": map[string]interface{}{
			"message": err.Error(),
		},
	})
}

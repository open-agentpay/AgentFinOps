package payment

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/open-agentpay/agent-core-sdk/gateway/admin"
	"github.com/open-agentpay/agent-core-sdk/gateway/wallet"
)

// Handler handles payment-related HTTP requests and binds to Core services.
type Handler struct {
	mu              sync.RWMutex
	providers       map[string]PaymentProvider
	defaultProvider PaymentProvider
	adminSvc        admin.Service
	walletSvc       wallet.Service
}

// NewHandler creates a new payment handler.
func NewHandler(defaultProvider PaymentProvider) *Handler {
	h := &Handler{
		providers:       make(map[string]PaymentProvider),
		defaultProvider: defaultProvider,
	}
	if defaultProvider != nil {
		h.providers[defaultProvider.Name()] = defaultProvider
	}
	return h
}

// RegisterProvider registers a payment provider by its name.
func (h *Handler) RegisterProvider(p PaymentProvider) {
	if p == nil {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	h.providers[p.Name()] = p
	if h.defaultProvider == nil {
		h.defaultProvider = p
	}
}

// BindServices connects Core admin and wallet services to the payment handler.
func (h *Handler) BindServices(adminSvc admin.Service, walletSvc wallet.Service) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.adminSvc = adminSvc
	h.walletSvc = walletSvc
}

func (h *Handler) getProvider(name string) PaymentProvider {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if name != "" {
		if p, ok := h.providers[name]; ok {
			return p
		}
	}
	return h.defaultProvider
}

func (h *Handler) getWalletService() wallet.Service {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.walletSvc
}

// TenantSubresourceHandler returns an http.Handler mounted at /api/v1/tenants/{tenant_id}/topup-orders
func (h *Handler) TenantSubresourceHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		walletSvc := h.getWalletService()
		if walletSvc == nil {
			writeJSONError(w, http.StatusServiceUnavailable, "wallet service not ready")
			return
		}

		// URL pattern: /api/v1/tenants/{tenant_id}/topup-orders[/{topup_id}]
		path := r.URL.Path
		idx := strings.Index(path, "/tenants/")
		if idx == -1 {
			writeJSONError(w, http.StatusBadRequest, "invalid tenant resource path")
			return
		}

		subpath := path[idx+len("/tenants/"):]
		parts := strings.Split(subpath, "/")
		if len(parts) < 2 || parts[1] != "topup-orders" {
			writeJSONError(w, http.StatusBadRequest, "invalid topup orders path")
			return
		}

		tenantID := parts[0]
		var topupID string
		if len(parts) >= 3 {
			topupID = parts[2]
		}

		switch r.Method {
		case http.MethodPost:
			if topupID != "" {
				writeJSONError(w, http.StatusMethodNotAllowed, "cannot POST to specific topup ID")
				return
			}
			h.handleCreateTopUpOrder(w, r, tenantID, walletSvc)

		case http.MethodGet:
			if topupID != "" {
				h.handleGetTopUpOrder(w, r, topupID, walletSvc)
			} else {
				h.handleListTopUpOrders(w, r, tenantID, walletSvc)
			}

		default:
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	})
}

func (h *Handler) handleCreateTopUpOrder(w http.ResponseWriter, r *http.Request, tenantID string, walletSvc wallet.Service) {
	var body struct {
		AmountCents int64  `json:"amount_cents"`
		Amount      int64  `json:"amount"`
		Channel     string `json:"channel"`
		WalletID    string `json:"wallet_id"`
		Currency    string `json:"currency"`
		Description string `json:"description"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, fmt.Sprintf("invalid json body: %v", err))
		return
	}

	amount := body.AmountCents
	if amount <= 0 {
		amount = body.Amount
	}
	if amount <= 0 {
		writeJSONError(w, http.StatusBadRequest, "amount_cents must be greater than 0")
		return
	}

	currency := strings.ToUpper(strings.TrimSpace(body.Currency))
	if currency == "" {
		currency = "CNY"
	}

	walletID := strings.TrimSpace(body.WalletID)
	if walletID == "" {
		wlt, err := walletSvc.GetWalletByTenant(r.Context(), tenantID)
		if err == nil && wlt != nil {
			walletID = wlt.WalletID
		} else {
			walletID = "wal_" + tenantID
		}
	}

	channel := strings.TrimSpace(body.Channel)
	prov := h.getProvider(channel)
	if prov == nil {
		writeJSONError(w, http.StatusBadRequest, fmt.Sprintf("unsupported or unconfigured payment channel: %s", channel))
		return
	}
	if channel == "" {
		channel = prov.Name()
	}

	now := time.Now()
	// WeChat Pay V3 out_trade_no must be alphanumeric/underscore between 6 and 32 characters.
	// Format: "top_" (4) + YYYYMMDDHHMMSS (14) + "_" (1) + 8 hex chars (8) = 27 characters.
	randBytes := make([]byte, 4)
	_, _ = rand.Read(randBytes)
	topupID := fmt.Sprintf("top_%s_%s", now.Format("20060102150405"), hex.EncodeToString(randBytes))

	slog.Info("creating topup order",
		slog.String("tenant_id", tenantID),
		slog.String("wallet_id", walletID),
		slog.String("channel", channel),
		slog.String("topup_id", topupID),
		slog.Int64("amount_cents", amount),
	)

	order := &wallet.TopUpOrder{
		TopUpID:            topupID,
		WalletID:           walletID,
		TenantID:           tenantID,
		Channel:            wallet.TopUpChannel(channel),
		Amount:             amount,
		Asset:              currency,
		PaymentCurrency:    currency,
		PaymentMinorAmount: amount,
		Status:             wallet.TopUpStatusPending,
		CreatedAt:          now,
	}

	if err := walletSvc.CreatePendingTopUp(r.Context(), order); err != nil {
		slog.Error("failed to create pending topup order in DB",
			slog.String("tenant_id", tenantID),
			slog.String("topup_id", topupID),
			slog.Any("error", err),
		)
		writeJSONError(w, http.StatusInternalServerError, fmt.Sprintf("failed to create pending topup order: %v", err))
		return
	}

	prepayReq := &PrepayOrderRequest{
		TenantID:    tenantID,
		WalletID:    walletID,
		AmountCents: amount,
		Currency:    currency,
		OutTradeNo:  topupID,
		Description: body.Description,
		ClientIP:    r.RemoteAddr,
	}

	slog.Info("calling payment provider prepay",
		slog.String("provider", prov.Name()),
		slog.String("out_trade_no", topupID),
		slog.Int64("amount_cents", amount),
	)

	prepayRes, err := prov.CreatePrepayOrder(r.Context(), prepayReq)
	if err != nil {
		slog.Error("payment provider prepay failed",
			slog.String("provider", prov.Name()),
			slog.String("out_trade_no", topupID),
			slog.Any("error", err),
		)
		writeJSONError(w, http.StatusBadGateway, fmt.Sprintf("payment provider prepay error: %v", err))
		return
	}

	slog.Info("prepay order created successfully",
		slog.String("provider", prov.Name()),
		slog.String("out_trade_no", topupID),
		slog.String("code_url", prepayRes.CodeURL),
		slog.Int64("expires_at", prepayRes.ExpiresAt.Unix()),
	)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"topup_order": order,
		"code_url":    prepayRes.CodeURL,
		"expires_at":  prepayRes.ExpiresAt.Unix(),
	})
}

func (h *Handler) handleGetTopUpOrder(w http.ResponseWriter, r *http.Request, topupID string, walletSvc wallet.Service) {
	order, err := walletSvc.GetTopUpOrderByID(r.Context(), topupID)
	if err != nil || order == nil {
		writeJSONError(w, http.StatusNotFound, "topup order not found")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"topup_order": order,
	})
}

func (h *Handler) handleListTopUpOrders(w http.ResponseWriter, r *http.Request, tenantID string, walletSvc wallet.Service) {
	var walletID string
	wlt, err := walletSvc.GetWalletByTenant(r.Context(), tenantID)
	if err == nil && wlt != nil {
		walletID = wlt.WalletID
	} else {
		walletID = "wal_" + tenantID
	}

	orders, err := walletSvc.GetTopUpOrders(r.Context(), walletID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, fmt.Sprintf("failed to list topup orders: %v", err))
		return
	}

	if orders == nil {
		orders = make([]*wallet.TopUpOrder, 0)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"count": len(orders),
		"items": orders,
	})
}

// MockConfirmHandler returns an http.Handler for POST /api/v1/public/mock-pay/confirm
func (h *Handler) MockConfirmHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}

		walletSvc := h.getWalletService()
		if walletSvc == nil {
			writeJSONError(w, http.StatusServiceUnavailable, "wallet service not ready")
			return
		}

		var req struct {
			OutTradeNo string `json:"out_trade_no"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.OutTradeNo == "" {
			writeJSONError(w, http.StatusBadRequest, "out_trade_no is required")
			return
		}

		order, err := walletSvc.GetTopUpOrderByID(r.Context(), req.OutTradeNo)
		if err != nil || order == nil {
			writeJSONError(w, http.StatusNotFound, "topup order not found")
			return
		}

		if order.Status == wallet.TopUpStatusConfirmed {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"success": true,
				"message": "payment already confirmed",
				"order":   order,
			})
			return
		}

		txID := fmt.Sprintf("mock_tx_%d", time.Now().UnixNano())
		confirmedOrder, err := walletSvc.ConfirmTopUpPayment(r.Context(), order.TopUpID, txID, order.Amount, "mock_pay_topup", time.Now())
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, fmt.Sprintf("failed to confirm topup payment: %v", err))
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "payment confirmed and credited",
			"order":   confirmedOrder,
		})
	})
}

// WeChatWebhookHandler returns an http.Handler for POST /api/v1/public/webhooks/wechat-pay
func (h *Handler) WeChatWebhookHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}

		walletSvc := h.getWalletService()
		if walletSvc == nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"code":    "SYSTEM_ERROR",
				"message": "wallet service not ready",
			})
			return
		}

		prov := h.getProvider("wechat_pay")
		if prov == nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"code":    "NOT_CONFIGURED",
				"message": "wechat pay provider not configured",
			})
			return
		}

		bodyBytes, err := io.ReadAll(r.Body)
		if err != nil {
			slog.Error("failed to read wechat webhook body", slog.Any("error", err))
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"code":    "PARAM_ERROR",
				"message": "failed to read body",
			})
			return
		}

		slog.Info("wechat webhook raw notification received", slog.Int("bytes", len(bodyBytes)))

		result, err := prov.ParseAndVerifyWebhook(r.Context(), r.Header, bodyBytes)
		if err != nil {
			slog.Error("wechat webhook parse/verify failed", slog.Any("error", err), slog.String("raw_body", string(bodyBytes)))
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"code":    "SIGN_ERROR",
				"message": err.Error(),
			})
			return
		}

		_, err = walletSvc.ConfirmTopUpPayment(r.Context(), result.OutTradeNo, result.TransactionID, result.PaidAmountCents, "wechat_pay_topup", result.PaidAt)
		if err != nil {
			slog.Error("wechat webhook failed to confirm and credit wallet",
				slog.String("out_trade_no", result.OutTradeNo),
				slog.String("transaction_id", result.TransactionID),
				slog.Int64("paid_cents", result.PaidAmountCents),
				slog.Any("error", err),
			)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"code":    "SYSTEM_ERROR",
				"message": err.Error(),
			})
			return
		}

		slog.Info("wechat payment successfully confirmed and credited to tenant wallet",
			slog.String("out_trade_no", result.OutTradeNo),
			slog.String("transaction_id", result.TransactionID),
			slog.Int64("amount_cents", result.PaidAmountCents),
			slog.Time("paid_at", result.PaidAt),
		)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"code":    "SUCCESS",
			"message": "成功",
		})
	})
}

func writeJSONError(w http.ResponseWriter, status int, msg string) {
	if status >= 500 {
		slog.Error("payment API response error", slog.Int("status", status), slog.String("message", msg))
	} else if status >= 400 {
		slog.Warn("payment API client rejected", slog.Int("status", status), slog.String("message", msg))
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"error": map[string]interface{}{
			"code":    http.StatusText(status),
			"message": msg,
		},
	})
}

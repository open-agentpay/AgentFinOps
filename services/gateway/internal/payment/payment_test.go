package payment

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/open-agentpay/agent-core-sdk/gateway/wallet"
)

func TestMockPaymentProvider(t *testing.T) {
	mock := NewMockPaymentProvider("https://gate.aipmedia.cn")
	if mock.Name() != "mock" {
		t.Fatalf("expected provider name mock, got %s", mock.Name())
	}

	ctx := context.Background()
	req := &PrepayOrderRequest{
		TenantID:    "ten_test",
		WalletID:    "wlt_test",
		AmountCents: 5000, // 50.00 CNY
		Currency:    "CNY",
		OutTradeNo:  "top_mock_123",
	}

	res, err := mock.CreatePrepayOrder(ctx, req)
	if err != nil {
		t.Fatalf("failed to create mock prepay order: %v", err)
	}
	if res.OutTradeNo != "top_mock_123" {
		t.Errorf("expected out_trade_no top_mock_123, got %s", res.OutTradeNo)
	}
	if res.CodeURL == "" {
		t.Error("expected non-empty CodeURL")
	}

	// Test Webhook
	payload := []byte(`{
		"out_trade_no": "top_mock_123",
		"transaction_id": "tx_mock_999",
		"paid_amount_cents": 5000,
		"payer_id": "usr_test"
	}`)

	whRes, err := mock.ParseAndVerifyWebhook(ctx, http.Header{}, payload)
	if err != nil {
		t.Fatalf("failed to parse mock webhook: %v", err)
	}
	if whRes.OutTradeNo != "top_mock_123" {
		t.Errorf("expected top_mock_123, got %s", whRes.OutTradeNo)
	}
	if whRes.PaidAmountCents != 5000 {
		t.Errorf("expected 5000 cents, got %d", whRes.PaidAmountCents)
	}
	if whRes.TransactionID != "tx_mock_999" {
		t.Errorf("expected tx_mock_999, got %s", whRes.TransactionID)
	}
}

func TestWeChatAESGCMEncryptionAndDecryption(t *testing.T) {
	apiV3Key := "12345678901234567890123456789012" // 32 bytes
	associatedData := "transaction"
	nonce := "123456789012"

	txData := map[string]interface{}{
		"out_trade_no":   "top_wx_001",
		"transaction_id": "4200002131231",
		"trade_state":    "SUCCESS",
		"amount": map[string]interface{}{
			"total":    1000,
			"currency": "CNY",
		},
		"success_time": time.Now().Format(time.RFC3339),
		"payer": map[string]interface{}{
			"openid": "oUpF8uMuAJO_M2pxb1Q9zNjWeS6o",
		},
	}

	rawJSON, err := json.Marshal(txData)
	if err != nil {
		t.Fatalf("failed to marshal tx: %v", err)
	}

	ciphertext, err := EncryptAES256GCM(apiV3Key, associatedData, nonce, rawJSON)
	if err != nil {
		t.Fatalf("failed to encrypt: %v", err)
	}

	decrypted, err := DecryptAES256GCM(apiV3Key, associatedData, nonce, ciphertext)
	if err != nil {
		t.Fatalf("failed to decrypt: %v", err)
	}

	if string(decrypted) != string(rawJSON) {
		t.Fatalf("decrypted text mismatch:\nexpected: %s\ngot: %s", string(rawJSON), string(decrypted))
	}
}

func TestPaymentHandlerFlow(t *testing.T) {
	memWallet := wallet.NewMemoryService()
	memWallet.RegisterWallet(&wallet.Wallet{
		WalletID:       "wal_ten_flow",
		TenantID:       "ten_flow",
		Asset:          "CNY",
		Status:         wallet.StatusActive,
		Version:        1,
		AvailableCache: 0,
		HeldCache:      0,
	})

	mockProv := NewMockPaymentProvider("https://gate.aipmedia.cn")
	handler := NewHandler(mockProv)
	handler.BindServices(nil, memWallet)

	// 1. Create TopUp Order via TenantSubresourceHandler
	createPayload := []byte(`{"amount_cents": 10000, "channel": "mock", "description": "测试充值"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/tenants/ten_flow/topup-orders", bytes.NewReader(createPayload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.TenantSubresourceHandler().ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected status 201 Created, got %d, body: %s", w.Code, w.Body.String())
	}

	var createRes struct {
		TopUpOrder *wallet.TopUpOrder `json:"topup_order"`
		CodeURL    string             `json:"code_url"`
		ExpiresAt  int64              `json:"expires_at"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &createRes); err != nil {
		t.Fatalf("failed to decode create response: %v", err)
	}
	if createRes.TopUpOrder == nil || createRes.TopUpOrder.TopUpID == "" {
		t.Fatalf("missing topup_id in response")
	}
	topupID := createRes.TopUpOrder.TopUpID
	if createRes.TopUpOrder.Amount != 10000 {
		t.Errorf("expected amount 10000, got %d", createRes.TopUpOrder.Amount)
	}
	if createRes.CodeURL == "" {
		t.Errorf("expected non-empty CodeURL")
	}

	// 2. Query TopUp Order Status (pending)
	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/tenants/ten_flow/topup-orders/"+topupID, nil)
	getW := httptest.NewRecorder()
	handler.TenantSubresourceHandler().ServeHTTP(getW, getReq)
	if getW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", getW.Code)
	}

	var getRes struct {
		TopUpOrder *wallet.TopUpOrder `json:"topup_order"`
	}
	_ = json.Unmarshal(getW.Body.Bytes(), &getRes)
	if getRes.TopUpOrder.Status != wallet.TopUpStatusPending {
		t.Errorf("expected pending status, got %s", getRes.TopUpOrder.Status)
	}

	// 3. Confirm Mock Payment via MockConfirmHandler
	confirmPayload := []byte(fmt.Sprintf(`{"out_trade_no": "%s"}`, topupID))
	confReq := httptest.NewRequest(http.MethodPost, "/api/v1/public/mock-pay/confirm", bytes.NewReader(confirmPayload))
	confReq.Header.Set("Content-Type", "application/json")
	confW := httptest.NewRecorder()

	handler.MockConfirmHandler().ServeHTTP(confW, confReq)
	if confW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on confirm, got %d, body: %s", confW.Code, confW.Body.String())
	}

	var confRes struct {
		Success bool               `json:"success"`
		Order   *wallet.TopUpOrder `json:"order"`
	}
	_ = json.Unmarshal(confW.Body.Bytes(), &confRes)
	if !confRes.Success {
		t.Errorf("expected success true")
	}
	if confRes.Order.Status != wallet.TopUpStatusConfirmed {
		t.Errorf("expected status confirmed, got %s", confRes.Order.Status)
	}

	// 4. Verify wallet balance credited in Core
	wlt, err := memWallet.GetWallet(context.Background(), "wal_ten_flow")
	if err != nil {
		t.Fatalf("failed to get wallet: %v", err)
	}
	if wlt.AvailableCache != 10000 {
		t.Errorf("expected wallet balance 10000 cents, got %d", wlt.AvailableCache)
	}
}

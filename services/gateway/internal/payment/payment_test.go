package payment

import (
	"context"
	"encoding/json"
	"net/http"
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
	req := &wallet.PrepayOrderRequest{
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

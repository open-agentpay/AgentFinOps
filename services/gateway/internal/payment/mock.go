package payment

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"
)

// MockPaymentProvider provides a zero-setup sandbox payment simulator.
type MockPaymentProvider struct {
	BaseURL string
}

// NewMockPaymentProvider creates a new mock payment provider.
func NewMockPaymentProvider(baseURL string) *MockPaymentProvider {
	if baseURL == "" {
		baseURL = "https://gate.aipmedia.cn"
	}
	return &MockPaymentProvider{BaseURL: baseURL}
}

func (m *MockPaymentProvider) Name() string {
	return "mock"
}

func (m *MockPaymentProvider) CreatePrepayOrder(ctx context.Context, req *PrepayOrderRequest) (*PrepayOrderResult, error) {
	if req.AmountCents <= 0 {
		return nil, errors.New("payment amount must be greater than 0")
	}
	if req.OutTradeNo == "" {
		return nil, errors.New("out_trade_no is required")
	}

	codeURL := fmt.Sprintf("%s/api/v1/public/mock-pay?out_trade_no=%s&amount=%d", m.BaseURL, req.OutTradeNo, req.AmountCents)
	return &PrepayOrderResult{
		OutTradeNo: req.OutTradeNo,
		CodeURL:    codeURL,
		ExpiresAt:  time.Now().Add(15 * time.Minute),
	}, nil
}

func (m *MockPaymentProvider) ParseAndVerifyWebhook(ctx context.Context, header http.Header, body []byte) (*WebhookPaymentResult, error) {
	var payload struct {
		OutTradeNo      string `json:"out_trade_no"`
		TransactionID   string `json:"transaction_id"`
		PaidAmountCents int64  `json:"paid_amount_cents"`
		PayerID         string `json:"payer_id"`
	}

	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("invalid mock webhook json: %w", err)
	}
	if payload.OutTradeNo == "" {
		return nil, errors.New("out_trade_no is required in webhook payload")
	}
	if payload.PaidAmountCents <= 0 {
		return nil, errors.New("paid_amount_cents must be positive")
	}
	if payload.TransactionID == "" {
		payload.TransactionID = fmt.Sprintf("mock_tx_%d", time.Now().UnixNano())
	}

	return &WebhookPaymentResult{
		OutTradeNo:      payload.OutTradeNo,
		TransactionID:   payload.TransactionID,
		PaidAmountCents: payload.PaidAmountCents,
		PayerID:         payload.PayerID,
		PaidAt:          time.Now(),
		RawPayload:      body,
	}, nil
}

func (m *MockPaymentProvider) QueryOrder(ctx context.Context, outTradeNo string) (*PrepayOrderResult, error) {
	return &PrepayOrderResult{
		OutTradeNo: outTradeNo,
		CodeURL:    fmt.Sprintf("%s/api/v1/public/mock-pay?out_trade_no=%s", m.BaseURL, outTradeNo),
		ExpiresAt:  time.Now().Add(15 * time.Minute),
	}, nil
}

package payment

import (
	"context"
	"net/http"
	"time"
)

// PrepayOrderRequest contains parameters to initiate a top-up prepay order.
type PrepayOrderRequest struct {
	TenantID    string
	WalletID    string
	AmountCents int64
	Currency    string
	OutTradeNo  string
	Description string
	ClientIP    string
}

// PrepayOrderResult contains the result returned by the payment provider.
type PrepayOrderResult struct {
	OutTradeNo string    `json:"out_trade_no"`
	CodeURL    string    `json:"code_url,omitempty"`
	PrepayID   string    `json:"prepay_id,omitempty"`
	ExpiresAt  time.Time `json:"expires_at"`
}

// WebhookPaymentResult contains verified payment result from payment notification.
type WebhookPaymentResult struct {
	OutTradeNo      string
	TransactionID   string
	PaidAmountCents int64
	PayerID         string
	PaidAt          time.Time
	RawPayload      []byte
}

// PaymentProvider defines the payment gateway SPI for fiat channels.
type PaymentProvider interface {
	Name() string
	CreatePrepayOrder(ctx context.Context, req *PrepayOrderRequest) (*PrepayOrderResult, error)
	ParseAndVerifyWebhook(ctx context.Context, header http.Header, body []byte) (*WebhookPaymentResult, error)
	QueryOrder(ctx context.Context, outTradeNo string) (*PrepayOrderResult, error)
}

package payment

import (
	"bytes"
	"context"
	"crypto"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

// WeChatPayConfig holds credentials for WeChat Pay V3.
type WeChatPayConfig struct {
	AppID         string
	MchID         string
	MchSerialNo   string
	APIv3Key      string
	PrivateKey    *rsa.PrivateKey
	NotifyURL     string
	HTTPClient    *http.Client
}

// WeChatPayV3Provider implements PaymentProvider for WeChat Pay Native V3.
type WeChatPayV3Provider struct {
	cfg        WeChatPayConfig
	httpClient *http.Client
}

// NewWeChatPayV3Provider parses private key and initializes WeChat Pay V3 client.
func NewWeChatPayV3Provider(cfg WeChatPayConfig, privateKeyPEM []byte) (*WeChatPayV3Provider, error) {
	if cfg.AppID == "" || cfg.MchID == "" || cfg.MchSerialNo == "" || cfg.APIv3Key == "" {
		return nil, errors.New("wechat pay configuration is incomplete")
	}

	block, _ := pem.Decode(privateKeyPEM)
	if block == nil {
		return nil, errors.New("failed to decode private key PEM")
	}

	privKey, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		// Fallback to PKCS1
		var errPkcs1 error
		privKey, errPkcs1 = x509.ParsePKCS1PrivateKey(block.Bytes)
		if errPkcs1 != nil {
			return nil, fmt.Errorf("failed to parse private key (tried PKCS8: %v, PKCS1: %v)", err, errPkcs1)
		}
	}

	rsaKey, ok := privKey.(*rsa.PrivateKey)
	if !ok {
		return nil, errors.New("private key is not RSA")
	}

	cfg.PrivateKey = rsaKey
	client := cfg.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}

	return &WeChatPayV3Provider{
		cfg:        cfg,
		httpClient: client,
	}, nil
}

func (w *WeChatPayV3Provider) Name() string {
	return "wechat_pay"
}

// CreatePrepayOrder calls WeChat Pay V3 Native transactions endpoint.
func (w *WeChatPayV3Provider) CreatePrepayOrder(ctx context.Context, req *PrepayOrderRequest) (*PrepayOrderResult, error) {
	if req.AmountCents <= 0 {
		return nil, errors.New("amount must be greater than 0 cents")
	}
	if req.OutTradeNo == "" {
		return nil, errors.New("out_trade_no is required")
	}

	desc := req.Description
	if desc == "" {
		desc = "AgentFinOps 算力预付充值"
	}

	payload := map[string]interface{}{
		"appid":        w.cfg.AppID,
		"mchid":        w.cfg.MchID,
		"description":  desc,
		"out_trade_no": req.OutTradeNo,
		"notify_url":   w.cfg.NotifyURL,
		"amount": map[string]interface{}{
			"total":    req.AmountCents,
			"currency": "CNY",
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal prepay payload: %w", err)
	}

	url := "https://api.mch.weixin.qq.com/v3/pay/transactions/native"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}

	authHeader, err := w.generateAuthHeader(http.MethodPost, "/v3/pay/transactions/native", string(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to generate wechat auth header: %w", err)
	}

	httpReq.Header.Set("Authorization", authHeader)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	resp, err := w.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("wechat prepay request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read wechat response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("wechat prepay returned status %d: %s", resp.StatusCode, string(respBytes))
	}

	var res struct {
		CodeURL string `json:"code_url"`
	}
	if err := json.Unmarshal(respBytes, &res); err != nil {
		return nil, fmt.Errorf("failed to parse wechat prepay response: %w", err)
	}

	if res.CodeURL == "" {
		return nil, errors.New("wechat prepay response did not contain code_url")
	}

	return &PrepayOrderResult{
		OutTradeNo: req.OutTradeNo,
		CodeURL:    res.CodeURL,
		ExpiresAt:  time.Now().Add(15 * time.Minute),
	}, nil
}

// ParseAndVerifyWebhook verifies and decrypts WeChat Pay V3 webhook notification.
func (w *WeChatPayV3Provider) ParseAndVerifyWebhook(ctx context.Context, header http.Header, body []byte) (*WebhookPaymentResult, error) {
	var notify struct {
		ID           string `json:"id"`
		CreateTime   string `json:"create_time"`
		EventType    string `json:"event_type"`
		ResourceType string `json:"resource_type"`
		Resource     struct {
			Algorithm      string `json:"algorithm"`
			Ciphertext     string `json:"ciphertext"`
			AssociatedData string `json:"associated_data"`
			Nonce          string `json:"nonce"`
		} `json:"resource"`
	}

	if err := json.Unmarshal(body, &notify); err != nil {
		return nil, fmt.Errorf("malformed wechat webhook payload: %w", err)
	}

	if notify.EventType != "TRANSACTION.SUCCESS" {
		return nil, fmt.Errorf("unsupported event_type: %s", notify.EventType)
	}

	// Decrypt AEAD_AES_256_GCM ciphertext
	plainBytes, err := DecryptAES256GCM(w.cfg.APIv3Key, notify.Resource.AssociatedData, notify.Resource.Nonce, notify.Resource.Ciphertext)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt wechat webhook ciphertext: %w", err)
	}

	var tx struct {
		OutTradeNo    string `json:"out_trade_no"`
		TransactionID string `json:"transaction_id"`
		TradeState    string `json:"trade_state"`
		Amount        struct {
			Total    int64  `json:"total"`
			Currency string `json:"currency"`
		} `json:"amount"`
		SuccessTime string `json:"success_time"`
		Payer       struct {
			OpenID string `json:"openid"`
		} `json:"payer"`
	}

	if err := json.Unmarshal(plainBytes, &tx); err != nil {
		return nil, fmt.Errorf("failed to parse decrypted wechat transaction: %w", err)
	}

	if tx.TradeState != "SUCCESS" {
		return nil, fmt.Errorf("wechat trade_state is not SUCCESS: %s", tx.TradeState)
	}

	paidAt, _ := time.Parse(time.RFC3339, tx.SuccessTime)
	if paidAt.IsZero() {
		paidAt = time.Now()
	}

	return &WebhookPaymentResult{
		OutTradeNo:      tx.OutTradeNo,
		TransactionID:   tx.TransactionID,
		PaidAmountCents: tx.Amount.Total,
		PayerID:         tx.Payer.OpenID,
		PaidAt:          paidAt,
		RawPayload:      plainBytes,
	}, nil
}

func (w *WeChatPayV3Provider) QueryOrder(ctx context.Context, outTradeNo string) (*PrepayOrderResult, error) {
	return nil, errors.New("query order not implemented")
}

// generateAuthHeader generates WeChat Pay V3 Authorization header.
func (w *WeChatPayV3Provider) generateAuthHeader(method, canonicalURL, body string) (string, error) {
	nonceBytes := make([]byte, 16)
	_, _ = rand.Read(nonceBytes)
	nonce := base64.StdEncoding.EncodeToString(nonceBytes)
	timestamp := fmt.Sprintf("%d", time.Now().Unix())

	message := fmt.Sprintf("%s\n%s\n%s\n%s\n%s\n", method, canonicalURL, timestamp, nonce, body)

	h := sha256.New()
	h.Write([]byte(message))
	digest := h.Sum(nil)

	sigBytes, err := rsa.SignPKCS1v15(rand.Reader, w.cfg.PrivateKey, crypto.SHA256, digest)
	if err != nil {
		return "", err
	}
	signature := base64.StdEncoding.EncodeToString(sigBytes)

	auth := fmt.Sprintf(
		`WECHATPAY2-SHA256-RSA2048 mchid="%s",nonce_str="%s",signature="%s",timestamp="%s",serial_no="%s"`,
		w.cfg.MchID, nonce, signature, timestamp, w.cfg.MchSerialNo,
	)
	return auth, nil
}

// DecryptAES256GCM decrypts AEAD_AES_256_GCM ciphertext using APIv3 key.
func DecryptAES256GCM(apiV3Key, associatedData, nonceStr, ciphertextStr string) ([]byte, error) {
	key := []byte(apiV3Key)
	if len(key) != 32 {
		return nil, errors.New("apiV3Key must be 32 bytes")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	ciphertext, err := base64.StdEncoding.DecodeString(ciphertextStr)
	if err != nil {
		return nil, fmt.Errorf("failed to base64 decode ciphertext: %w", err)
	}

	nonce := []byte(nonceStr)
	aad := []byte(associatedData)

	plain, err := gcm.Open(nil, nonce, ciphertext, aad)
	if err != nil {
		return nil, fmt.Errorf("aes gcm decrypt failed: %w", err)
	}

	return plain, nil
}

// EncryptAES256GCM encrypts plaintext for testing wechat webhooks.
func EncryptAES256GCM(apiV3Key, associatedData, nonceStr string, plaintext []byte) (string, error) {
	key := []byte(apiV3Key)
	if len(key) != 32 {
		return "", errors.New("apiV3Key must be 32 bytes")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := []byte(nonceStr)
	aad := []byte(associatedData)

	ciphertext := gcm.Seal(nil, nonce, plaintext, aad)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

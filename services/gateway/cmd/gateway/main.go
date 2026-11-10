// AgentFinOps Enterprise Gateway Entrypoint
package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	_ "github.com/lib/pq"

	"github.com/agentfinops/agentfinops-gateway/internal/enterprise/department"
	"github.com/agentfinops/agentfinops-gateway/internal/enterprise/quota"
	"github.com/agentfinops/agentfinops-gateway/internal/payment"
	"github.com/open-agentpay/agent-core-sdk/gateway/agent"
	"github.com/open-agentpay/agent-core-sdk/gateway/config"
	"github.com/open-agentpay/agent-core-sdk/gateway/logger"
	"github.com/open-agentpay/agent-core-sdk/gateway/metrics"
	"github.com/open-agentpay/agent-core-sdk/gateway/rcu"
	"github.com/open-agentpay/agent-core-sdk/gateway/server"
)

func main() {
	configPath := flag.String("config", "", "path to gateway YAML configuration file")
	showVersion := flag.Bool("version", false, "print gateway version information and exit")
	flag.Parse()

	if *showVersion {
		fmt.Printf("AgentFinOps Gateway v%s (commit: %s, built: %s)\n",
			server.Version, server.GitCommit, server.BuildDate)
		os.Exit(0)
	}

	// 1. Load configuration via agent-core-sdk
	cfg, err := config.Load(*configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "FATAL: configuration failure: %v\n", err)
		os.Exit(1)
	}

	// 2. Initialize structured logger
	log := logger.InitGlobalLogger(logger.Config{
		Level:  cfg.Logger.Level,
		Format: cfg.Logger.Format,
	}, os.Stdout)

	log.Info("initializing AgentFinOps Enterprise Gateway (backed by agent-core-sdk)",
		slog.String("version", server.Version),
		slog.String("log_level", cfg.Logger.Level),
		slog.Int("port", cfg.Server.Port),
	)

	// 3. Initialize RCU configuration snapshot with bootstrap routes
	bootstrapRoutes := make([]rcu.RouteConfig, len(cfg.Routes))
	for i, r := range cfg.Routes {
		asset := r.Asset
		if asset == "" {
			asset = cfg.Settlement.DefaultAssetSymbol
		}
		if asset == "" {
			asset = "CNY"
		}
		methods := r.AllowedPaymentMethods
		if methods == "" {
			methods = "wallet"
		}
		bootstrapRoutes[i] = rcu.RouteConfig{
			RouteID:               r.RouteID,
			PathPattern:           r.Path,
			UpstreamURL:           r.Upstream,
			PriceBaseUnits:        r.PriceBaseUnits,
			Asset:                 asset,
			AllowedPaymentMethods: methods,
			RateLimitRPM:          r.RateLimitRPM,
			Status:                "active",
		}
	}
	initialSnapshot := &rcu.ConfigSnapshot{
		SchemaVersion: cfg.Version,
		TenantID:      "ten_bootstrap",
		VersionID:     "ver_bootstrap_0",
		VersionNumber: 0,
		Routes:        bootstrapRoutes,
	}

	rcuMgr, err := rcu.NewManager(initialSnapshot)
	if err != nil {
		log.Error("failed to initialize RCU configuration cache", slog.Any("error", err))
		os.Exit(1)
	}

	// 4. Initialize enterprise services (Department & Cascade Quota Enforcer & Spend Recorder)
	var deptSvc department.Service = department.NewMemoryService()
	var projStore quota.ProjectStore = quota.NewMemoryProjectStore()
	if cfg.Database.PostgresURL != "" {
		if db, dbErr := sql.Open("postgres", cfg.Database.PostgresURL); dbErr == nil {
			if pingErr := db.Ping(); pingErr == nil {
				pgDeptSvc := department.NewPostgresService(db)
				if initErr := pgDeptSvc.InitSchema(context.Background()); initErr != nil {
					log.Warn("failed to verify or migrate enterprise department schema", slog.Any("error", initErr))
				} else {
					log.Info("enterprise department & HITL schema verified/migrated successfully")
				}
				deptSvc = pgDeptSvc
				projStore = quota.NewPostgresProjectStore(db)
				log.Info("connected to PostgreSQL for enterprise department & quota persistence")
			} else {
				log.Warn("failed to ping PostgreSQL, falling back to in-memory store", slog.Any("error", pingErr))
			}
		}
	}

	budgetTracker := quota.NewMemoryBudgetTracker()
	agentEnforcer := agent.NewEnforcer()
	cascadeEnforcer := quota.NewCascadeQuotaEnforcer(agentEnforcer, projStore, deptSvc, budgetTracker)
	cascadeRecorder := quota.NewCascadeSpendRecorder(projStore, deptSvc, budgetTracker)
	deptHandler := department.NewHTTPHandler(deptSvc)

	// 5. Initialize fiat payment provider (WeChat Pay V3 or Sandbox Mock Provider)
	var payProvider payment.PaymentProvider
	wxAppID := os.Getenv("WECHAT_PAY_APPID")
	wxMchID := os.Getenv("WECHAT_PAY_MCHID")
	wxSerial := os.Getenv("WECHAT_PAY_SERIAL_NO")
	wxKey := os.Getenv("WECHAT_PAY_API_V3_KEY")
	wxPrivPath := os.Getenv("WECHAT_PAY_PRIVATE_KEY_PATH")
	wxNotify := os.Getenv("WECHAT_PAY_NOTIFY_URL")

	if wxAppID != "" && wxMchID != "" && wxSerial != "" && wxKey != "" && wxPrivPath != "" {
		if privBytes, err := os.ReadFile(wxPrivPath); err == nil {
			if wxProv, err := payment.NewWeChatPayV3Provider(payment.WeChatPayConfig{
				AppID:       wxAppID,
				MchID:       wxMchID,
				MchSerialNo: wxSerial,
				APIv3Key:    wxKey,
				NotifyURL:   wxNotify,
			}, privBytes); err == nil {
				payProvider = wxProv
				log.Info("initialized WeChat Pay V3 Native payment provider", slog.String("mch_id", wxMchID))
			} else {
				log.Warn("failed to initialize WeChat Pay V3 provider, falling back to mock", slog.Any("error", err))
			}
		}
	}
	if payProvider == nil {
		payProvider = payment.NewMockPaymentProvider("https://gate.aipmedia.cn")
		log.Info("initialized Sandbox Mock Payment Provider (Zero-Friction Dev/Demo Mode)")
	}

	payHandler := payment.NewHandler(payProvider)

	// 6. Initialize metrics and HTTP server from agent-core-sdk
	m := metrics.New()
	srv, err := server.New(cfg, rcuMgr, m,
		server.WithPolicyEvaluator(cascadeEnforcer),
		server.WithSpendRecorder(cascadeRecorder),
		server.WithTenantSubresource("departments", deptHandler),
		server.WithTenantSubresource("topup-orders", payHandler.TenantSubresourceHandler()),
		server.WithExtraRoute("/api/v1/public/mock-pay/confirm", payHandler.MockConfirmHandler()),
		server.WithExtraRoute("/api/v1/public/webhooks/wechat-pay", payHandler.WeChatWebhookHandler()),
	)
	if err != nil {
		log.Error("failed to create gateway server", slog.Any("error", err))
		os.Exit(1)
	}

	// Bind Core services to business payment handler
	payHandler.BindServices(srv.AdminService(), srv.WalletService())

	// 5. Start listener in background goroutine
	serverErrCh := make(chan error, 1)
	go func() {
		if err := srv.Start(); err != nil {
			serverErrCh <- err
		}
	}()

	// 6. Handle signals for graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM, syscall.SIGINT)

	select {
	case err := <-serverErrCh:
		log.Error("gateway HTTP server encountered fatal error", slog.Any("error", err))
		os.Exit(1)
	case sig := <-sigCh:
		log.Info("received termination signal, initiating graceful shutdown", slog.String("signal", sig.String()))
		shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.Server.ShutdownTimeout())
		defer cancel()

		if err := srv.Shutdown(shutdownCtx); err != nil {
			log.Error("graceful shutdown failed", slog.Any("error", err))
			os.Exit(1)
		}
		log.Info("AgentFinOps Gateway terminated cleanly")
	}
}

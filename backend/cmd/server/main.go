package main

import (
	"log"
	"net/http"
	"time"

	"github.com/croffy-crush/backend/internal/auth"
	"github.com/croffy-crush/backend/internal/config"
	"github.com/croffy-crush/backend/internal/db"
	"github.com/croffy-crush/backend/internal/handlers"
	"github.com/croffy-crush/backend/internal/httpx"
	"github.com/croffy-crush/backend/internal/middleware"
	"github.com/croffy-crush/backend/internal/settings"
)

func main() {
	cfg := config.Load()

	database, err := db.Connect(cfg.DatabaseDSN)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer database.Close()
	log.Println("connected to database")

	settingsStore := settings.New(database)

	jwtMgr := auth.NewManager(cfg.JWTSecret, cfg.JWTExpiry)
	authHandler := handlers.NewAuthHandler(database, jwtMgr)
	dashboardHandler := handlers.NewDashboardHandler(database)
	menuHandler := handlers.NewMenuHandler(database)
	orderHandler := handlers.NewOrderHandler(database)
	paymentHandler := handlers.NewPaymentHandler(database, settingsStore)
	rewardHandler := handlers.NewRewardHandler(database)
	reportHandler := handlers.NewReportHandler(database)

	requireAuth := middleware.RequireAuth(jwtMgr)
	// protect wraps a HandlerFunc with auth middleware.
	protect := func(fn http.HandlerFunc) http.Handler { return requireAuth(fn) }

	mux := http.NewServeMux()

	// --- Public routes ---
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("POST /api/auth/login", authHandler.Login)

	// Loyalty (public — ลูกค้าสแกน QR บนมือถือตัวเอง ไม่ต้อง login)
	mux.HandleFunc("GET /api/loyalty/points", paymentHandler.GetPointsByPhone)
	mux.HandleFunc("GET /api/loyalty/{token}", paymentHandler.GetToken)
	mux.HandleFunc("POST /api/loyalty/{token}/claim", paymentHandler.ClaimToken)
	mux.HandleFunc("GET /api/rewards/available", rewardHandler.ListAvailable)
	mux.HandleFunc("POST /api/rewards/redeem", rewardHandler.Redeem)

	// --- Protected routes ---
	mux.Handle("GET /api/auth/me", protect(authHandler.Me))
	mux.Handle("GET /api/dashboard/summary", protect(dashboardHandler.Summary))

	// Menu + add-ons
	mux.Handle("GET /api/menu-items", protect(menuHandler.ListMenuItems))
	mux.Handle("GET /api/menu-items/{id}/image", protect(menuHandler.GetMenuItemImage))
	mux.Handle("POST /api/menu-items", protect(menuHandler.CreateMenuItem))
	mux.Handle("PUT /api/menu-items/reorder", protect(menuHandler.ReorderMenuItems))
	mux.Handle("PUT /api/menu-items/{id}", protect(menuHandler.UpdateMenuItem))
	mux.Handle("DELETE /api/menu-items/{id}", protect(menuHandler.DeleteMenuItem))
	mux.Handle("GET /api/addons", protect(menuHandler.ListAddons))

	// Orders
	mux.Handle("POST /api/orders", protect(orderHandler.CreateOrder))
	mux.Handle("GET /api/orders/kitchen", protect(orderHandler.ListKitchen))
	mux.Handle("GET /api/orders/search", protect(orderHandler.SearchByDate))
	mux.Handle("GET /api/orders/{id}", protect(orderHandler.GetOrder))
	mux.Handle("PATCH /api/orders/{id}/status", protect(orderHandler.UpdateStatus))

	// Payment
	mux.Handle("GET /api/orders/{id}/qr", protect(paymentHandler.GetQR))
	mux.Handle("POST /api/orders/{id}/pay", protect(paymentHandler.Pay))
	mux.Handle("POST /api/orders/{id}/loyalty/claim", protect(paymentHandler.AdminClaimOrder))

	// Rewards management
	mux.Handle("GET /api/rewards", protect(rewardHandler.ListRewards))
	mux.Handle("POST /api/rewards", protect(rewardHandler.CreateReward))
	mux.Handle("PUT /api/rewards/{id}", protect(rewardHandler.UpdateReward))
	mux.Handle("DELETE /api/rewards/{id}", protect(rewardHandler.DeleteReward))

	// Reports
	mux.Handle("GET /api/reports", protect(reportHandler.Report))

	// Global middleware (CORS) wraps the whole mux.
	// handler := middleware.Chain(mux, middleware.CORS(cfg.CORSOrigin))
	handler := middleware.Chain(mux, middleware.CORS("*"), middleware.RequestLogger)

	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Printf("croffy-crush API listening on :%s (env=%s)", cfg.Port, cfg.AppEnv)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
}

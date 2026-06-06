package main

import (
	"log"
	"os"

	"golang.org/x/crypto/bcrypt"

	"github.com/croffy-crush/backend/internal/config"
	"github.com/croffy-crush/backend/internal/db"
)

// seedadmin upserts an admin user. Usage:
//
//	go run ./cmd/seedadmin                 -> admin / admin123
//	ADMIN_USER=boss ADMIN_PASS=secret go run ./cmd/seedadmin
func main() {
	cfg := config.Load()

	username := getEnv("ADMIN_USER", "admin")
	password := getEnv("ADMIN_PASS", "admin123")

	database, err := db.Connect(cfg.DatabaseDSN)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer database.Close()

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("hash error: %v", err)
	}

	_, err = database.Exec(
		`INSERT INTO users (username, password_hash, full_name, role, is_active)
		 VALUES (?, ?, 'Administrator', 'admin', 1)
		 ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), is_active = 1`,
		username, string(hash))
	if err != nil {
		log.Fatalf("seed error: %v", err)
	}

	log.Printf("admin user seeded: username=%q password=%q", username, password)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

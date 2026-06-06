package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

// Config holds all runtime configuration loaded from environment variables.
type Config struct {
	AppEnv      string
	Port        string
	DatabaseDSN string

	JWTSecret    string
	JWTExpiry    time.Duration
	CORSOrigin   string
	PromptPayID  string
	PointsPerBht int
}

// Load reads configuration from the environment (and an optional .env file).
func Load() *Config {
	_ = godotenv.Load()

	cfg := &Config{
		AppEnv:       getEnv("APP_ENV", "development"),
		Port:         getEnv("PORT", "8080"),
		JWTSecret:    getEnv("JWT_SECRET", "change-me-in-production"),
		CORSOrigin:   getEnv("CORS_ORIGIN", "http://192.168.1.127:3000"),
		PromptPayID:  getEnv("PROMPTPAY_ID", "0812345678"),
		PointsPerBht: getEnvInt("POINTS_PER_BAHT", 10),
		JWTExpiry:    time.Duration(getEnvInt("JWT_EXPIRY_HOURS", 12)) * time.Hour,
	}

	cfg.DatabaseDSN = buildDSN()
	return cfg
}

func buildDSN() string {
	if dsn := os.Getenv("DATABASE_DSN"); dsn != "" {
		return dsn
	}
	user := getEnv("DB_USER", "rapee")
	pass := getEnv("DB_PASSWORD", "2311engpee")
	host := getEnv("DB_HOST", "127.0.0.1")
	port := getEnv("DB_PORT", "3306")
	name := getEnv("DB_NAME", "croffy_crush")
	// parseTime=true so DATETIME/TIMESTAMP scan into time.Time
	return fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=true&loc=Local",
		user, pass, host, port, name)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

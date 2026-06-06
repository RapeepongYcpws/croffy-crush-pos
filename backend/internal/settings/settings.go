package settings

import (
	"strconv"

	"github.com/jmoiron/sqlx"
)

// Store reads/writes key-value settings from the app_settings table.
type Store struct {
	db *sqlx.DB
}

func New(db *sqlx.DB) *Store {
	return &Store{db: db}
}

func (s *Store) Get(key, fallback string) string {
	var v string
	err := s.db.Get(&v, `SELECT setting_value FROM app_settings WHERE setting_key = ?`, key)
	if err != nil {
		return fallback
	}
	return v
}

func (s *Store) GetInt(key string, fallback int) int {
	v := s.Get(key, "")
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func (s *Store) Set(key, value string) error {
	_, err := s.db.Exec(
		`INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
		 ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`, key, value)
	return err
}

// defaultThaiQRPayload is the static Thai QR (ถุงเงิน) merchant payload used by default.
const defaultThaiQRPayload = "00020101021130860016A000000677010112011501075370008820502198B120940Y31033427TS0320MISSPHATSAKANLAIPHAI53037645802TH62080704000063045D8E"

// Convenience accessors
func (s *Store) PromptPayID() string   { return s.Get("promptpay_id", "0812345678") }
func (s *Store) ThaiQRPayload() string { return s.Get("thaiqr_payload", defaultThaiQRPayload) }
func (s *Store) PointsPerBaht() int    { return s.GetInt("points_per_baht", 10) }
func (s *Store) LoyaltyTokenTTL() int  { return s.GetInt("loyalty_token_ttl_seconds", 300) }

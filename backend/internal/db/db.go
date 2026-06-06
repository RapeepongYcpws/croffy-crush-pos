package db

import (
	"time"

	"github.com/jmoiron/sqlx"

	_ "github.com/go-sql-driver/mysql"
)

// Connect opens a MySQL connection pool and verifies it with a ping.
func Connect(dsn string) (*sqlx.DB, error) {
	database, err := sqlx.Connect("mysql", dsn)
	if err != nil {
		return nil, err
	}

	database.SetMaxOpenConns(25)
	database.SetMaxIdleConns(10)
	database.SetConnMaxLifetime(5 * time.Minute)

	if err := database.Ping(); err != nil {
		return nil, err
	}
	return database, nil
}

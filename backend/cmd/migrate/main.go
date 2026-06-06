// Command migrate applies database/schema.sql to the configured database.
// It is idempotent (the schema uses CREATE TABLE IF NOT EXISTS) and safe to
// re-run. Useful when the schema was only partially imported.
package main

import (
	"database/sql"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-sql-driver/mysql"

	"github.com/croffy-crush/backend/internal/config"
)

func main() {
	cfg := config.Load()

	// Enable multiStatements so the whole schema file can run in one shot.
	dsn := cfg.DatabaseDSN
	if !strings.Contains(dsn, "multiStatements=") {
		sep := "?"
		if strings.Contains(dsn, "?") {
			sep = "&"
		}
		dsn += sep + "multiStatements=true"
	}
	_ = mysql.Config{} // ensure driver import is used

	schemaPath := findSchema()
	content, err := os.ReadFile(schemaPath)
	if err != nil {
		log.Fatalf("read schema (%s): %v", schemaPath, err)
	}

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	if _, err := db.Exec(string(content)); err != nil {
		log.Fatalf("apply schema: %v", err)
	}
	log.Printf("schema applied successfully from %s", schemaPath)
}

// findSchema looks for database/schema.sql relative to common working dirs.
func findSchema() string {
	candidates := []string{
		os.Getenv("SCHEMA_PATH"),
		"database/schema.sql",
		"../database/schema.sql",
		"../../database/schema.sql",
		"../../../database/schema.sql",
	}
	for _, c := range candidates {
		if c == "" {
			continue
		}
		if abs, err := filepath.Abs(c); err == nil {
			if _, err := os.Stat(abs); err == nil {
				return abs
			}
		}
	}
	log.Fatal("could not locate database/schema.sql — set SCHEMA_PATH env var")
	return ""
}

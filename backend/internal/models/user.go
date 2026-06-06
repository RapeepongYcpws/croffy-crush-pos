package models

import "time"

// User represents a staff/admin account used for system login.
type User struct {
	ID           uint64    `db:"id" json:"id"`
	Username     string    `db:"username" json:"username"`
	PasswordHash string    `db:"password_hash" json:"-"`
	FullName     *string   `db:"full_name" json:"full_name"`
	Role         string    `db:"role" json:"role"`
	IsActive     bool      `db:"is_active" json:"is_active"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at" json:"updated_at"`
}

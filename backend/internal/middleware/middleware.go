package middleware

import (
	"context"
	"log"
	"net/http"
	"strings"

	"github.com/croffy-crush/backend/internal/auth"
	"github.com/croffy-crush/backend/internal/httpx"
)

type ctxKey string

const userCtxKey ctxKey = "user"

// RequestLogger logs incoming API requests with method, path, and query parameters.
func RequestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("API: %s %s", r.Method, r.URL.Path)
		next.ServeHTTP(w, r)
	})
}

// CORS adds permissive CORS headers for the configured frontend origin.
func CORS(origin string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireAuth validates the Bearer token and injects claims into the context.
func RequireAuth(mgr *auth.Manager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				httpx.Error(w, http.StatusUnauthorized, "missing bearer token")
				return
			}
			tokenStr := strings.TrimPrefix(header, "Bearer ")
			claims, err := mgr.Verify(tokenStr)
			if err != nil {
				httpx.Error(w, http.StatusUnauthorized, "invalid or expired token")
				return
			}
			ctx := context.WithValue(r.Context(), userCtxKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// UserFromContext returns the authenticated claims, if present.
func UserFromContext(ctx context.Context) (*auth.Claims, bool) {
	claims, ok := ctx.Value(userCtxKey).(*auth.Claims)
	return claims, ok
}

// Chain applies middlewares in order (outermost first).
func Chain(h http.Handler, mws ...func(http.Handler) http.Handler) http.Handler {
	for i := len(mws) - 1; i >= 0; i-- {
		h = mws[i](h)
	}
	return h
}

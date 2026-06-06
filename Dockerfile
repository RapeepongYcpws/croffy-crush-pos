# Backend (Go API) image for croffy-crush.
# Build context MUST be the repo root because the image bundles
# database/schema.sql (used by the migrate step) which lives outside backend/.
#
#   docker build -t croffy-api .
#   docker run -p 8080:8080 --env-file backend/.env croffy-api

# ---- build stage ----
FROM golang:1.22-alpine AS build
WORKDIR /src/backend

# Cache module downloads.
COPY backend/go.mod backend/go.sum ./
RUN go mod download

# Build both binaries.
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -o /out/server ./cmd/server \
 && CGO_ENABLED=0 GOOS=linux go build -trimpath -o /out/migrate ./cmd/migrate

# ---- runtime stage ----
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app

COPY --from=build /out/server /app/server
COPY --from=build /out/migrate /app/migrate
# Schema is applied on startup (CREATE TABLE IF NOT EXISTS — idempotent).
COPY database/schema.sql /app/database/schema.sql

ENV SCHEMA_PATH=/app/database/schema.sql \
    PORT=8080
EXPOSE 8080

# Apply schema (idempotent) then start the API. The platform's $PORT is
# honored by the server (config reads PORT, default 8080).
CMD ["/bin/sh", "-c", "/app/migrate && /app/server"]

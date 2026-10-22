#!/bin/sh
set -e

DB_FILE="${DATABASE_PATH:-/data/studysync.db}"
DB_DIR=$(dirname "$DB_FILE")

# Ensure the database directory exists and is writable
mkdir -p "$DB_DIR"

echo "===================================================="
echo "StudySync AI Production Container Initializing"
echo "Target Database Path: $DB_FILE"
echo "===================================================="

# Check if Cloudflare R2 credentials are fully configured
if [ -n "$R2_ACCOUNT_ID" ] && [ -n "$R2_ACCESS_KEY_ID" ] && [ -n "$R2_SECRET_ACCESS_KEY" ] && [ -n "$R2_BUCKET" ]; then
  echo "[StudySync Storage] Cloudflare R2 credentials detected."
  echo "[StudySync Storage] Checking for existing replica in bucket: $R2_BUCKET..."

  # Step 1: Pre-flight restore if replica exists AND local DB does not exist
  # CRITICAL INVARIANT: -if-db-not-exists ensures a newer local database is NEVER overwritten with an older backup!
  if [ -f "/app/litestream.yml" ] && command -v litestream >/dev/null 2>&1; then
    echo "[StudySync Storage] Executing Litestream pre-flight restoration check..."
    if ! litestream restore -if-replica-exists -if-db-not-exists -config /app/litestream.yml "$DB_FILE"; then
      echo "[StudySync Storage FATAL] Litestream restore failed with exit code $?." >&2
      echo "[StudySync Storage FATAL] Refusing to start application to prevent starting with an empty database or overwriting remote replica." >&2
      echo "[StudySync Storage FATAL] Check R2 credentials, bucket name, and network access." >&2
      exit 1
    fi
    
    echo "[StudySync Storage] Starting Litestream continuous replication process..."
    exec litestream replicate -config /app/litestream.yml -exec "node server/index.js"
  else
    echo "[StudySync Storage Warning] Litestream binary or config missing. Running standard Node server."
    exec node server/index.js
  fi
else
  echo "[StudySync Storage Notice] Cloudflare R2 environment variables are not set."
  echo "[StudySync Storage Notice] Starting server in standalone SQLite mode (ephemeral persistence)."
  echo "[StudySync Storage Notice] To enable permanent zero-cost persistence across Render restarts,"
  echo "[StudySync Storage Notice] configure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET."
  exec node server/index.js
fi

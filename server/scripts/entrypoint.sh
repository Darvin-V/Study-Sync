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

# Check if all five Backblaze B2 variables are fully configured
if [ -n "$B2_KEY_ID" ] && [ -n "$B2_APPLICATION_KEY" ] && [ -n "$B2_BUCKET" ] && [ -n "$B2_ENDPOINT" ] && [ -n "$B2_REGION" ]; then
  echo "[StudySync Storage] Backblaze B2 credentials detected."
  echo "[StudySync Storage] Checking for existing replica in bucket: $B2_BUCKET..."

  # Step 1: Pre-flight restore if replica exists AND local DB does not exist
  # CRITICAL INVARIANT: -if-db-not-exists ensures a newer local database is NEVER overwritten with an older backup!
  if [ -f "/app/litestream.yml" ] && command -v litestream >/dev/null 2>&1; then
    echo "[StudySync Storage] Executing Litestream pre-flight restoration check..."
    set +e
    litestream restore -if-replica-exists -if-db-not-exists -config /app/litestream.yml "$DB_FILE"
    RESTORE_EXIT=$?
    set -e

    if [ $RESTORE_EXIT -ne 0 ]; then
      echo "[StudySync Storage FATAL] Litestream restore failed with exit code $RESTORE_EXIT." >&2
      echo "[StudySync Storage FATAL] Refusing to start application to prevent starting with an empty database or overwriting remote replica." >&2
      echo "[StudySync Storage FATAL] Check Backblaze B2 credentials, bucket name, network access, and endpoint." >&2
      exit $RESTORE_EXIT
    fi

    echo "[StudySync Storage] Starting Litestream continuous replication process..."
    exec litestream replicate -config /app/litestream.yml -exec "node server/index.js"
  else
    if [ "$NODE_ENV" = "production" ]; then
      echo "[StudySync Storage FATAL] Litestream binary or configuration (/app/litestream.yml) missing in production container." >&2
      exit 1
    fi
    echo "[StudySync Storage Warning] Litestream binary or config missing. Running standard Node server."
    exec node server/index.js
  fi
else
  # Fail-closed in production: Render Free has ephemeral disk; running without B2 risks permanent student data loss.
  if [ "$NODE_ENV" = "production" ]; then
    echo "[StudySync Storage FATAL] Production deployment requires Backblaze B2 persistence." >&2
    echo "[StudySync Storage FATAL] Missing one or more required environment variables: B2_BUCKET, B2_ENDPOINT, B2_REGION, B2_KEY_ID, B2_APPLICATION_KEY." >&2
    echo "[StudySync Storage FATAL] Refusing to start in ephemeral mode on Render to prevent permanent student data loss." >&2
    exit 1
  fi

  # Preserved local development behavior when deployment configuration is not active
  echo "[StudySync Storage Notice] Backblaze B2 environment variables are not set and NODE_ENV is not production."
  echo "[StudySync Storage Notice] Starting server in standalone SQLite mode (local development persistence)."
  exec node server/index.js
fi

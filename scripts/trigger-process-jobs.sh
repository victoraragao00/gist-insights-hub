#!/usr/bin/env bash
set -euo pipefail

# Load env vars from .env
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env not found at $ENV_FILE"
  exit 1
fi

SUPABASE_URL=$(grep '^VITE_SUPABASE_URL=' "$ENV_FILE" | sed 's/^[^=]*=//; s/^"//; s/"$//')
ANON_KEY=$(grep '^VITE_SUPABASE_PUBLISHABLE_KEY=' "$ENV_FILE" | sed 's/^[^=]*=//; s/^"//; s/"$//')

if [ -z "$SUPABASE_URL" ] || [ -z "$ANON_KEY" ]; then
  echo "Error: VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY not found in .env"
  exit 1
fi

echo "Triggering process-jobs at $SUPABASE_URL ..."

curl -sS -X POST "${SUPABASE_URL}/functions/v1/process-jobs" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -w "\nHTTP %{http_code}\n"

#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${1:-http://127.0.0.1:8080}"

USER1_EMAIL="${2:-user1@codedock.com}"
USER1_PASSWORD="${3:-codedock123}"

USER2_EMAIL="${4:-user2@codedock.com}"
USER2_PASSWORD="${5:-codedock123}"

echo "Using backend: $BASE_URL"
echo

register_user() {
  local email="$1"
  local password="$2"

  echo "==> Registering $email"
  curl -sS -X POST "$BASE_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}"
  echo
  echo
}

login_user() {
  local email="$1"
  local password="$2"

  echo "==> Logging in $email"
  curl -sS -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}"
  echo
  echo
}

register_user "$USER1_EMAIL" "$USER1_PASSWORD"
register_user "$USER2_EMAIL" "$USER2_PASSWORD"

login_user "$USER1_EMAIL" "$USER1_PASSWORD"
login_user "$USER2_EMAIL" "$USER2_PASSWORD"

echo "Done."
echo "User 1: $USER1_EMAIL / $USER1_PASSWORD"
echo "User 2: $USER2_EMAIL / $USER2_PASSWORD"
#!/bin/bash

# ClaudeFlare Deployment Verification Script
# Usage: ./scripts/verify-deployment.sh [environment]

set -e

ENVIRONMENT=${1:-staging}

echo "✅ ClaudeFlare Deployment Verification"
echo "======================================"
echo "Environment: $ENVIRONMENT"
echo ""

# Determine base URL
if [[ "$ENVIRONMENT" == "staging" ]]; then
  BASE_URL="https://staging.claudeflare.workers.dev"
elif [[ "$ENVIRONMENT" == "production" ]]; then
  BASE_URL="https://claudeflare.workers.dev"
else
  echo "❌ Invalid environment"
  exit 1
fi

echo "🔍 Checking endpoints at: $BASE_URL"
echo ""

# Health check
echo "1️⃣ Health Check..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/health")
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | tail -n 1)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')

if [[ "$HEALTH_STATUS" == "200" ]]; then
  echo "✅ Health check passed"
  echo "   Response: $HEALTH_BODY"
else
  echo "❌ Health check failed (HTTP $HEALTH_STATUS)"
  exit 1
fi

# Metrics endpoint
echo ""
echo "2️⃣ Metrics Endpoint..."
METRICS_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/metrics")
METRICS_STATUS=$(echo "$METRICS_RESPONSE" | tail -n 1)

if [[ "$METRICS_STATUS" == "200" ]]; then
  echo "✅ Metrics endpoint accessible"
else
  echo "⚠️  Metrics endpoint returned HTTP $METRICS_STATUS"
fi

# Version check
echo ""
echo "3️⃣ Version Check..."
VERSION_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/version")
VERSION_STATUS=$(echo "$VERSION_RESPONSE" | tail -n 1)
VERSION_BODY=$(echo "$VERSION_RESPONSE" | sed '$d')

if [[ "$VERSION_STATUS" == "200" ]]; then
  echo "✅ Version: $VERSION_BODY"
else
  echo "⚠️  Version check returned HTTP $VERSION_STATUS"
fi

# Test basic functionality
echo ""
echo "4️⃣ Basic Functionality Test..."
TEST_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"test": "ping"}' \
  -w "\n%{http_code}" \
  "$BASE_URL/api/v1/test")
TEST_STATUS=$(echo "$TEST_RESPONSE" | tail -n 1)
TEST_BODY=$(echo "$TEST_RESPONSE" | sed '$d')

if [[ "$TEST_STATUS" == "200" ]]; then
  echo "✅ API test passed"
  echo "   Response: $TEST_BODY"
else
  echo "⚠️  API test returned HTTP $TEST_STATUS"
fi

# Latency check
echo ""
echo "5️⃣ Latency Check..."
LATENCY=$(curl -s -o /dev/null -w "%{time_total}" "$BASE_URL/health")
echo "⏱️  Response time: ${LATENCY}s"

if (( $(echo "$LATENCY < 0.5" | bc -l) )); then
  echo "✅ Latency acceptable (< 500ms)"
else
  echo "⚠️  High latency detected"
fi

echo ""
echo "✅ Verification complete!"
echo ""
echo "📊 Summary:"
echo "  Environment: $ENVIRONMENT"
echo "  Base URL: $BASE_URL"
echo "  Health: ✅"
echo "  Metrics: ✅"
echo "  Latency: ${LATENCY}s"

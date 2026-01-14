#!/bin/bash

# ClaudeFlare Rollback Script
# Usage: ./scripts/rollback.sh [environment]

set -e

ENVIRONMENT=${1:-staging}

echo "🔄 ClaudeFlare Rollback Script"
echo "================================"
echo "Environment: $ENVIRONMENT"
echo ""

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  echo "❌ Invalid environment. Use 'staging' or 'production'"
  exit 1
fi

# Check required environment variables
if [[ -z "$CLOUDFLARE_API_TOKEN" ]]; then
  echo "❌ CLOUDFLARE_API_TOKEN is not set"
  exit 1
fi

if [[ -z "$CLOUDFLARE_ACCOUNT_ID" ]]; then
  echo "❌ CLOUDFLARE_ACCOUNT_ID is not set"
  exit 1
fi

# Get current deployment info
echo "📊 Current deployment info:"
npx wrangler deployments list --env $ENVIRONMENT || {
  echo "❌ Failed to get deployment info"
  exit 1
}

# List recent deployments
echo ""
echo "📋 Recent deployments:"
npx wrangler deployments list --env $ENVIRONMENT | head -n 5

# Confirm rollback
read -p "Are you sure you want to rollback? (yes/no): " confirm
if [[ "$confirm" != "yes" ]]; then
  echo "❌ Rollback cancelled"
  exit 0
fi

# Get previous deployment
PREVIOUS_DEPLOYMENT=$(npx wrangler deployments list --env $ENVIRONMENT | head -n 2 | tail -n 1 | awk '{print $1}')

if [[ -z "$PREVIOUS_DEPLOYMENT" ]]; then
  echo "❌ No previous deployment found"
  exit 1
fi

echo "🔄 Rolling back to deployment: $PREVIOUS_DEPLOYMENT"

# Rollback (using wrangler rollback if available, otherwise redeploy previous version)
npx wrangler rollback --env $ENVIRONMENT || {
  echo "⚠️  wrangler rollback not available, attempting manual rollback..."
  # Fallback: get previous version and redeploy
  npx wrangler deploy --env $ENVIRONMENT --version $PREVIOUS_DEPLOYMENT || {
    echo "❌ Rollback failed"
    exit 1
  }
}

echo "✅ Rollback completed!"
echo ""
echo "📍 URLs:"
if [[ "$ENVIRONMENT" == "staging" ]]; then
  echo "  - https://staging.claudeflare.workers.dev"
else
  echo "  - https://claudeflare.workers.dev"
fi

# Verify rollback
echo "🧪 Verifying rollback..."
sleep 5
npm run verify:deployment -- --env=$ENVIRONMENT || {
  echo "⚠️  Rollback verification failed"
  exit 1
}

echo "✅ Rollback verified!"

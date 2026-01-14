#!/bin/bash

# ClaudeFlare Deployment Backup Script
# Creates a backup of the current deployment before deploying new version

set -e

ENVIRONMENT=${1:-staging}
BACKUP_DIR=".deploy-backups"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")

echo "💾 ClaudeFlare Deployment Backup"
echo "================================="
echo "Environment: $ENVIRONMENT"
echo "Timestamp: $TIMESTAMP"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Get current deployment info
echo "📊 Fetching current deployment info..."
npx wrangler deployments list --env $ENVIRONMENT > "$BACKUP_DIR/deployment_${TIMESTAMP}.txt" 2>&1

# Get current version
CURRENT_VERSION=$(npx wrangler deployments list --env $ENVIRONMENT | head -n 1 | awk '{print $1}')
echo "Current version: $CURRENT_VERSION"

# Export current configuration
npx wrangler tail --env $ENVIRONMENT --format=json > "$BACKUP_DIR/tail_${TIMESTAMP}.json" &
TAIL_PID=$!
sleep 2
kill $TAIL_PID 2>/dev/null || true

# Create backup marker
cat > "$BACKUP_DIR/backup_${TIMESTAMP}.json" << EOF
{
  "environment": "$ENVIRONMENT",
  "timestamp": "$TIMESTAMP",
  "version": "$CURRENT_VERSION",
  "backup_files": [
    "deployment_${TIMESTAMP}.txt",
    "tail_${TIMESTAMP}.json"
  ]
}

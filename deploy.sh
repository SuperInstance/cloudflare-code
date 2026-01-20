#!/bin/bash

# Cocapn Hybrid IDE Deployment Script
set -e

ENVIRONMENT=${1:-staging}
echo "🚀 Deploying Cocapn Hybrid IDE to $ENVIRONMENT..."

# Build the project
echo "📦 Building project..."
npm run build

# Deploy to Cloudflare
echo "🚀 Deploying to Cloudflare..."
wrangler deploy --config wrangler-ide.toml --env $ENVIRONMENT

echo "✅ Deployment complete!"
echo "🌐 View at: https://cocapn-ide-$ENVIRONMENT.workers.dev"

# Optional: Print deployment information
echo ""
echo "📊 Deployment Information:"
echo "Environment: $ENVIRONMENT"
echo "Worker Name: cocapn-ide"
echo "Account: $(wrangler whoami --format json | jq -r '.email')"
echo ""
echo "💡 Next steps:"
echo "1. Test the IDE at the URL above"
echo "2. Set up API key secrets if needed"
echo "3. Configure custom domains if desired"
echo "4. Monitor deployment with: wrangler tail --format pretty"
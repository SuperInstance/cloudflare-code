#!/bin/bash
set -e

ENVIRONMENT=${1:-production}

echo "Deploying ClaudeFlare to $ENVIRONMENT..."

# Validate environment
if [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
    echo "Error: Environment must be 'staging' or 'production'"
    exit 1
fi

# Build the project
echo "Building project..."
npm run build

# Check bundle size
echo "Checking bundle size..."
npm run check-bundle-size

# Deploy to Cloudflare
echo "Deploying to Cloudflare Workers ($ENVIRONMENT)..."
wrangler deploy --env $ENVIRONMENT

# Run smoke tests
echo "Running smoke tests..."
npm run test:smoke

echo "Deployment to $ENVIRONMENT completed successfully!"

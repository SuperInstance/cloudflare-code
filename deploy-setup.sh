#!/bin/bash

# Cocapn Hybrid IDE Deployment Setup Script
# This script helps you set up the environment for deploying the Hybrid IDE

set -e

echo "🚀 Setting up Cocapn Hybrid IDE Deployment Environment"
echo "===================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if required tools are installed
echo "${BLUE}📋 Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "${RED}❌ Node.js is not installed. Please install Node.js 18.x or later.${NC}"
    exit 1
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo "${RED}❌ npm is not installed. Please install npm.${NC}"
    exit 1
fi

# Check Wrangler
if ! command -v wrangler &> /dev/null; then
    echo "${YELLOW}⚠️  Wrangler CLI is not installed. Installing...${NC}"
    npm install -g wrangler
fi

echo "${GREEN}✅ Prerequisites check complete!${NC}"

# Install dependencies
echo "${BLUE}📦 Installing dependencies...${NC}"
npm install
echo "${GREEN}✅ Dependencies installed!${NC}"

# Check if user is logged in to Cloudflare
echo "${BLUE}🔐 Checking Cloudflare login...${NC}"
if ! wrangler whoami &> /dev/null; then
    echo "${YELLOW}⚠️  You're not logged in to Cloudflare. Please log in:${NC}"
    echo "${BLUE}wrangler login${NC}"
    echo "${YELLOW}After logging in, run this script again.${NC}"
    exit 1
fi

echo "${GREEN}✅ Cloudflare login verified!${NC}"

# Prompt for environment variables
echo "${BLUE}🔧 Setting up environment variables...${NC}"

# Create .env file
cat > .env << EOF
# Environment variables for Cocapn Hybrid IDE
ENVIRONMENT=development
DEBUG=true

# Cloudflare Configuration
ACCOUNT_ID=your-account-id-here
ZONE_ID=your-zone-id-here

# AI Provider API Keys (optional for development)
# These should be set as secrets in production
MANUS_API_KEY=your-manus-api-key
ZAI_API_KEY=your-zai-api-key
MINIMAX_API_KEY=your-minimax-api-key
CLAUDE_API_KEY=your-claude-api-key
GROK_API_KEY=your-grok-api-key

# Optional: External AI Service URLs
MANUS_BASE_URL=https://api.manus.vc
ZAI_BASE_URL=https://api.zhipu.ai
MINIMAX_BASE_URL=https://api.minimax.chat
CLAUDE_BASE_URL=https://api.anthropic.com
GROK_BASE_URL=https://api.x.ai

# Optional: Rate limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=100

# Optional: Session configuration
SESSION_TIMEOUT=3600000  # 1 hour in milliseconds

EOF

echo "${GREEN}✅ .env file created!${NC}"

# Function to set up secrets
setup_secrets() {
    echo "${BLUE}🔑 Setting up Cloudflare secrets...${NC}"

    # Check if API keys are set in .env
    if grep -q "your-" .env; then
        echo "${YELLOW}⚠️  Please update the API keys in .env file before setting secrets.${NC}"
        echo "${BLUE}Example: wrangler secret put MANUS_API_KEY${NC}"
        return
    fi

    # Set secrets from .env file
    while IFS='=' read -r key value; do
        if [[ $key == *_API_KEY ]] && [[ $value != "your-"* ]]; then
            echo "${BLUE}Setting secret: $key${NC}"
            echo "$value" | wrangler secret put "$key" --env production
        fi
    done < .env
}

# Ask user if they want to set up secrets
read -p "${YELLOW}Do you want to set up API key secrets now? (y/n): ${NC}" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    setup_secrets
fi

# Create deployment script
cat > deploy.sh << 'EOF'
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
wrangler deploy --env $ENVIRONMENT

echo "✅ Deployment complete!"
echo "🌐 View at: https://$(wrangler whoami --format json | jq -r '.account_name')-$ENVIRONMENT.workers.dev"
EOF

chmod +x deploy.sh

# Create development script
cat > dev.sh << 'EOF'
#!/bin/bash

# Development server script
set -e

ENVIRONMENT=${1:-development}
echo "🚀 Starting development server for Cocapn Hybrid IDE..."

# Start development server
wrangler dev --env $ENVIRONMENT --local-port 8787
EOF

chmod +x dev.sh

# Create test script
cat > test-deploy.sh << 'EOF'
#!/bin/bash

# Test deployment script
set -e

echo "🧪 Testing Cocapn Hybrid IDE deployment..."

# Test health endpoint
echo "🔍 Testing health endpoint..."
curl -s https://cocapn-ide-staging.workers.dev/health | jq .

# Test IDE endpoint
echo "🔍 Testing IDE endpoint..."
curl -s -I https://cocapn-ide-staging.workers.dev/ | head -5

echo "✅ Test complete!"
EOF

chmod +x test-deploy.sh

echo "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "${BLUE}📝 Next steps:${NC}"
echo "1. Update .env file with your API keys"
echo "2. Run './deploy.sh production' to deploy to production"
echo "3. Visit your deployed IDE at the provided URL"
echo ""
echo "${BLUE}🔧 Useful commands:${NC}"
echo "• ./dev.sh - Start development server"
echo "• ./deploy.sh [staging|production] - Deploy to environment"
echo "• ./test-deploy.sh - Test deployment"
echo "• wrangler secret put <KEY> - Set a secret"
echo ""
echo "${BLUE}📚 Documentation:${NC}"
echo "• wrangler deploy --help"
echo "• wrangler secret --help"
echo "• https://developers.cloudflare.com/workers/"

echo "${GREEN}🎉 Setup complete! You're ready to deploy the Cocapn Hybrid IDE!${NC}"
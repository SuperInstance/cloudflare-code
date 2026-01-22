#!/bin/bash

# ClaudeFlare Storage System Validation Script
# Tests all three storage tiers and migration logic

set -e

echo "🔍 ClaudeFlare Storage System Validation"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if wrangler is installed
echo "📦 Checking dependencies..."
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ wrangler not found. Install with: npm install -g wrangler${NC}"
    exit 1
fi
echo -e "${GREEN}✅ wrangler installed${NC}"

# Check if node modules are installed
if [ ! -d "node_modules" ]; then
    echo "📥 Installing dependencies..."
    npm install
fi
echo -e "${GREEN}✅ dependencies installed${NC}"
echo ""

# Run TypeScript checks
echo "🔷 Running TypeScript type check..."
npm run typecheck
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Type check passed${NC}"
else
    echo -e "${RED}❌ Type check failed${NC}"
    exit 1
fi
echo ""

# Run unit tests
echo "🧪 Running unit tests..."
npm test -- --run
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed${NC}"
else
    echo -e "${RED}❌ Tests failed${NC}"
    exit 1
fi
echo ""

# Check file structure
echo "📁 Checking file structure..."
FILES=(
    "src/types.ts"
    "src/do/session.ts"
    "src/lib/kv.ts"
    "src/lib/r2.ts"
    "src/lib/storage.ts"
    "src/lib/compression.ts"
    "src/routes/storage-example.ts"
    "tests/kv.test.ts"
    "tests/r2.test.ts"
    "tests/storage.test.ts"
    "wrangler.toml"
    "package.json"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file${NC}"
    else
        echo -e "${RED}❌ $file missing${NC}"
        exit 1
    fi
done
echo ""

# Validate wrangler.toml bindings
echo "🔧 Validating wrangler.toml bindings..."
if grep -q "SESSION_DO" wrangler.toml; then
    echo -e "${GREEN}✅ SESSION_DO binding found${NC}"
else
    echo -e "${YELLOW}⚠️  SESSION_DO binding not configured${NC}"
fi

if grep -q "KV_CACHE" wrangler.toml; then
    echo -e "${GREEN}✅ KV_CACHE binding found${NC}"
else
    echo -e "${YELLOW}⚠️  KV_CACHE binding not configured${NC}"
fi

if grep -q "R2_STORAGE" wrangler.toml; then
    echo -e "${GREEN}✅ R2_STORAGE binding found${NC}"
else
    echo -e "${YELLOW}⚠️  R2_STORAGE binding not configured${NC}"
fi
echo ""

# Count lines of code
echo "📊 Code Statistics..."
TYPESCRIPT_FILES=$(find src -name "*.ts" -not -name "*.test.ts" | wc -l)
TEST_FILES=$(find tests -name "*.test.ts" | wc -l)
TOTAL_LINES=$(find src tests -name "*.ts" | xargs wc -l | tail -1 | awk '{print $1}')

echo "   TypeScript files: $TYPESCRIPT_FILES"
echo "   Test files: $TEST_FILES"
echo "   Total lines of code: $TOTAL_LINES"
echo ""

# Check bundle size estimation
echo "📦 Estimating bundle size..."
if command -v esbuild &> /dev/null; then
    echo "   Building for size analysis..."
    npm run build:analyze > /dev/null 2>&1

    if [ -f "dist/index.mjs" ]; then
        SIZE=$(wc -c < dist/index.mjs)
        SIZE_KB=$(awk "BEGIN {printf \"%.2f\", $SIZE/1024}")
        echo -e "${GREEN}✅ Bundle size: ${SIZE_KB} KB${NC}"

        if (( $(echo "$SIZE_KB > 3000" | bc -l) )); then
            echo -e "${YELLOW}⚠️  Bundle size exceeds 3MB limit (Cloudflare Workers limit)${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Could not estimate bundle size${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  esbuild not found, skipping bundle size check${NC}"
fi
echo ""

# Print summary
echo "=========================================="
echo "✨ Validation Complete!"
echo ""
echo "Next steps:"
echo "  1. Configure your Cloudflare resources:"
echo "     - wrangler kv:namespace create \"KV_CACHE\""
echo "     - wrangler r2 bucket create \"claudeflare-storage\""
echo ""
echo "  2. Update wrangler.toml with your IDs"
echo ""
echo "  3. Deploy to Cloudflare:"
echo "     - npm run deploy"
echo ""
echo "  4. Test the deployment:"
echo "     - curl https://your-worker.workers.dev/health"
echo ""
echo "For more information, see STORAGE-README.md"
echo "=========================================="

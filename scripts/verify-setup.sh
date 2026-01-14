#!/bin/bash
# ClaudeFlare Setup Verification Script

echo "🔍 Verifying ClaudeFlare project setup..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
total=0
passed=0
failed=0

check_file() {
  local file=$1
  local description=$2
  
  total=$((total + 1))
  if [ -f "$file" ]; then
    echo -e "${GREEN}✅${NC} $description"
    passed=$((passed + 1))
  else
    echo -e "${RED}❌${NC} $description - Missing: $file"
    failed=$((failed + 1))
  fi
}

check_dir() {
  local dir=$1
  local description=$2
  
  total=$((total + 1))
  if [ -d "$dir" ]; then
    echo -e "${GREEN}✅${NC} $description"
    passed=$((passed + 1))
  else
    echo -e "${RED}❌${NC} $description - Missing: $dir"
    failed=$((failed + 1))
  fi
}

echo "📋 Root Configuration"
echo "===================="
check_file "package.json" "package.json"
check_file "tsconfig.json" "tsconfig.json"
check_file "wrangler.toml" "wrangler.toml"
check_file ".gitignore" ".gitignore"
check_file ".eslintrc.js" ".eslintrc.js"
check_file ".prettierrc" ".prettierrc"
check_file "turbo.json" "turbo.json"
check_file ".env.example" ".env.example"
check_file "LICENSE" "LICENSE"
check_file "README.md" "README.md"
echo ""

echo "📦 Edge Package"
echo "==============="
check_file "packages/edge/package.json" "Edge package.json"
check_file "packages/edge/tsconfig.json" "Edge tsconfig.json"
check_file "packages/edge/jest.config.js" "Edge jest.config.js"
check_file "packages/edge/src/index.ts" "Edge entry point"
check_dir "packages/edge/src" "Edge src directory"
check_dir "packages/edge/tests" "Edge tests directory"
echo ""

echo "🖥️  Desktop Package"
echo "=================="
check_file "packages/desktop/go.mod" "Go module"
check_file "packages/desktop/Makefile" "Makefile"
check_file "packages/desktop/cmd/desktop/main.go" "Desktop main.go"
check_dir "packages/desktop/pkg/webrtc" "WebRTC package"
check_dir "packages/desktop/pkg/signaling" "Signaling package"
echo ""

echo "📚 Shared Package"
echo "================"
check_file "packages/shared/package.json" "Shared package.json"
check_file "packages/shared/tsconfig.json" "Shared tsconfig.json"
check_file "packages/shared/src/index.ts" "Shared entry point"
check_dir "packages/shared/src/types" "Shared types"
check_dir "packages/shared/src/utils" "Shared utils"
check_dir "packages/shared/src/constants" "Shared constants"
echo ""

echo "🔧 Scripts & CI/CD"
echo "=================="
check_file "scripts/deploy.sh" "Deploy script"
check_file "scripts/check-bundle-size.js" "Bundle size check"
check_dir ".github/workflows" "GitHub workflows"
check_file ".husky/pre-commit" "Pre-commit hook"
check_file ".lintstagedrc.json" "Lint-staged config"
echo ""

echo "📖 Documentation"
echo "==============="
check_file "PROJECT_STRUCTURE.md" "Project structure"
check_file "INITIALIZATION_SUMMARY.md" "Initialization summary"
check_file "QUICK_START.md" "Quick start guide"
check_file "NEXT_STEPS.md" "Next steps"
echo ""

echo "📊 Summary"
echo "=========="
echo -e "Total checks: $total"
echo -e "${GREEN}Passed: $passed${NC}"
echo -e "${RED}Failed: $failed${NC}"
echo ""

if [ $failed -eq 0 ]; then
  echo -e "${GREEN}🎉 All checks passed! Project is ready for development.${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠️  Some checks failed. Please review the output above.${NC}"
  exit 1
fi

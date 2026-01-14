#!/bin/bash

# ClaudeFlare CI/CD Setup Validation Script
# Verifies that all required files and configurations are in place

echo "🔍 ClaudeFlare CI/CD Setup Validation"
echo "======================================"
echo ""

ERRORS=0
WARNINGS=0

# Check required files
echo "1️⃣ Checking required files..."

FILES=(
  ".github/workflows/quality.yml"
  ".github/workflows/build.yml"
  ".github/workflows/deploy.yml"
  "package.json"
  "tsconfig.json"
  ".eslintrc.js"
  "wrangler.toml"
  "vitest.config.ts"
  ".env.example"
  ".gitignore"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file (MISSING)"
    ((ERRORS++))
  fi
done

echo ""

# Check deployment scripts
echo "2️⃣ Checking deployment scripts..."

SCRIPTS=(
  "scripts/deploy.sh"
  "scripts/rollback.sh"
  "scripts/verify-deployment.sh"
  "scripts/backup-deployment.sh"
  "scripts/setup.sh"
)

for script in "${SCRIPTS[@]}"; do
  if [ -f "$script" ]; then
    if [ -x "$script" ]; then
      echo "  ✅ $script (executable)"
    else
      echo "  ⚠️  $script (not executable)"
      ((WARNINGS++))
    fi
  else
    echo "  ❌ $script (MISSING)"
    ((ERRORS++))
  fi
done

echo ""

# Check utility scripts
echo "3️⃣ Checking utility scripts..."

UTILS=(
  "scripts/check-bundle-size.js"
  "scripts/check-coverage.js"
)

for script in "${UTILS[@]}"; do
  if [ -f "$script" ]; then
    echo "  ✅ $script"
  else
    echo "  ❌ $script (MISSING)"
    ((ERRORS++))
  fi
done

echo ""

# Check documentation
echo "4️⃣ Checking documentation..."

DOCS=(
  "README.md"
  "README-DEPLOYMENT.md"
  "CI-CD-SETUP-SUMMARY.md"
)

for doc in "${DOCS[@]}"; do
  if [ -f "$doc" ]; then
    echo "  ✅ $doc"
  else
    echo "  ⚠️  $doc (MISSING - recommended)"
    ((WARNINGS++))
  fi
done

echo ""

# Check source files
echo "5️⃣ Checking source files..."

if [ -f "src/index.ts" ]; then
  echo "  ✅ src/index.ts"
else
  echo "  ⚠️  src/index.ts (not created yet)"
  ((WARNINGS++))
fi

echo ""

# Check test configuration
echo "6️⃣ Checking test configuration..."

TEST_CONFIGS=(
  "vitest.config.ts"
  "vitest.integration.config.ts"
  "vitest.smoke.config.ts"
)

for config in "${TEST_CONFIGS[@]}"; do
  if [ -f "$config" ]; then
    echo "  ✅ $config"
  else
    echo "  ❌ $config (MISSING)"
    ((ERRORS++))
  fi
done

echo ""

# Check test setup
if [ -f "tests/setup.ts" ]; then
  echo "  ✅ tests/setup.ts"
else
  echo "  ⚠️  tests/setup.ts (not created yet)"
  ((WARNINGS++))
fi

echo ""

# Check dependencies
echo "7️⃣ Checking dependencies..."

if [ -d "node_modules" ]; then
  echo "  ✅ node_modules exists"
  
  # Check for key dependencies
  if [ -d "node_modules/.bin/esbuild" ]; then
    echo "  ✅ esbuild installed"
  else
    echo "  ⚠️  esbuild not found (run npm install)"
    ((WARNINGS++))
  fi
  
  if [ -d "node_modules/.bin/wrangler" ]; then
    echo "  ✅ wrangler installed"
  else
    echo "  ⚠️  wrangler not found (run npm install)"
    ((WARNINGS++))
  fi
  
  if [ -d "node_modules/.bin/vitest" ]; then
    echo "  ✅ vitest installed"
  else
    echo "  ⚠️  vitest not found (run npm install)"
    ((WARNINGS++))
  fi
else
  echo "  ⚠️  node_modules not found (run npm install)"
  ((WARNINGS++))
fi

echo ""

# Check environment
echo "8️⃣ Checking environment setup..."

if [ -f ".env" ]; then
  echo "  ✅ .env file exists"
  
  # Check for required variables (without showing values)
  if grep -q "CLOUDFLARE_ACCOUNT_ID=" .env 2>/dev/null; then
    echo "  ✅ CLOUDFLARE_ACCOUNT_ID set"
  else
    echo "  ⚠️  CLOUDFLARE_ACCOUNT_ID not set"
    ((WARNINGS++))
  fi
  
  if grep -q "CLOUDFLARE_API_TOKEN=" .env 2>/dev/null; then
    echo "  ✅ CLOUDFLARE_API_TOKEN set"
  else
    echo "  ⚠️  CLOUDFLARE_API_TOKEN not set"
    ((WARNINGS++))
  fi
else
  echo "  ⚠️  .env file not found (copy from .env.example)"
  ((WARNINGS++))
fi

echo ""

# Summary
echo "======================================"
echo "Validation Summary"
echo "======================================"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo "✅ All checks passed! Your CI/CD setup is complete."
  echo ""
  echo "Next steps:"
  echo "1. Configure GitHub Secrets (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN)"
  echo "2. Run 'npm install' to install dependencies"
  echo "3. Run './scripts/setup.sh' to complete initial setup"
  echo "4. Deploy to staging: 'npm run deploy:staging'"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo "⚠️  Setup complete with $WARNINGS warning(s)."
  echo ""
  echo "Please address the warnings above for optimal setup."
  exit 0
else
  echo "❌ Setup incomplete: $ERRORS error(s), $WARNINGS warning(s)"
  echo ""
  echo "Please fix the errors before proceeding."
  exit 1
fi

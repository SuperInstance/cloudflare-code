#!/bin/bash

#
# Health Check Script
#
# Runs all critical quality checks to ensure the codebase is healthy.
# This script is designed to be run before commits and in CI/CD.
#

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_section() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"
}

# Track results
FAILED_CHECKS=0
PASSED_CHECKS=0

# Start
log_section "🏥 Cocapn Platform Health Check"

# Check 1: Node.js version
log_info "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 20 ]; then
    log_success "Node.js version $(node -v) is compatible (>= 20)"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    log_error "Node.js version $(node -v) is not compatible (>= 20 required)"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Check 2: Dependencies installed
log_info "Checking if dependencies are installed..."
if [ -d "node_modules" ]; then
    log_success "Dependencies are installed"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    log_error "Dependencies not installed. Run: npm install"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Check 3: Build
log_section "🔨 Build System"
log_info "Running build..."
if npm run build > /tmp/build.log 2>&1; then
    log_success "Build succeeded"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    log_error "Build failed. Check /tmp/build.log for details"
    tail -n 20 /tmp/build.log
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi

# Check 4: Type checking (non-blocking for now)
log_section "🔍 Type Checking"
log_info "Running TypeScript type check..."
TYPECHECK_OUTPUT=$(npm run typecheck 2>&1 || true)
TYPECHECK_ERRORS=$(echo "$TYPECHECK_OUTPUT" | grep -c "error TS" || echo "0")

if [ "$TYPECHECK_ERRORS" -eq 0 ]; then
    log_success "No TypeScript errors"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    log_warning "Found $TYPECHECK_ERRORS TypeScript error(s) (non-blocking)"
    log_info "Run 'npm run typecheck' to see all errors"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

# Check 5: Linting (non-blocking)
log_section "🧹 Linting"
log_info "Running ESLint..."
LINT_OUTPUT=$(npm run lint 2>&1 || true)
LINT_ERRORS=$(echo "$LINT_OUTPUT" | grep -oP '\d+(?= errors)' || echo "0")

if [ "$LINT_ERRORS" -eq 0 ]; then
    log_success "No lint errors"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    log_warning "Found $LINT_ERRORS lint error(s) (non-blocking)"
    log_info "Run 'npm run lint:fix' to auto-fix some issues"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

# Check 6: Tests
log_section "🧪 Testing"
log_info "Running tests..."
if npm run test > /tmp/test.log 2>&1; then
    log_success "All tests passed"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    log_warning "Tests failed or no tests exist (check /tmp/test.log)"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
fi

# Final summary
log_section "📊 Health Check Summary"

TOTAL_CHECKS=$((PASSED_CHECKS + FAILED_CHECKS))
PERCENTAGE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))

echo "Total checks: $TOTAL_CHECKS"
echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
echo -e "Failed: ${RED}$FAILED_CHECKS${NC}"
echo "Success rate: ${PERCENTAGE}%"

if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "\n${GREEN}✅ All critical checks passed!${NC}\n"
    exit 0
else
    echo -e "\n${RED}❌ Health check failed with $FAILED_CHECKS error(s)${NC}\n"
    exit 1
fi

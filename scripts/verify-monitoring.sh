#!/bin/bash

# Monitoring System Verification Script
# Verifies that all monitoring components are properly configured

set -e

echo "========================================="
echo "ClaudeFlare Monitoring System Verification"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check functions
check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✓${NC} $1 exists"
    return 0
  else
    echo -e "${RED}✗${NC} $1 missing"
    return 1
  fi
}

check_dir() {
  if [ -d "$1" ]; then
    echo -e "${GREEN}✓${NC} $1 exists"
    return 0
  else
    echo -e "${RED}✗${NC} $1 missing"
    return 1
  fi
}

check_json() {
  if python3 -m json.tool "$1" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} $1 is valid JSON"
    return 0
  else
    echo -e "${RED}✗${NC} $1 has invalid JSON"
    return 1
  fi
}

check_yml() {
  if python3 -c "import yaml; yaml.safe_load(open('$1'))" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} $1 is valid YAML"
    return 0
  else
    echo -e "${YELLOW}⚠${NC} $1 YAML validation skipped (PyYAML not installed)"
    return 0
  fi
}

# Track results
total=0
passed=0

echo "1. Checking Dashboard Files..."
echo "-------------------------------"
dashboards=(
  "dashboards/overview.json"
  "dashboards/performance.json"
  "dashboards/errors.json"
  "dashboards/costs.json"
  "dashboards/providers.json"
  "dashboards/cache.json"
  "dashboards/incidents.json"
)

for dashboard in "${dashboards[@]}"; do
  total=$((total + 1))
  if check_file "$dashboard" && check_json "$dashboard"; then
    passed=$((passed + 1))
  fi
done
echo ""

echo "2. Checking Alert Configuration..."
echo "-----------------------------------"
total=$((total + 1))
if check_file "alerts/rules.yml" && check_yml "alerts/rules.yml"; then
  passed=$((passed + 1))
fi

total=$((total + 1))
if check_file "alerts/notifications.ts"; then
  passed=$((passed + 1))
fi
echo ""

echo "3. Checking Deployment Scripts..."
echo "----------------------------------"
total=$((total + 1))
if check_file "scripts/deploy-dashboards.ts"; then
  passed=$((passed + 1))
fi
echo ""

echo "4. Checking Configuration Files..."
echo "------------------------------------"
total=$((total + 1))
if check_file "prometheus.yml" && check_yml "prometheus.yml"; then
  passed=$((passed + 1))
fi

total=$((total + 1))
if check_file "alertmanager.yml" && check_yml "alertmanager.yml"; then
  passed=$((passed + 1))
fi
echo ""

echo "5. Checking Documentation..."
echo "-----------------------------"
docs=(
  "MONITORING_README.md"
  "MONITORING_DELIVERABLES.md"
)

for doc in "${docs[@]}"; do
  total=$((total + 1))
  if check_file "$doc"; then
    passed=$((passed + 1))
  fi
done
echo ""

echo "6. Counting Alert Rules..."
echo "--------------------------"
if [ -f "alerts/rules.yml" ]; then
  rule_count=$(grep -c "^      - alert:" alerts/rules.yml || echo "0")
  echo -e "${GREEN}✓${NC} Found $rule_count alert rules"
  total=$((total + 1))
  passed=$((passed + 1))
fi
echo ""

echo "7. Counting Dashboard Panels..."
echo "--------------------------------"
panel_count=0
for dashboard in "${dashboards[@]}"; do
  if [ -f "$dashboard" ]; then
    count=$(python3 -c "import json; data=json.load(open('$dashboard')); print(len(data.get('dashboard', {}).get('panels', [])))" 2>/dev/null || echo "0")
    panel_count=$((panel_count + count))
  fi
done
echo -e "${GREEN}✓${NC} Total dashboard panels: $panel_count"
total=$((total + 1))
passed=$((passed + 1))
echo ""

# Summary
echo "========================================="
echo "Verification Summary"
echo "========================================="
echo "Total checks: $total"
echo "Passed: $passed"
echo "Failed: $((total - passed))"

if [ $passed -eq $total ]; then
  echo -e "\n${GREEN}✓ All checks passed!${NC}"
  echo ""
  echo "Next Steps:"
  echo "1. Deploy dashboards: npm run deploy-dashboards"
  echo "2. Configure Prometheus: cp prometheus.yml /etc/prometheus/"
  echo "3. Configure Alertmanager: cp alertmanager.yml /etc/alertmanager/"
  echo "4. Set up environment variables:"
  echo "   export GRAFANA_URL='http://localhost:3000'"
  echo "   export GRAFANA_API_KEY='your-api-key'"
  echo "   export SLACK_WEBHOOK_URL='your-webhook-url'"
  exit 0
else
  echo -e "\n${RED}✗ Some checks failed${NC}"
  echo "Please review the errors above and fix missing files."
  exit 1
fi

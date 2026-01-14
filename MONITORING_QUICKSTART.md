# ClaudeFlare Monitoring - Quick Start Guide

Get up and running with ClaudeFlare monitoring in 5 minutes.

## Prerequisites

- Grafana 9.x or higher
- Prometheus 2.x or higher
- ClaudeFlare deployed and running
- Node.js 18+ (for deployment scripts)

## Installation

### 1. Verify Files

```bash
# Run verification script
./scripts/verify-monitoring.sh

# Expected output: All checks passed ✓
```

### 2. Set Up Grafana

```bash
# Install Grafana (if not already installed)
# On Ubuntu/Debian:
sudo apt-get install -y grafana

# On macOS:
brew install grafana

# Start Grafana
sudo systemctl start grafana
# or on macOS:
brew services start grafana

# Access Grafana
open http://localhost:3000
# Default credentials: admin/admin
```

### 3. Configure Prometheus Data Source in Grafana

1. Go to Configuration → Data Sources → Add data source
2. Select "Prometheus"
3. Set URL to: `http://localhost:9090`
4. Click "Save & Test"

### 4. Deploy Dashboards

```bash
# Set environment variables
export GRAFANA_URL="http://localhost:3000"
export GRAFANA_API_KEY="your-api-key-here"

# Create Grafana API key
# In Grafana: Configuration → API Keys → Add API key
# Role: Admin
# Key name: ClaudeFlare Deployer

# Deploy all dashboards
npm run deploy-dashboards

# Or validate first
npm run validate-dashboards
```

### 5. Configure Prometheus

```bash
# Copy Prometheus configuration
cp prometheus.yml /etc/prometheus/prometheus.yml

# Install Prometheus (if not already installed)
# On Ubuntu/Debian:
sudo apt-get install -y prometheus

# On macOS:
brew install prometheus

# Start Prometheus
prometheus --config.file=/etc/prometheus/prometheus.yml
# or with systemctl:
sudo systemctl start prometheus
```

### 6. Configure Alertmanager

```bash
# Copy Alertmanager configuration
cp alertmanager.yml /etc/alertmanager/alertmanager.yml

# Install Alertmanager (if not already installed)
# On Ubuntu/Debian:
sudo apt-get install -y prometheus-alertmanager

# Start Alertmanager
alertmanager --config.file=/etc/alertmanager/alertmanager.yml
# or with systemctl:
sudo systemctl start prometheus-alertmanager
```

### 7. Configure Notifications

```bash
# Set up notification channels
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
export PAGERDUTY_INTEGRATION_KEY="your-pagerduty-key"
export ALERT_EMAIL="team@example.com"

# Update alertmanager.yml with your credentials
# Test Slack webhook
curl -X POST $SLACK_WEBHOOK_URL -d '{"text":"Test notification from ClaudeFlare"}'
```

## Verify Setup

### Check Prometheus is Scraping

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'

# Check metrics are being collected
curl http://localhost:9090/api/v1/label/__name__/values | jq '.data[] | select(. | startswith("claudeflare"))'
```

### Check Dashboards

1. Go to Dashboards in Grafana
2. Look for "ClaudeFlare" folder
3. Open "System Overview" dashboard
4. Verify panels are showing data

### Check Alerts

```bash
# Check alert rules are loaded
curl http://localhost:9090/api/v1/rules | jq '.data.groups[] | {name: .name, rules: .rules | length}'

# Check for firing alerts
curl http://localhost:9090/api/v1/alerts | jq '.data.alerts[] | {alertname: .labels.alertname, state: .state}'
```

## Next Steps

1. **Customize Dashboards**
   - Adjust time ranges for your needs
   - Add additional panels
   - Set up variables for dynamic filtering

2. **Configure Alert Thresholds**
   - Review alert rules in `alerts/rules.yml`
   - Adjust thresholds for your environment
   - Set up notification channels

3. **Set Up Incident Response**
   - Create on-call schedule
   - Document runbooks
   - Configure escalation policies

4. **Monitor Regularly**
   - Check dashboards daily
   - Review incident reports
   - Optimize based on metrics

## Common Issues

### Dashboards Not Showing Data

**Problem**: Panels show "No data"

**Solution**:
1. Check Prometheus is running: `ps aux | grep prometheus`
2. Verify data source in Grafana: Configuration → Data Sources → Prometheus → Test
3. Check metrics endpoint: `curl http://claudeflare:8787/metrics`

### Alerts Not Firing

**Problem**: Alerts not triggering

**Solution**:
1. Check alert rules: `curl http://localhost:9090/api/v1/rules`
2. Verify alert evaluation: `curl http://localhost:9090/api/v1/alerts`
3. Check Alertmanager is running: `ps aux | grep alertmanager`

### Notifications Not Sending

**Problem**: No notifications received

**Solution**:
1. Test webhook: `curl -X POST $SLACK_WEBHOOK_URL -d '{"text":"test"}'`
2. Check Alertmanager logs: `journalctl -u prometheus-alertmanager -f`
3. Verify notification configuration in `alertmanager.yml`

## Getting Help

- **Documentation**: See `MONITORING_README.md` for detailed guides
- **Deliverables**: See `MONITORING_DELIVERABLES.md` for complete feature list
- **Issues**: Report bugs at https://github.com/claudeflare/claudeflare/issues
- **Community**: Join Discord at https://discord.gg/claudeflare

## Metrics Reference

### Key Metrics to Monitor

- `claudeflare_health` - System health (0/1)
- `claudeflare_requests_total` - Total requests
- `claudeflare_request_duration_seconds` - Request latency
- `claudeflare_errors_total` - Total errors
- `claudeflare_cache_hit_rate` - Cache hit rate
- `claudeflare_cost_total_dollars` - Total cost
- `claudeflare_alerts_active` - Active alerts

See `MONITORING_README.md` for complete metrics reference.

## Dashboard URLs

Once deployed, access dashboards at:

- System Overview: http://localhost:3000/d/claudeflare-overview
- Performance: http://localhost:3000/d/claudeflare-performance
- Errors: http://localhost:3000/d/claudeflare-errors
- Costs: http://localhost:3000/d/claudeflare-costs
- Providers: http://localhost:3000/d/claudeflare-providers
- Cache: http://localhost:3000/d/claudeflare-cache
- Incidents: http://localhost:3000/d/claudeflare-incidents

## Maintenance

### Daily

- Review active incidents
- Check critical alerts
- Monitor system health

### Weekly

- Review alert performance
- Update dashboards as needed
- Check notification channel health

### Monthly

- Review and update thresholds
- Analyze trends and patterns
- Optimize dashboard performance
- Conduct incident post-mortems

---

**Status**: ✓ All components verified and ready for deployment
**Version**: 1.0.0
**Last Updated**: 2025-01-13

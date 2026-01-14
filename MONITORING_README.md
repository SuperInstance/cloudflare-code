# ClaudeFlare Monitoring System

Comprehensive monitoring dashboards and alerting system for ClaudeFlare distributed AI coding platform on Cloudflare Workers.

## Overview

This monitoring system provides real-time visibility into:
- System health and performance
- Request metrics and latency
- Error tracking and incident response
- Cost analytics and budgeting
- AI provider performance
- Cache efficiency and performance
- Resource utilization

## Components

### Dashboards (Grafana)

Located in `/dashboards/` directory:

1. **overview.json** - System Overview Dashboard
   - System health status
   - Request rate and error rate
   - Cache hit rate
   - Average latency
   - Active alerts
   - Resource usage

2. **performance.json** - Performance Metrics Dashboard
   - Response time distribution
   - Latency percentiles (p50, p95, p99)
   - Cold start frequency
   - Provider response times
   - Cache latency by tier
   - Database query times
   - Performance score

3. **errors.json** - Error Tracking Dashboard
   - Error rate by type and endpoint
   - Error rate by provider
   - Top error messages
   - Error trends
   - Recent error logs
   - Error distribution by status code

4. **costs.json** - Cost Analytics Dashboard
   - Total cost per day/hour
   - Cost by provider and model
   - Cost by feature
   - Cache savings
   - Cost per 1K requests
   - Cost forecasts
   - Budget utilization

5. **providers.json** - AI Provider Metrics Dashboard
   - Provider availability
   - Request distribution
   - Model distribution
   - Token usage rates
   - Rate limit utilization
   - Cost per 1K tokens
   - Success/error rates

6. **cache.json** - Cache Performance Dashboard
   - Overall cache hit rate
   - Cache hits/misses
   - Hit rate by tier (hot/warm/cold)
   - Cache latency by tier
   - Cache size and entry count
   - Evictions
   - Cache savings

7. **incidents.json** - Incident Response Dashboard
   - Active incidents
   - Critical incidents
   - MTTR (Mean Time to Resolve)
   - Incident rate
   - Incidents by severity and category
   - Resolution time
   - SLA compliance

### Alert Rules

Located in `/alerts/rules.yml`:

Contains 50+ alert rules organized into groups:

- **system_health** - System-level health alerts
- **performance** - Performance degradation alerts
- **providers** - AI provider alerts
- **cache** - Cache performance alerts
- **costs** - Cost and budget alerts
- **resources** - Resource utilization alerts
- **availability** - Service availability alerts
- **anomalies** - Anomaly detection alerts

### Notification Handlers

Located in `/alerts/notifications.ts`:

Supports multiple notification channels:
- Slack
- Email
- PagerDuty
- Discord
- Microsoft Teams
- Custom Webhooks

### Deployment Scripts

Located in `/scripts/`:

- **deploy-dashboards.ts** - Grafana dashboard deployment script

## Quick Start

### Prerequisites

1. Grafana instance running and accessible
2. Prometheus server scraping metrics from ClaudeFlare
3. ClaudeFlare monitoring system initialized

### Installation

1. **Set up Grafana data source**

```bash
# Add Prometheus as data source in Grafana
# Settings -> Data Sources -> Add Prometheus
# URL: http://prometheus:9090
```

2. **Configure environment variables**

```bash
export GRAFANA_URL="http://localhost:3000"
export GRAFANA_API_KEY="your-api-key"
export GRAFANA_FOLDER="ClaudeFlare"
```

3. **Deploy dashboards**

```bash
# Validate dashboards before deployment
npm run deploy-dashboards -- validate

# Deploy all dashboards
npm run deploy-dashboards -- deploy

# Export dashboards from Grafana
npm run deploy-dashboards -- export ./exported-dashboards
```

4. **Configure alerting**

```bash
# Set up notification channels in your environment
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
export PAGERDUTY_INTEGRATION_KEY="your-pagerduty-key"
export ALERT_EMAIL="team@example.com"

# Deploy Prometheus alert rules
promtool check config alerts/rules.yml
curl -X POST http://prometheus:9090/api/v1/rules -d @alerts/rules.yml
```

## Metrics Reference

### System Metrics

```
claudeflare_health                    - System health status (0/1)
claudeflare_up                        - Service up status (0/1)
claudeflare_start_time_seconds        - Service start timestamp
claudeflare_uptime_seconds            - Service uptime
```

### Request Metrics

```
claudeflare_requests_total            - Total request counter
claudeflare_request_duration_seconds  - Request latency histogram
claudeflare_requests_rate             - Request rate per second
```

### Error Metrics

```
claudeflare_errors_total              - Total error counter
claudeflare_error_rate                - Error rate
claudeflare_errors_by_type            - Errors grouped by type
```

### Provider Metrics

```
claudeflare_provider_up               - Provider availability (0/1)
claudeflare_provider_requests_total   - Requests per provider
claudeflare_provider_latency_seconds  - Provider latency histogram
claudeflare_provider_tokens_total     - Tokens used per provider
claudeflare_provider_cost_dollars     - Cost per provider
```

### Cache Metrics

```
claudeflare_cache_hit_rate            - Overall cache hit rate
claudeflare_cache_hits_total          - Cache hit counter
claudeflare_cache_misses_total        - Cache miss counter
claudeflare_cache_latency_seconds     - Cache latency histogram
claudeflare_cache_size_bytes          - Cache size by tier
claudeflare_cache_entries             - Entry count by tier
claudeflare_cache_evictions_total     - Eviction counter
claudeflare_cache_savings_dollars     - Cost savings from cache
```

### Cost Metrics

```
claudeflare_cost_total_dollars        - Total cost counter
claudeflare_cost_per_1k_requests      - Cost per 1K requests
claudeflare_provider_cost_per_1k_tokens - Cost per 1K tokens by provider
claudeflare_model_cost_dollars        - Cost by model
claudeflare_feature_cost_dollars      - Cost by feature
```

### Resource Metrics

```
claudeflare_memory_bytes              - Memory usage
claudeflare_memory_limit_bytes        - Memory limit
claudeflare_cpu_time_seconds_total    - CPU time counter
claudeflare_do_instances_active       - Active DO instances
claudeflare_kv_operations_total       - KV operation counter
claudeflare_r2_operations_total       - R2 operation counter
claudeflare_d1_query_duration_seconds - D1 query duration
```

### Alert Metrics

```
claudeflare_alerts_total              - Total alert counter
claudeflare_alerts_active             - Active alert gauge
claudeflare_alerts_by_severity        - Alerts grouped by severity
```

## Alert Rules

### Severity Levels

- **info** - Informational alerts
- **warning** - Warning requiring attention
- **critical** - Critical issues requiring immediate action
- **emergency** - Emergency situations

### Key Alerts

1. **High Error Rate** (> 5% for 5 minutes)
2. **Critical Error Rate** (> 10% for 2 minutes)
3. **High Latency** (p95 > 1s for 10 minutes)
4. **Provider Down** (provider unavailable for 1 minute)
5. **Low Cache Hit Rate** (< 50% for 10 minutes)
6. **High Cost Rate** (>$100/hour)
7. **Budget Exceeded** (daily cost >$100)
8. **High Memory Usage** (> 90% for 5 minutes)

## Notification Channels

### Slack

```typescript
{
  type: 'slack',
  config: {
    webhookUrl: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
    channel: '#alerts',
    username: 'ClaudeFlare Alerts',
    iconEmoji: ':bell:',
  },
  enabled: true,
}
```

### Email

```typescript
{
  type: 'email',
  config: {
    to: ['team@example.com'],
    cc: ['manager@example.com'],
    subject: 'ClaudeFlare Alert',
  },
  enabled: true,
}
```

### PagerDuty

```typescript
{
  type: 'pagerduty',
  config: {
    integrationKey: 'your-pagerduty-integration-key',
    severity: 'critical',
  },
  enabled: true,
}
```

## Incident Response Workflow

1. **Detection** - Alert triggered by monitoring system
2. **Notification** - Sent to configured channels
3. **Acknowledgment** - Alert acknowledged by on-call engineer
4. **Investigation** - Root cause analysis
5. **Resolution** - Issue resolved
6. **Post-Mortem** - Document and learn from incident

## Best Practices

### Dashboard Usage

- Set appropriate time ranges for your analysis
- Use auto-refresh for real-time monitoring (15-30 seconds)
- Pin important panels to the top
- Set up alerts for critical metrics
- Review dashboards regularly for trends

### Alert Configuration

- Set appropriate thresholds for your environment
- Use cooldown periods to prevent alert fatigue
- Configure multiple notification channels for critical alerts
- Regularly review and update alert rules
- Document runbooks for common alerts

### Performance Optimization

- Use Prometheus recording rules for expensive queries
- Set appropriate data retention periods
- Use Grafana variables for dynamic dashboards
- Optimize query performance with proper time ranges
- Use dashboard folders for organization

## Troubleshooting

### Dashboards Not Loading

1. Check Grafana is accessible
2. Verify Prometheus data source is configured
3. Check Prometheus is scraping metrics
4. Review Grafana logs for errors

### Alerts Not Firing

1. Check alert rules are loaded in Prometheus
2. Verify alert thresholds are appropriate
3. Check notification channel configuration
4. Review alert evaluation logs

### Metrics Missing

1. Verify ClaudeFlare monitoring system is initialized
2. Check metrics endpoint is accessible: `/metrics`
3. Review Prometheus scraping configuration
4. Check for metric name changes

## Maintenance

### Daily

- Review active incidents
- Check critical alerts
- Monitor system health
- Review cost metrics

### Weekly

- Review alert performance
- Update dashboards as needed
- Review and optimize alert rules
- Check notification channel health

### Monthly

- Review and update thresholds
- Analyze trends and patterns
- Optimize dashboard performance
- Conduct incident post-mortems

## Contributing

When adding new dashboards:

1. Follow the existing dashboard structure
2. Use consistent naming conventions
3. Include appropriate metric queries
4. Set reasonable thresholds
5. Document panels and queries
6. Test before deployment

## Support

- Documentation: https://docs.claudeflare.ai
- Issues: https://github.com/claudeflare/claudeflare/issues
- Community: https://discord.gg/claudeflare

## License

MIT License - see LICENSE file for details

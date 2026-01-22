# Package Consolidation Plan: 117 → ~20 Packages

**Current State**: 117 packages, 187MB
**Target**: ~20 packages, <50MB
**Reduction**: 83% fewer packages, 73% smaller

---

## Core Packages to Keep (15)

### Essential Platform (5)
```
✅ KEEP: api-gateway-v3 (rename to api-gateway)
✅ KEEP: codegen (core AI feature)
✅ KEEP: cli (developer tools)
✅ KEEP: dashboard (UI)
✅ KEEP: shared (utilities)
```

### Storage & Data (3)
```
✅ KEEP: storage (merge: storage, cache-v2, cdn)
✅ KEEP: d1 (if separate, otherwise merge into storage)
✅ KEEP: state-machine (for Durable Objects coordination)
```

### AI & Agents (3)
```
✅ KEEP: xai (AI provider integration)
✅ KEEP: agent-framework (merge: agent-framework + agents)

CONSIDER:
- vector-search (keep if core to AI features, otherwise archive)
- context (keep if needed for chat context, otherwise merge into agent-framework)
```

### Security (2)
```
✅ KEEP: security (merge: security + security-core + security-monitoring)

ARCHIVE:
- security-dashboard (UI feature, merge into dashboard)
- security-testing (nice-to-have, defer)
```

### Infrastructure (2)
```
✅ KEEP: workflows (deployment orchestration)

ARCHIVE/CONSOLIDATE:
- cdn → merge into storage
- scheduler → merge into workflows
```

---

## Packages to Archive Immediately (80+)

### Enterprise/Unused (20)
```
ARCHIVE:
- ab-testing
- audit
- autoscaling
- billing
- business-core
- collaboration
- community
- compliance
- customer-success
- data-export
- data-import
- pipelines
- platform
- platform-polish
- pricing
- rbac
- referral
- saas-core
- service-mesh
```

### Monitoring/Analytics (15)
```
ARCHIVE (keep 2 max):
- analytics
- analytics-platform
- benchmark
- benchmark-core
- monitoring-dashboard
- observability
- performance-monitoring
- user-analytics

KEEP (merge into 2):
- One for metrics collection
- One for dashboards
```

### Testing/Quality (10)
```
ARCHIVE:
- code-review
- quality
- test
- testing
- testing-framework

KEEP:
- Minimal testing in shared/
```

### SDKs/Languages (5)
```
ARCHIVE:
- sdk-go
- sdk-python
- sdk-ts (if not actively used)

KEEP:
- Only if actively used and documented
```

### Experimental/Unused (30)
```
ARCHIVE:
- circuit-breaker-v2
- core-interfaces
- data-warehouse
- deployment-pipelines
- edge
- event-bus
- feature-flags
- graphql
- integrations
- marketplace
- messaging
- micro-frontends
- ml
- multi-tenant
- notifications
- rate-limiter
- refactor
- rl (reinforcement learning?)
- soc
- streaming
- versioning
- visual-builder
- vscode
- webhooks
```

---

## Consolidation Actions

### Phase 1: Archive Unused (Day 1)
```bash
# Create archive directory
mkdir -p packages/archived

# Move unused packages
mv packages/ab-testing packages/archived/
mv packages/audit packages/archived/
mv packages/autoscaling packages/archived/
# ... continue for all 80+ unused packages
```

### Phase 2: Merge Related Packages (Day 2-3)
```bash
# Merge storage packages
mkdir -p packages/consolidated/storage
mv packages/storage/* packages/consolidated/storage/
mv packages/cache-v2/* packages/consolidated/storage/
mv packages/cdn/* packages/consolidated/storage/
rm -rf packages/storage packages/cache-v2 packages/cdn

# Merge security packages
mkdir -p packages/consolidated/security
mv packages/security/* packages/consolidated/security/
mv packages/security-core/* packages/consolidated/security/
mv packages/security-monitoring/* packages/consolidated/security/
rm -rf packages/security packages/security-core packages/security-monitoring
```

### Phase 3: Update Imports (Day 3-4)
```bash
# Find all imports
grep -r "from.*@cocapn/" src/ --no-filename | sort | uniq

# Update import paths
# @cocapn/storage → @cocapn/consolidated/storage
# @cocapn/security → @cocapn/consolidated/security
# etc.
```

### Phase 4: Test & Validate (Day 4-5)
```bash
npm run build
npm run typecheck
npm run test
npm run deploy:staging
```

---

## Final Package Structure

```
packages/
├── api-gateway/          # Main API (v3 renamed)
├── agent-framework/      # AI agent orchestration
├── cli/                  # Developer CLI tools
├── codegen/              # AI code generation
├── consolidated/
│   ├── storage/          # Unified storage (KV + D1 + R2 + cache)
│   ├── security/         # Unified security
│   └── monitoring/       # Unified monitoring
├── dashboard/            # Main UI
├── shared/               # Shared utilities
├── state-machine/        # Durable Objects state
├── workflows/            # Deployment orchestration
└── xai/                  # AI provider integration

Total: ~15 packages
```

---

## Success Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Packages | 117 | ~20 | 83% reduction |
| Size | 187MB | <50MB | 73% reduction |
| Build time | TBD | <10s | Measure baseline |
| Bundle size | 640KB | <400KB | 37% reduction |

---

## Execution Timeline

**Day 1**: Archive 80+ unused packages
**Day 2-3**: Consolidate related packages
**Day 3-4**: Update imports and fix build
**Day 4-5**: Test and validate
**Day 5**: Deploy and monitor

---

*Plan Version: 1.0*
*Created: 2026-01-21*
*Status: Ready for Execution*

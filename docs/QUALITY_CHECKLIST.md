# Quality Checklist
## Cocapn Platform - Pre-Commit Quality Gates

This checklist ensures code quality and prevents issues before they reach production.

---

## Pre-Commit Checklist

Use this checklist before committing any code changes.

### Code Quality ✅

- [ ] **No TypeScript errors**
  ```bash
  npm run typecheck
  ```
  - Must pass with 0 errors
  - Warnings are acceptable but should be minimized

- [ ] **No critical lint errors**
  ```bash
  npm run lint
  ```
  - May have warnings (code style, etc.)
  - Must fix errors related to broken imports, syntax errors, etc.

- [ ] **Build succeeds**
  ```bash
  npm run build
  ```
  - `dist/worker.js` must be generated
  - Build time should be reasonable (<60s)

- [ ] **Tests pass** (when tests exist)
  ```bash
  npm run test
  ```
  - All tests must pass
  - New features should include tests

- [ ] **No broken imports**
  - All imports must resolve to existing files
  - No references to deleted/archived packages
  - Use local `src/types/` for type definitions

### Core Functionality 🔧

- [ ] **Chat interface works**
  - WebSocket connections establish
  - Messages are sent and received
  - AI providers respond correctly

- [ ] **Code generation works**
  - AI Building Agent generates code
  - Multiple templates are available
  - Generated code is syntactically valid

- [ ] **Deployment works**
  - Cloudflare Workers deployment succeeds
  - Routes are accessible
  - Environment variables are configured

- [ ] **AI providers connect**
  - Anthropic API connectivity
  - OpenAI API connectivity
  - Fallback mechanisms work

### Performance ⚡

- [ ] **Build time is acceptable**
  - Target: <30s (currently: ~23ms ✅)
  - esbuild bundling is optimized
  - Source maps are generated

- [ ] **Bundle size is reasonable**
  - Current: ~159KB minified
  - Target: <3MB (✅ well under target)
  - No unnecessary dependencies included

- [ ] **No obvious performance regressions**
  - Response times are reasonable
  - Memory usage is acceptable
  - No blocking operations in hot paths

### Documentation 📚

- [ ] **README reflects current state**
  - Installation instructions work
  - Quick start guide is accurate
  - Features listed are implemented

- [ ] **Core docs are accurate**
  - ARCHITECTURE.md is up to date
  - ROADMAP.md reflects current progress
  - API docs match implementation

- [ ] **Changes are documented**
  - New features are documented
  - Breaking changes are noted
  - Migration guides are provided if needed

---

## Pre-Merge Checklist (for PRs)

Additional checks before merging to main branch.

### Testing
- [ ] All tests pass with coverage
- [ ] Manual testing completed for new features
- [ ] Edge cases are tested
- [ ] Error handling is tested

### Review
- [ ] Code review approved by at least one maintainer
- [ ] All review comments addressed
- [ ] No merge conflicts
- [ ] PR description is clear and complete

### Security
- [ ] No sensitive data in code
- [ ] No hardcoded credentials
- [ ] Dependencies are up to date
- [ ] Security scan passes (if available)

---

## Continuous Integration

These checks run automatically on every PR.

### Required Checks
```yaml
- Type Check (npm run typecheck)
- Build (npm run build)
- Lint (npm run lint)
- Test (npm run test)
```

### Optional Checks
```yaml
- Bundle Size Analysis
- Dependency Audit
- Security Scan
- Performance Benchmarks
```

---

## Quick Commands

### Full Quality Check
```bash
# Run all checks
npm run typecheck && npm run lint && npm run build && npm run test
```

### Quick Pre-Commit Check
```bash
# Fast check for obvious issues
npm run build && npm run typecheck
```

### Fix Auto-Fixable Issues
```bash
# Fix linting issues that can be auto-fixed
npm run lint:fix
```

---

## Quality Metrics

### Current State (as of 2026-01-22)

| Metric | Status | Target | Notes |
|--------|--------|--------|-------|
| Build | ✅ PASS | Must pass | 23ms build time |
| Bundle Size | ✅ 159KB | <3MB | Well under target |
| Type Check | ⚠️ 500+ errors | 0 errors | Non-blocking for build |
| Lint | ⚠️ 4800+ errors | <100 errors | Mostly code style issues |
| Tests | ❌ No tests | >80% coverage | Tests need to be created |
| Performance | ✅ Good | <100ms response | Meets targets |

### Improvement Plan

**Phase 1: Fix Blocking Issues** (Week 2)
- Resolve remaining TypeScript syntax errors
- Fix broken imports
- Set up basic test structure

**Phase 2: Code Quality** (Week 3-4)
- Reduce lint errors by 90%
- Add comprehensive type definitions
- Eliminate `any` types in critical paths

**Phase 3: Test Coverage** (Week 5-6)
- Achieve 80% test coverage on critical paths
- Set up E2E tests for core flows
- Implement regression tests

**Phase 4: Performance & Security** (Week 7-8)
- Optimize bundle size further
- Add security scanning
- Set up performance monitoring

---

## Troubleshooting

### Build Fails

1. Check TypeScript errors: `npm run typecheck`
2. Look for broken imports
3. Verify all dependencies are installed
4. Check for syntax errors in recently changed files

### Type Check Fails

1. Fix syntax errors first
2. Add missing type definitions
3. Update imports to use local types
4. Check for circular dependencies

### Tests Fail

1. Run tests in verbose mode: `npm run test -- --verbose`
2. Check for missing dependencies
3. Verify test configuration
4. Check environment variables

### Lint Fails

1. Run auto-fix: `npm run lint:fix`
2. Fix remaining issues manually
3. Consider disabling specific rules if needed
4. Update .eslintrc.cjs if rules are too strict

---

## Best Practices

### Code Style
- Use TypeScript for type safety
- Avoid `any` types - define proper interfaces
- Use async/await instead of promises
- Prefer const over let
- Use template literals over string concatenation

### Git Workflow
- Write clear, descriptive commit messages
- Keep commits atomic (one change per commit)
- Reference issues/PRs in commit messages
- Use conventional commit format: `type(scope): description`

### Testing
- Write tests before fixing bugs (TDD)
- Test edge cases and error conditions
- Keep tests simple and focused
- Use descriptive test names

---

*Last updated: 2026-01-22*
*Maintained by: Quality & Testing Validator*

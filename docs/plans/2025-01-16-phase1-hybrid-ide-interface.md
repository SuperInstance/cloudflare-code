# Phase 1: Foundation - Hybrid IDE Interface

**Goal:** Build chat-first development interface with Monaco/CodeMirror panels, file tree, preview panel, provider selector, and basic parallel agents for Cloudflare free tier optimization

**Duration:** 2 weeks

**Success Criteria:**
- User can chat to build a basic web app
- Multiple agents can work simultaneously without conflicts
- Editor panels open and close correctly
- Deploy button creates Worker in production
- Platform remains within Cloudflare free tier limits

## Task Breakdown

### Task 1: Project State Management (1 day)
**Files:**
- Create: `src/state/project-state.ts`
- Modify: `src/types/index.ts`

Implement KV-based state management for:
- Session management (create, load, save)
- File operations (load, save, delete)
- File locking (acquire, release, check)
- Agent management (create, update, get, delete)
- File listing

### Task 2: Coordinator Agent (2 days)
**Files:**
- Create: `src/durable/coordinator-agent.ts` - Durable Object for coordination
- Create: `src/agents/coordinator-agent.ts` - Wrapper for easier usage
- Modify: `src/index.ts` - Export DO class

Implement:
- Task breakdown (parse user intent into subtasks)
- Agent assignment (assign tasks to specialist agents)
- Parallel execution (execute independent tasks)
- Sequential execution (execute tasks with dependencies)
- File locking integration
- Conflict resolution

### Task 3: UI Agent (2 days)
**Files:**
- Create: `src/agents/ui-agent.ts`
- Modify: `src/types/index.ts` - Add UI Agent types

Implement:
- HTML/CSS generation
- Component templates
- Responsive layouts
- Design system integration (Canva Dev, Figma)

### Task 4: Database Agent (2 days)
**Files:**
- Create: `src/agents/database-agent.ts`
- Modify: `src/types/index.ts` - Add Database Agent types

Implement:
- D1 schema generation
- Migration generation
- Query builder functions
- Relationship modeling

### Task 5: API Agent (2 days)
**Files:**
- Create: `src/agents/api-agent.ts`
- Modify: `src/types/index.ts` - Add API Agent types

Implement:
- RESTful API generation
- OpenAPI spec generation
- WebSocket support
- Request/response validation

### Task 6: Deploy Agent (2 days)
**Files:**
- Create: `src/agents/deploy-agent.ts`
- Create: `src/utils/cloudflare-deploy.ts`

Implement:
- Worker bundling (esbuild)
- D1 schema execution
- KV namespace provisioning
- Route configuration
- Domain routing
- Deployment to `.workers.dev`

### Task 7: Chat Interface UI (3 days)
**Files:**
- Create: `src/components/chat-interface.tsx`
- Create: `src/components/editor-panel.tsx`
- Create: `src/components/file-tree.tsx`
- Modify: `src/routes/dev-routes.ts`

Implement:
- Chat message display
- Provider selector dropdown
- Open editor button
- Deploy button
- Ad placement banners

### Task 8: File Locking System (2 days)
**Files:**
- Create: `src/utils/file-locking.ts`

Implement:
- Lock acquisition with retry (3 attempts, 1-min timeout)
- Lock release
- Lock expiration handling
- Merge UI for conflicts

### Task 9: Preview Panel (2 days)
**Files:**
- Create: `src/components/preview-panel.tsx`
- Create: `src/utils/preview-utils.ts`

Implement:
- iframe-based preview
- Live Worker preview URL
- Refresh functionality
- Open in new tab

### Task 10: Testing & Deployment (2 days)
**Files:**
- Create integration tests
- Create E2E tests
- Deploy to cocapn.com/dev
- Smoke test deployment

## Testing Requirements

### Unit Tests
- Each agent tested independently
- Mock KV, R2, D1 bindings
- Test file locking scenarios
- Test coordinator agent logic

### Integration Tests
- Test agent coordination
- Test file locking conflicts
- Test deployment flow
- Test provider selection

### E2E Tests
- User journey: chat → code → deploy
- Parallel agents building simultaneously
- File locking prevents conflicts
- Deployment creates Worker successfully

## Acceptance Criteria

- User can create session and start building
- Multiple agents can work simultaneously on different files
- File locking prevents conflicts
- Deploy button creates Worker in production
- Preview panel shows live preview
- Platform stays within Cloudflare free tier limits
- All tests pass with 80%+ coverage
- Smoke test passes on cocapn.com/dev

---
**Ready for implementation?**

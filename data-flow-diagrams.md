# ClaudeFlare Data Flow Diagrams

**Document Version:** 1.0
**Last Updated:** 2026-01-13
**Related:** [Complete System Architecture](./COMPLETE_SYSTEM_ARCHITECTURE.md)

---

## Table of Contents

1. [Request Processing Flow](#1-request-processing-flow)
2. [Data Storage Flow](#2-data-storage-flow)
3. [Agent Communication Flow](#3-agent-communication-flow)
4. [WebRTC Connection Flow](#4-webrtc-connection-flow)
5. [Multi-Cloud Routing Flow](#5-multi-cloud-routing-flow)
6. [Cache Lookup Flow](#6-cache-lookup-flow)
7. [Vector Indexing Flow](#7-vector-indexing-flow)
8. [Security Authentication Flow](#8-security-authentication-flow)

---

## 1. Request Processing Flow

### 1.1 Complete Request Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER REQUEST PROCESSING                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. USER INITIATES REQUEST                                                  │
│     │                                                                       │
│     ├── User types: "Fix the authentication bug in login.ts"                │
│     ├── Context: VS Code extension, project loaded                          │
│     └── Requirements: High quality, <5s response                            │
│     │                                                                       │
│     ▼                                                                       │
│  2. EDGE WORKER RECEIVES REQUEST                                            │
│     │                                                                       │
│     ├── Cloudflare Worker at edge location (nearest to user)                │
│     ├── Parse request and extract metadata                                  │
│     │   - User ID, project ID, query text                                  │
│     │   - Session ID (or create new)                                       │
│     │   - Quality requirements, latency constraints                         │
│     └── Route to DirectorAgent DO                                          │
│     │                                                                       │
│     ▼                                                                       │
│  3. SEMANTIC CACHE LOOKUP                                                  │
│     │                                                                       │
│     ├── Generate embedding for query (BGE-M3 via Workers AI)                │
│     ├── Search HNSW index in VectorIndex DO                                 │
│     │   - Top 10 nearest neighbors                                         │
│     │   - Similarity threshold: 0.90                                       │
│     ├── Check if cached response is valid                                  │
│     │   - Project context unchanged?                                       │
│     │   - Model parameters match?                                          │
│     └── If HIT (90%+): Return cached response immediately (<10ms)          │
│         │                                                                   │
│         └── If MISS: Continue to step 4                                    │
│     │                                                                       │
│     ▼                                                                       │
│  4. SESSION ORCHESTRATION (DirectorAgent DO)                                │
│     │                                                                       │
│     ├── Load session state from storage                                    │
│     │   - HOT: DO memory (sub-ms) if recently active                       │
│     │   - WARM: KV (1-50ms) if within 1 hour                              │
│     │   - COLD: R2 (50-100ms) if older                                    │
│     ├── Restore conversation history                                        │
│     ├── Verify project context integrity                                    │
│     │   - Check file hashes for changed files                              │
│     │   - Invalidate cache if files changed                                │
│     └── Delegate to PlannerAgent                                           │
│     │                                                                       │
│     ▼                                                                       │
│  5. TASK DECOMPOSITION (PlannerAgent DO)                                    │
│     │                                                                       │
│     ├── Analyze query intent                                                │
│     │   - Intent: Debugging/Fixing bug                                     │
│     │   - Target file: login.ts                                            │
│     │   - Complexity: Medium                                               │
│     ├── Break into subtasks                                                 │
│     │   1. Read login.ts and understand current implementation             │
│     │   2. Identify authentication bug                                     │
│     │   3. Propose fix                                                     │
│     │   4. Generate corrected code                                         │
│     ├── Optimize for parallel execution                                     │
│     │   - Subtasks 1-2 can run in parallel (read file, analyze bug)        │
│     │   - Subtask 3 depends on 1-2                                        │
│     │   - Subtask 4 depends on 3                                           │
│     └── Create execution plan                                              │
│     │                                                                       │
│     ▼                                                                       │
│  6. CONTEXT ASSEMBLY                                                       │
│     │                                                                       │
│     ├── Gather relevant context from vector database                       │
│     │   - Hybrid search (Semantic 0.7 + BM25 0.3)                         │
│     │   - Query: "authentication login.ts bug"                            │
│     │   - Retrieve: 15 most relevant code chunks                           │
│     ├── Assemble infinite context window                                   │
│     │   - System prompt (cacheable)                                       │
│     │   - Project documentation (cacheable)                                │
│     │   - Relevant code chunks (semantic retrieval)                        │
│     │   - Current file state (from D1)                                    │
│     │   - Recent conversation history (last 3 turns)                       │
│     ├── Optimize context size                                               │
│     │   - LLMLingua compression (10x ratio)                                │
│     │   - Prompt caching (split prefix/suffix)                             │
│     └── Estimated token count: 3,500 tokens                                 │
│     │                                                                       │
│     ▼                                                                       │
│  7. MODEL SELECTION (Intelligent Router)                                   │
│     │                                                                       │
│     ├── Check requirements                                                  │
│     │   - Quality: High (70B model recommended)                            │
│     │   - Latency: <5s (acceptable for cloud)                             │
│     │   - Cost: Optimize for free tier                                    │
│     ├── Check available providers                                           │
│     │   ✓ Local GPU: Available (WebRTC connected)                         │
│     │   ✓ Groq: Free tier available (unlimited)                           │
│     │   ✓ Cerebras: Free tier available (unlimited)                       │
│     │   ✗ Cloudflare: Free tier exhausted (used 100K neurons)             │
│     ├── Select optimal provider                                             │
│     │   Decision: Groq (best balance of speed and quality)                │
│     │   Model: llama-3.3-70b                                              │
│     │   Reasoning: Fast inference (840 TPS), free tier, high quality      │
│     └── Execute generation                                                 │
│     │                                                                       │
│     ▼                                                                       │
│  8. AI GENERATION                                                          │
│     │                                                                       │
│     ├── Prepare request for Groq                                            │
│     │   - Split prompt: Cacheable prefix (2,800 tokens) + dynamic suffix   │
│     │   - Enable prompt caching (90% cost reduction)                       │
│     │   - Set parameters: temp=0.7, max_tokens=2000                       │
│     ├── Send to Groq API                                                    │
│     │   POST https://api.groq.com/openai/v1/chat/completions              │
│     ├── Stream response (if enabled)                                        │
│     │   - First token: 150ms                                               │
│     │   - Full generation: 2.3s                                           │
│     │   - Tokens generated: 1,247                                         │
│     ├── Parse response                                                      │
│     │   - Extract code fixes                                               │
│     │   - Extract explanation                                              │
│     │   - Extract file operations                                          │
│     └── Cost calculation                                                    │
│         - Input: 3,500 tokens (cached) = $0.00035                          │
│         - Output: 1,247 tokens = $0.00099                                  │
│         - Total: $0.00134 (99.7% cost reduction)                           │
│     │                                                                       │
│     ▼                                                                       │
│  9. RESPONSE PROCESSING                                                    │
│     │                                                                       │
│     ├── Validate response quality                                           │
│     │   - Code syntax check                                                │
│     │   - Security scan (secrets, vulnerabilities)                         │
│     │   - Best practices validation                                        │
│     ├── Format response for user                                            │
│     │   - Code diff display                                                │
│     │   - Explanation summary                                              │
│     │   - Action buttons (Apply, Discard, Edit)                            │
│     └── Store in cache                                                      │
│         │                                                                   │
│         ▼                                                                   │
│  10. CACHE STORAGE                                                         │
│     │                                                                       │
│     ├── Generate embedding for response                                     │
│     │   - Use query embedding (reuse from step 3)                          │
│     │   - Store in HNSW index                                              │
│     ├── Store in all cache layers                                          │
│     │   HOT (DO memory): Recent responses (50MB limit)                     │
│     │   WARM (KV): All responses (1GB limit, 1 day TTL)                    │
│     │   COLD (R2): Archive responses (10GB limit, 30 day TTL)              │
│     ├── Update cache metadata                                               │
│     │   - Access count: 1                                                  │
│     │   - Last accessed: now                                              │
│     │   - Similarity threshold: 0.90                                       │
│     └── Record cache hit/miss metrics                                       │
│     │                                                                       │
│     ▼                                                                       │
│  11. RESPONSE TO USER                                                      │
│     │                                                                       │
│     ├── Return to VS Code extension                                         │
│     │   - Display code diff                                                │
│     │   - Show explanation                                                 │
│     │   - Provide action buttons                                           │
│     ├── Update session state                                                │
│     │   - Add to conversation history                                      │
│     │   - Update last_active timestamp                                    │
│     │   - Persist to storage                                               │
│     ├── Record metrics                                                      │
│     │   - Total latency: 2.8s                                              │
│     │   - Cache: Miss                                                      │
│     │   - Provider: Groq                                                   │
│     │   - Tokens: 4,747 (3,500 input + 1,247 output)                      │
│     │   - Cost: $0.00134                                                   │
│     └── Ready for next request                                              │
│                                                                              │
│  TOTAL TIME: 2.8 seconds (P50), 5.2 seconds (P95)                           │
│  CACHE HIT RATE: 90%+ (target)                                              │
│  COST PER REQUEST: $0.00134 (99.7% reduction vs uncached)                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Request Timing Breakdown

| Step | Operation | P50 Latency | P95 Latency | Notes |
|------|-----------|-------------|-------------|-------|
| 1 | User input | - | - | Client-side |
| 2 | Edge Worker | 5ms | 20ms | DNS + TLS |
| 3 | Semantic Cache | 8ms | 15ms | 90%+ hit rate |
| 4 | Session Load | 2ms | 50ms | Depends on tier |
| 5 | Task Planning | 10ms | 30ms | In-memory DO |
| 6 | Context Assembly | 50ms | 150ms | Vector search |
| 7 | Model Selection | 5ms | 15ms | Routing logic |
| 8 | AI Generation | 2300ms | 4500ms | Network + compute |
| 9 | Response Validation | 50ms | 100ms | Syntax + security |
| 10 | Cache Storage | 15ms | 50ms | Async |
| 11 | Return to User | 5ms | 20ms | Network |
| **TOTAL (cached)** | - | **10ms** | **30ms** | Steps 3 only |
| **TOTAL (uncached)** | - | **2450ms** | **4950ms** | All steps |

---

## 2. Data Storage Flow

### 2.1 Multi-Tier Storage Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MULTI-TIER STORAGE FLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  DATA INGESTION                                                              │
│     │                                                                       │
│     ├── User uploads project                                                │
│     ├── Files indexed and chunked                                          │
│     ├── Chunks embedded (BGE-M3)                                           │
│     └── Metadata extracted                                                 │
│     │                                                                       │
│     ▼                                                                       │
│  TIER SELECTION LOGIC                                                       │
│     │                                                                       │
│     ├── Data size < 100KB? → HOT (DO memory)                               │
│     ├── Data size < 1MB? → WARM (KV)                                       │
│     ├── Data size < 10MB? → COLD (R2)                                      │
│     └── Metadata only? → META (D1)                                         │
│     │                                                                       │
│     ▼                                                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  HOT TIER: DURABLE OBJECT MEMORY                                     │ │
│  │    Capacity: 128MB per DO (we use 50MB limit)                         │ │
│  │    Latency: <1ms                                                      │ │
│  │    Hit Rate: 80%                                                      │ │
│  │    Content:                                                            │ │
│  │      - Active sessions (20MB)                                         │ │
│  │        • DirectorAgent states                                         │ │
│  │        • Conversation history                                         │ │
│  │        • User preferences                                             │ │
│  │      - Hot cache entries (15MB)                                       │ │
│  │        • Recently accessed vectors                                    │ │
│  │        • Frequently used queries                                      │ │
│  │      - LRU metadata (5MB)                                             │ │
│  │        • Access counts                                                │ │
│  │        • Timestamps                                                   │ │
│  │        • Tier migration schedules                                     │ │
│  │    Eviction: LRU with SIEVE algorithm                                 │ │
│  │    Promotion: From WARM tier on access                                │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                    │ Eviction / Overflow                  │
│                                    ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  WARM TIER: CLOUDFLARE KV                                            │ │
│  │    Capacity: 1GB total                                               │ │
│  │    Latency: 1-50ms                                                    │ │
│  │    Hit Rate: 15%                                                      │ │
│  │    Content:                                                            │ │
│  │      - Vector embeddings (500MB)                                      │ │
│  │        • 8-bit quantized (4x compression)                            │ │
│  │        • HNSW graph checkpoints                                      │ │
│  │      - Cached responses (300MB)                                       │ │
│  │        • Complete LLM responses                                      │ │
│  │        • Compressed with gzip                                         │ │
│  │      - Prompt cache (200MB)                                           │ │
│  │        • Cacheable prefixes                                           │ │
│  │        • Provider-native caching                                      │ │
│  │    Write Strategy: Batched (5-second windows)                        │ │
│  │    TTL: 1 day (configurable)                                          │ │
│  │    Limit: 1000 writes/day (free tier)                                 │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                    │ Overflow / Expiration                 │
│                                    ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  COLD TIER: CLOUDFLARE R2                                            │ │
│  │    Capacity: 10GB total                                              │ │
│  │    Latency: 50-100ms                                                  │ │
│  │    Hit Rate: 5%                                                       │ │
│  │    Content:                                                            │ │
│  │      - Historical cache entries (5GB)                                 │ │
│  │        • Old responses (30+ days)                                    │ │
│  │        • Rarely accessed data                                         │ │
│  │      - Vector database snapshots (2GB)                                │ │
│  │        • Weekly backups                                              │ │
│  │        • Disaster recovery                                           │ │
│  │      - Session archives (2GB)                                         │ │
│  │        • Long-term session storage                                    │ │
│  │        • Compliance archives                                          │ │
│  │      - User files (1GB)                                               │ │
│  │        • Uploaded documents                                           │ │
│  │        - Project archives                                             │ │
│  │    Compression: gzip                                                  │ │
│  │    Sharding: By first 2 chars of key                                  │ │
│  │    Cost: $0 (free tier 10GB)                                          │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  META TIER: CLOUDFLARE D1                                            │ │
│  │    Capacity: 500MB total                                             │ │
│  │    Latency: 10-100ms                                                 │ │
│  │    Content:                                                            │ │
│  │      - Documents index (100MB)                                        │ │
│  │        • File paths, hashes, metadata                                 │ │
│  │      - Vectors metadata (50MB)                                        │ │
│  │        • Chunk-to-document mapping                                   │ │
│  │        • Embedding IDs and locations                                 │ │
│  │      - Sessions (100MB)                                               │ │
│  │        • Session metadata                                             │ │
│  │        • Checkpoint counts                                            │ │
│  │      - Cache entries (100MB)                                          │ │
│  │        • Cache keys and tier locations                                │ │
│  │        • Expiration timestamps                                        │ │
│  │      - Security events (50MB)                                         │ │
│  │        • Immutable audit logs                                         │ │
│  │        • Cryptographic signatures                                     │ │
│  │      - Usage metrics (50MB)                                           │ │
│  │        • Request counts                                               │ │
│  │        • Provider usage                                               │ │
│  │        • Cost tracking                                                │ │
│  │    Query Speed: Indexed queries <50ms                                 │ │
│  │    Transactions: ACID compliant                                       │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  AUTOMATIC TIER MIGRATION                                                    │
│     │                                                                       │
│     ├── HOT → WARM: When HOT is 90% full (evict LRU)                      │
│     ├── WARM → HOT: On access (if space available)                        │
│     ├── WARM → COLD: When WARM expires (1 day TTL)                        │
│     ├── COLD → WARM: On access (promote temporarily)                      │
│     └── All tiers → META: Metadata indexed in D1                          │
│                                                                              │
│  COST OPTIMIZATION                                                           │
│     │                                                                       │
│     ├── HOT: $0 (included with DO)                                        │
│     ├── WARM: $0 (1GB free tier)                                          │
│     ├── COLD: $0 (10GB free tier)                                         │
│     ├── META: $0 (500MB free tier)                                        │
│     └── Total: $0/month (100% free tier)                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Storage Decision Tree

```
Data arrives
    │
    ├── Size < 100KB?
    │   ├── YES → Can fit in HOT?
    │   │   ├── YES → Store in HOT (DO memory)
    │   │   └── NO → Store in WARM (KV)
    │   │
    │   └── NO → Size < 1MB?
    │       ├── YES → Store in WARM (KV)
    │       └── NO → Store in COLD (R2)
    │
    ├── Access frequency?
    │   ├── High (hourly) → Keep in HOT
    │   ├── Medium (daily) → Keep in WARM
    │   └── Low (monthly) → Keep in COLD
    │
    └── Is metadata only?
        └── YES → Store in META (D1)
```

---

## 3. Agent Communication Flow

### 3.1 Agent Orchestration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AGENT COMMUNICATION FLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. USER REQUEST                                                             │
│     │                                                                       │
│     │ "Refactor the UserAuthentication class to use dependency injection"   │
│     │                                                                       │
│     ▼                                                                       │
│  2. EDGE WORKER → DIRECTOR AGENT DO                                         │
│     │                                                                       │
│     │ Message: {                                                            │
│     │   type: "user_request",                                              │
│     │   sessionId: "sess_abc123",                                          │
│     │   query: "...",                                                      │
│     │   context: { projectId, userId, ... }                                │
│     │ }                                                                     │
│     │                                                                       │
│     ▼                                                                       │
│  3. DIRECTOR AGENT (Session Orchestrator)                                   │
│     │                                                                       │
│     ├── Load session state from storage                                    │
│     │   - HOT: Session exists in DO memory (sub-ms)                        │
│     │   - Restore: conversation history, user preferences, project context │
│     │                                                                       │
│     ├── Analyze request complexity                                          │
│     │   - Complexity: High (requires multi-step refactoring)               │
│     │   - Requires: Code analysis, planning, execution, validation         │
│     │                                                                       │
│     ├── Create orchestration plan                                          │
│     │   - Step 1: Understand current implementation                        │
│     │   - Step 2: Design new architecture with DI                          │
│     │   - Step 3: Generate refactored code                                 │
│     │   - Step 4: Validate and test                                        │
│     │                                                                       │
│     └── Delegate to PLANNER AGENT                                          │
│         │                                                                   │
│         │ Message: {                                                       │
│         │   type: "plan_request",                                          │
│         │   sessionId: "sess_abc123",                                      │
│         │   query: "...",                                                  │
│         │   complexity: "high",                                            │
│         │   context: {...}                                                 │
│         │ }                                                                 │
│         │                                                                   │
│         ▼                                                                   │
│  4. PLANNER AGENT (Task Decomposition)                                      │
│     │                                                                       │
│     ├── Analyze query and context                                          │
│     │   - Target: UserAuthentication class                                 │
│     │   - File: src/auth/UserAuthentication.ts                             │
│     │   - Current pattern: Singleton / Direct instantiation                │
│     │                                                                       │
│     ├── Retrieve relevant code                                             │
│     │   - Read UserAuthentication.ts from D1                               │
│     │   - Read related files from vector DB                                │
│     │   - Search for: "dependency injection examples"                      │
│     │                                                                       │
│     ├── Decompose into subtasks                                            │
│     │   Task 1: Analyze current dependencies (parallel-ready)             │
│     │     - Read UserAuthentication.ts                                     │
│     │     - Identify all dependencies                                     │
│     │     - Document coupling                                              │
│     │                                                                       │
│     │   Task 2: Research DI patterns (parallel-ready)                     │
│     │     - Search codebase for DI examples                                │
│     │     - Retrieve documentation (TSyringe, Inversify)                   │
│     │     - Identify best practices                                        │
│     │                                                                       │
│     │   Task 3: Design DI architecture (depends on 1, 2)                   │
│     │     - Define interfaces                                              │
│     │     - Design container structure                                     │
│     │     - Plan migration strategy                                        │
│     │                                                                       │
│     │   Task 4: Generate refactored code (depends on 3)                    │
│     │     - Implement interfaces                                           │
│     │     - Create container                                               │
│     │     - Refactor UserAuthentication                                    │
│     │     - Update dependent classes                                       │
│     │                                                                       │
│     │   Task 5: Validate and test (depends on 4)                           │
│     │     - Syntax validation                                             │
│     │     - Type checking                                                 │
│     │     - Generate unit tests                                           │
│     │                                                                       │
│     ├── Optimize execution plan                                            │
│     │   - Tasks 1-2 can run in parallel                                   │
│     │   - Tasks 3-5 must run sequentially                                 │
│     │   - Estimated time: 45 seconds                                       │
│     │                                                                       │
│     └── Delegate to EXECUTOR AGENT                                         │
│         │                                                                   │
│         │ Message: {                                                       │
│         │   type: "execution_plan",                                        │
│         │   sessionId: "sess_abc123",                                      │
│         │   tasks: [                                                       │
│         │     { id: 1, type: "analyze", parallel: true },                 │
│         │     { id: 2, type: "research", parallel: true },                │
│         │     { id: 3, type: "design", dependsOn: [1, 2] },               │
│         │     { id: 4, type: "generate", dependsOn: [3] },                │
│         │     { id: 5, type: "validate", dependsOn: [4] }                 │
│         │   ],                                                              │
│         │   context: {...}                                                 │
│         │ }                                                                 │
│         │                                                                   │
│         ▼                                                                   │
│  5. EXECUTOR AGENT (Code Generation)                                        │
│     │                                                                       │
│     ├── Execute Task 1 (Analyze)                                          │
│     │   - Read src/auth/UserAuthentication.ts                              │
│     │   - Extract dependencies:                                            │
│     │     • DatabaseService                                               │
│     │     • EmailService                                                  │
│     │     • Logger                                                        │
│     │     • Config                                                        │
│     │   - Document current coupling                                        │
│     │   - Result: { dependencies: [...], coupling: "tight" }              │
│     │                                                                       │
│     ├── Execute Task 2 (Research) - IN PARALLEL                            │
│     │   - Search vector DB for DI patterns                                 │
│     │   - Retrieve:                                                        │
│     │     • 3 DI examples from codebase                                    │
│     │     • TSyringe documentation                                         │
│     │     • Best practices article                                         │
│     │   - Result: { examples: [...], patterns: [...] }                    │
│     │                                                                       │
│     ├── Wait for Tasks 1-2 to complete                                     │
│     │                                                                       │
│     ├── Execute Task 3 (Design)                                           │
│     │   - Analyze results from 1-2                                         │
│     │   - Design DI container architecture                                  │
│     │   - Define interfaces:                                               │
│     │     • IAuthDatabase                                                 │
│     │     • IEmailService                                                 │
│     │     • ILogger                                                       │
│     │   - Design container registration pattern                            │
│     │   - Result: { design: {...}, interfaces: [...] }                    │
│     │                                                                       │
│     ├── Execute Task 4 (Generate)                                         │
│     │   - Generate interface definitions                                   │
│     │   - Generate DI container (TSyringe)                                 │
│     │   - Refactor UserAuthentication class                                │
│     │   - Update dependent classes                                         │
│     │   - Result: { files: {...}, diff: [...] }                           │
│     │                                                                       │
│     ├── Execute Task 5 (Validate)                                         │
│     │   - Syntax check all generated code                                  │
│     │   - Type checking with TypeScript compiler                           │
│     │   - Generate unit tests                                             │
│     │   - Result: { valid: true, tests: [...] }                           │
│     │                                                                       │
│     └── Return results to DIRECTOR                                         │
│         │                                                                   │
│         │ Message: {                                                       │
│         │   type: "execution_complete",                                    │
│         │   sessionId: "sess_abc123",                                      │
│         │   results: {                                                     │
│         │     analysis: {...},                                             │
│         │     design: {...},                                               │
│         │     files: {...},                                                │
│         │     tests: {...}                                                 │
│         │   }                                                               │
│         │ }                                                                 │
│         │                                                                   │
│         ▼                                                                   │
│  6. DIRECTOR AGENT (Finalize)                                              │
│     │                                                                       │
│     ├── Assemble final response                                            │
│     │   - Summary of refactoring                                          │
│     │   - Code diff view                                                   │
│     │   - Generated tests                                                  │
│     │   - Next steps                                                       │
│     │                                                                       │
│     ├── Store in cache                                                     │
│     │   - Key: hash(query + projectHash)                                   │
│     │   - Value: complete response                                         │
│     │   - Tier: HOT (recent access)                                        │
│     │                                                                       │
│     ├── Update session state                                               │
│     │   - Add to conversation history                                      │
│     │   - Update project context                                          │
│     │   - Persist to storage                                               │
│     │                                                                       │
│     └── Return to user                                                     │
│         │                                                                   │
│         ▼                                                                   │
│  7. USER RECEIVES RESPONSE                                                 │
│     │                                                                       │
│     ├── Display in VS Code extension                                       │
│     │   - Refactoring summary                                             │
│     │   - Side-by-side diff view                                          │
│     │   - "Apply Refactoring" button                                      │
│     │   - "Review Tests" button                                           │
│     │                                                                       │
│     └── User action                                                        │
│         - Click "Apply Refactoring"                                       │
│         - Files updated on disk                                           │
│         - Git commit created                                              │
│                                                                              │
│  TOTAL TIME: 47 seconds (complex multi-step task)                            │
│  CACHE HIT: Next similar query → <10ms (90%+ hit rate)                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Agent Communication Protocol

```typescript
// Agent Communication Message Schema

interface AgentMessage {
  type: MessageType;
  from: AgentType;
  to: AgentType;
  sessionId: string;
  timestamp: number;
  payload: MessagePayload;
}

type MessageType =
  | "user_request"
  | "plan_request"
  | "execution_plan"
  | "task_complete"
  | "execution_complete"
  | "error"
  | "heartbeat";

type AgentType = "director" | "planner" | "executor";

interface MessagePayload {
  query?: string;
  context?: Context;
  tasks?: Task[];
  results?: ExecutionResults;
  error?: Error;
}
```

---

## 4. WebRTC Connection Flow

### 4.1 Device Pairing and Connection

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WEBRTC CONNECTION FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PHASE 1: DEVICE DISCOVERY                                                   │
│                                                                              │
│  Desktop (Go Proxy)             Mobile (React Native)                        │
│     │                               │                                       │
│     │ 1. Start pairing mode         │                                       │
│     │    - Generate pairing ID      │                                       │
│     │    - Display QR code          │                                       │
│     │                               │                                       │
│     │  ◄─────────────────────────── │ 2. Scan QR code                       │
│     │    QR Code: claudeflare://    │                                       │
│     │    pair?code=ABC123          │                                       │
│     │                               │                                       │
│     │ 3. Store pairing offer        │ 3. Extract pairing code               │
│     │    in Signaling DO            │                                       │
│     │                               │                                       │
│     ▼                               ▼                                       │
│                                                                              │
│  PHASE 2: SIGNALING                                                         │
│                                                                              │
│  Desktop             Signaling DO             Mobile                          │
│     │                    │                      │                           │
│     │ 4. Create WebRTC    │                      │                           │
│     │    offer            │                      │                           │
│     │                    │                      │                           │
│     │───────────────────▶ │ 5. Store offer       │                           │
│     │                    │                      │                           │
│     │                    │ 6. Notify mobile     │                           │
│     │                    │─────────────────────▶│ 7. Receive notification    │
│     │                    │                      │                           │
│     │                    │                      │ 8. Create WebRTC answer    │
│     │                    │◀─────────────────────│                           │
│     │                    │ 9. Store answer      │                           │
│     │                    │                      │                           │
│     │ 10. Receive answer │                      │                           │
│     │◀───────────────────│                      │                           │
│     │                    │                      │                           │
│     ▼                    ▼                      ▼                           │
│                                                                              │
│  PHASE 3: ICE EXCHANGE                                                       │
│                                                                              │
│  Desktop             Signaling DO             Mobile                          │
│     │                    │                      │                           │
│     │ 11. Gather ICE      │                      │                           │
│     │     candidates      │                      │                           │
│     │                    │                      │                           │
│     │───────────────────▶ │ 12. Relay to mobile  │                           │
│     │                    │─────────────────────▶│ 13. Add remote candidates │
│     │                    │                      │                           │
│     │ 14. Receive ICE    │                      │ 15. Gather ICE candidates │
│     │     from mobile     │                      │                           │
│     │◀─────────────────── │◀─────────────────────│                           │
│     │                    │ 16. Relay to desktop │                           │
│     │ 17. Add remote     │─────────────────────▶│                           │
│     │     candidates     │                      │                           │
│     │                    │                      │                           │
│     ▼                    ▼                      ▼                           │
│                                                                              │
│  PHASE 4: CONNECTION ESTABLISHED                                              │
│                                                                              │
│  Desktop                        Mobile                                        │
│     │                               │                                       │
│     │ 18. ICE connection complete  │                                       │
│     │     - DTLS handshake          │                                       │
│     │     - Selected candidate pair│                                       │
│     │     - Local/remote SDP set   │                                       │
│     │                               │                                       │
│     │  ═════════════════════════════════════════════════════════════════  │
│     │     P2P CONNECTION ESTABLISHED                                        │
│     │     Protocol: DTLS-SRTP                                               │
│     │     Encryption: AES-128-GCM                                           │
│     │     Latency: <15ms                                                     │
│     │  ═════════════════════════════════════════════════════════════════  │
│     │                               │                                       │
│     ▼                               ▼                                       │
│                                                                              │
│  PHASE 5: ACTIVE COMMUNICATION                                               │
│                                                                              │
│  Desktop                        Mobile                                        │
│     │                               │                                       │
│     │ 19. Open data channels        │                                       │
│     │     - "compute" (GPU)         │                                       │
│     │     - "control" (signals)     │                                       │
│     │     - "telemetry" (metrics)   │                                       │
│     │                               │                                       │
│     │◄──────────────────────────────▶│ 20. Test connection                   │
│     │     Ping/Pong                 │     - Round-trip: 28ms                │
│     │                               │     - Jitter: 3ms                     │
│     │                               │                                       │
│     │ 21. Ready for compute         │                                       │
│     │                               │                                       │
│     ▼                               ▼                                       │
│                                                                              │
│  CONNECTION METRICS                                                           │
│     - Establishment time: ~3 seconds                                         │
│     - Latency (RTT): 28ms                                                     │
│     - Throughput: ~50 Mbps                                                   │
│     - Encryption: DTLS-SRTP (E2E)                                            │
│     - NAT Traversal: STUN + TURN (fallback)                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Data Channel Protocol

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WEBRTC DATA CHANNEL PROTOCOL                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CHANNEL: "compute" (Reliable, Ordered)                                     │
│     │                                                                       │
│     ├── Request from Mobile                                                 │
│     │   {                                                                   │
│     │     "id": "req_001",                                                  │
│     │     "type": "compute",                                                │
│     │     "method": "generate",                                             │
│     │     "params": {                                                       │
│     │       "model": "llama-3.3-70b",                                       │
│     │       "prompt": "Explain this code...",                               │
│     │       "options": {                                                    │
│     │         "temperature": 0.7,                                           │
│     │         "max_tokens": 1000                                            │
│     │       }                                                               │
│     │     }                                                                 │
│     │   }                                                                   │
│     │                                                                       │
│     ├── Response from Desktop                                               │
│     │   {                                                                   │
│     │     "id": "req_001",                                                  │
│     │     "type": "response",                                               │
│     │     "result": {                                                       │
│     │       "text": "Here's an explanation...",                             │
│     │       "usage": {                                                      │
│     │         "prompt_tokens": 350,                                         │
│     │         "completion_tokens": 847,                                     │
│     │         "total_tokens": 1197                                          │
│     │       },                                                              │
│     │       "latency_ms": 1243                                             │
│     │     }                                                                 │
│     │   }                                                                   │
│     │                                                                       │
│     └── Error Handling                                                      │
│         {                                                                   │
│           "id": "req_001",                                                  │
│           "type": "error",                                                  │
│           "error": {                                                        │
│             "code": "GPU_OOM",                                              │
│             "message": "Insufficient GPU memory for 70B model",             │
│             "suggestion": "Use 8B model or cloud fallback"                  │
│           }                                                                 │
│         }                                                                   │
│                                                                              │
│  CHANNEL: "control" (Reliable, Ordered)                                     │
│     │                                                                       │
│     ├── Messages                                                            │
│     │   - "ping" (heartbeat)                                                │
│     │   - "status" (GPU availability)                                        │
│     │   - "cancel" (cancel request)                                         │
│     │   - "switch_model" (change model)                                     │
│     │                                                                       │
│  CHANNEL: "telemetry" (Unreliable, Unordered)                               │
│     │                                                                       │
│     ├── Metrics                                                             │
│     │   - GPU utilization (%)                                               │
│     │   - Memory usage (MB)                                                 │
│     │   - Temperature (°C)                                                  │
│     │   - Current model                                                     │
│     │   - Active requests                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Multi-Cloud Routing Flow

### 5.1 Provider Selection Decision Tree

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MULTI-CLOUD ROUTING FLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  REQUEST ARRIVES                                                              │
│     │                                                                       │
│     │ Query: "Explain async/await in TypeScript"                            │
│     │ Requirements: Low quality, <100ms latency                             │
│     │                                                                       │
│     ▼                                                                       │
│  1. CHECK QUALITY REQUIREMENTS                                              │
│     │                                                                       │
│     ├── Quality = "low"?                                                    │
│     │   ├── YES → Use smallest local model (1B)                             │
│     │   │   - Estimated latency: 50ms                                       │
│     │   │   - Cost: $0                                                      │
│     │   │   - ✓ SELECTED: Ollama llama-3.2-1b                              │
│     │   │                                                                  │
│     │   └── NO → Continue to step 2                                        │
│     │                                                                       │
│     ▼                                                                       │
│  2. CHECK LATENCY REQUIREMENTS                                              │
│     │                                                                       │
│     ├── Max latency < 100ms?                                                │
│     │   ├── YES → Use fastest provider                                      │
│     │   │   - Cerebras: 30ms avg (2600 TPS) ✓                               │
│     │   │   - Groq: 50ms avg (840 TPS)                                     │
│     │   │   - Local GPU: 15ms (if available)                                │
│     │   │                                                                  │
│     │   └── NO → Continue to step 3                                        │
│     │                                                                       │
│     ▼                                                                       │
│  3. CHECK LOCAL GPU AVAILABILITY                                            │
│     │                                                                       │
│     ├── WebRTC connected?                                                   │
│     │   ├── YES → Check GPU status                                         │
│     │   │   - Available? → Use local GPU                                    │
│     │   │   - In use? → Fallback to cloud                                  │
│     │   │                                                                  │
│     │   └── NO → Continue to step 4                                        │
│     │                                                                       │
│     ▼                                                                       │
│  4. CHECK FREE TIERS                                                        │
│     │                                                                       │
│     ├── Cloudflare Workers AI                                                │
│     │   - Daily neurons: 10K                                               │
│     │   - Used today: 8,453                                                │
│     │   - Remaining: 1,547 neurons (~100 tokens)                            │
│     │   - Status: ⚠️ LIMITED                                               │
│     │                                                                       │
│     ├── Groq                                                                │
│     │   - Free tier: Unlimited                                             │
│     │   - Rate limit: None                                                 │
│     │   - Status: ✅ AVAILABLE                                             │
│     │                                                                       │
│     ├── Cerebras                                                            │
│     │   - Free tier: Unlimited                                             │
│     │   - Rate limit: None                                                 │
│     │   - Status: ✅ AVAILABLE                                             │
│     │                                                                       │
│     └── Together AI                                                         │
│         - Startup credits: $15K                                            │
│         - Status: ✅ AVAILABLE                                             │
│     │                                                                       │
│     ▼                                                                       │
│  5. SELECT OPTIMAL PROVIDER                                                 │
│     │                                                                       │
│     ├── Score providers by:                                                 │
│     │   - Speed (latency)                                                  │
│     │   - Cost (per 1M tokens)                                             │
│     │   - Quality (model size)                                             │
│     │   - Availability (free tier)                                         │
│     │                                                                       │
│     │   Provider   Speed   Cost    Quality   Free?   Score               │
│     │   ─────────────────────────────────────────────────────              │
│     │   Groq       50ms    $0.05   70B       ✅     9.2                  │
│     │   Cerebras   30ms    $0.10   70B       ✅     9.0                  │
│     │   Together   100ms   $0.08   70B       ✅     8.5                  │
│     │   Cloudflare 200ms   $0.00   8B        ⚠️     6.0                  │
│     │                                                                       │
│     ├── SELECTED: Groq (llama-3.3-70b)                                       │
│     │   - Reasoning: Best balance of speed, cost, quality                  │
│     │   - Estimated latency: 50ms + generation time                        │
│     │                                                                       │
│     ▼                                                                       │
│  6. EXECUTE WITH RETRY                                                      │
│     │                                                                       │
│     ├── Attempt 1: Groq                                                     │
│     │   - Request sent                                                     │
│     │   - Response received                                                │
│     │   - Success: ✓                                                        │
│     │   - Latency: 2.3s                                                    │
│     │   - Tokens: 1,247                                                    │
│     │   - Cost: $0.00099                                                    │
│     │                                                                       │
│     ├── (If failed) Attempt 2: Cerebras                                     │
│     │   - Automatic failover                                               │
│     │                                                                       │
│     └── (If failed) Attempt 3: Together AI                                  │
│         - Final fallback                                                   │
│     │                                                                       │
│     ▼                                                                       │
│  7. UPDATE METRICS                                                          │
│     │                                                                       │
│     ├── Record provider usage                                                │
│     │   - Groq: +1,247 tokens                                               │
│     │   - Cost: +$0.00099                                                   │
│     │                                                                       │
│     ├── Update free tier tracker                                             │
│     │   - Cloudflare: 1,547 neurons remaining                              │
│     │   - Groq: Unlimited                                                   │
│     │                                                                       │
│     ├── Record performance metrics                                           │
│     │   - Latency: 2.3s                                                     │
│     │   - Quality: 4.8/5.0                                                  │
│     │   - Cache hit: No                                                     │
│     │                                                                       │
│     └── Update cost optimization stats                                       │
│         - Total cost today: $0.12                                           │
│         - Requests today: 47                                                │
│         - Cost per request: $0.0026                                         │
│         - Savings vs GPT-4: 99.7%                                           │
│     │                                                                       │
│     ▼                                                                       │
│  8. RETURN RESPONSE                                                         │
│                                                                              │
│  RESULT: Successfully routed to Groq, 2.3s latency, $0.00099 cost             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Provider Health Check

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROVIDER HEALTH MONITORING                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ACTIVE MONITORING                                                            │
│     │                                                                       │
│     ├── Every 30 seconds: Ping provider health endpoint                      │
│     ├── Every 1 minute: Check rate limits                                   │
│     ├── Every 5 minutes: Validate free tier remaining                       │
│     └── Real-time: Monitor error rates                                      │
│     │                                                                       │
│     ▼                                                                       │
│  HEALTH SCORE CALCULATION                                                    │
│     │                                                                       │
│     Score = (0.4 × Availability) + (0.3 × Latency) + (0.2 × ErrorRate)      │
│                                                                              │
│     Provider   Avail   Latency  Errors   Health  Status                     │
│     ────────────────────────────────────────────────────────────           │
│     Groq       100%    50ms     0.1%     9.2     🟢 HEALTHY                │
│     Cerebras   100%    30ms     0.2%     9.0     🟢 HEALTHY                │
│     Cloudflare 100%    200ms    0.5%     8.5     🟢 HEALTHY                │
│     Together   99.5%   100ms    1.0%     8.0     🟡 DEGRADED               │
│     HuggingFace 95%    500ms    5.0%     5.0     🔴 UNHEALTHY              │
│                                                                              │
│  CIRCUIT BREAKER LOGIC                                                        │
│     │                                                                       │
│     ├── Health < 5.0 → Open circuit (stop routing)                          │
│     ├── Health < 7.0 → Warning (reduce routing)                             │
│     ├── Health > 8.0 → Healthy (normal routing)                             │
│     │                                                                       │
│     └── Auto-recovery: Retry after 1 minute                                 │
│                                                                              │
│  FAILOVER CHAIN                                                              │
│     │                                                                       │
│     Primary: Groq (fastest, best cost)                                       │
│         │                                                                   │
│         ├── Failure? → Fallback to Cerebras                                 │
│         │               │                                                   │
│         │               ├── Failure? → Fallback to Together AI             │
│         │               │               │                                   │
│         │               │               └── Failure? → Fallback to Cloudflare│
│         │               │                           │                       │
│         │               └── All failed? → Escalate to paid tier (alert)     │
│         │                                                                   │
│         └── Success → Use provider                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Cache Lookup Flow

### 6.1 Multi-Layer Cache Decision

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CACHE LOOKUP FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  REQUEST: "How do I implement OAuth2 in TypeScript?"                         │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 1: SEMANTIC CACHE (Vector Similarity)                          │   │
│  │                                                                      │   │
│  │  1. Generate embedding for query                                      │   │
│  │     - Model: BGE-M3 (via Workers AI)                                  │   │
│  │     - Dimensions: 768                                                 │   │
│  │     - Latency: 8ms                                                    │   │
│  │                                                                      │   │
│  │  2. Search HNSW index                                                 │   │
│  │     - Index location: VectorIndex DO                                  │   │
│  │     - Search space: 10,000 vectors                                    │   │
│  │     - Algorithm: HNSW (M=16, ef=50)                                    │   │
│  │     - K: 10 (top 10 results)                                          │   │
│  │     - Latency: 2ms                                                    │   │
│  │                                                                      │   │
│  │  3. Calculate similarities                                            │   │
│  │     Result ID  Similarity  Context Match?                            │   │
│  │     ─────────────────────────────────────────                         │   │
│  │     vec_001     0.94      ✓ YES                                       │   │
│  │     vec_002     0.91      ✓ YES                                       │   │
│  │     vec_003     0.89      ✗ NO (different project)                   │   │
│  │     vec_004     0.87      ✗ NO (files changed)                       │   │
│  │     ...         ...       ...                                         │   │
│  │                                                                      │   │
│  │  4. Check similarity threshold                                        │   │
│  │     - Threshold: 0.90                                                 │   │
│  │     - Matches: vec_001 (0.94), vec_002 (0.91)                         │   │
│  │     - Result: ✓ CACHE HIT                                             │   │
│  │                                                                      │   │
│  │  5. Retrieve cached response                                          │   │
│  │     - From: HOT tier (DO memory)                                      │   │
│  │     - Response ID: resp_abc123                                        │   │
│  │     - Latency: <1ms                                                   │   │
│  │                                                                      │   │
│  │  6. Validate cache entry                                              │   │
│  │     - Project hash matches? ✓ YES                                     │   │
│  │     - Model parameters match? ✓ YES                                    │   │
│  │     - Not expired? ✓ YES (< 24 hours)                                 │   │
│  │                                                                      │   │
│  │  ┌────────────────────────────────────────────────────────────────┐   │   │
│  │  │  CACHE HIT! 🎯                                                  │   │   │
│  │  │                                                                 │   │   │
│  │  │  Response returned in: 10ms total                                │   │   │
│  │  │  Similarity: 0.94 (very high)                                    │   │   │
│  │  │  Source: Semantic cache                                         │   │   │
│  │  │  Cost: $0                                                        │   │   │
│  │  └────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │ Miss?                                   │
│                                    │                                         │
│  ┌─────────────────────────────────┼─────────────────────────────────────┐   │
│  │                                  │                                     │   │
│  │  ┌───────────────────────────────▼─────────────────────────────────┐   │   │
│  │  │  LAYER 2: PROMPT CACHE (Provider-Native)                        │   │   │
│  │  │                                                                  │   │   │
│  │  │  1. Split prompt into prefix/suffix                              │   │   │
│  │  │     Prefix (cacheable):                                          │   │   │
│  │  │       - System prompt (2,100 tokens)                              │   │   │
│  │  │       - Project documentation (500 tokens)                        │   │   │
│  │  │       Total: 2,600 tokens                                        │   │   │
│  │  │                                                                  │   │   │
│  │  │     Suffix (dynamic):                                             │   │   │
│  │  │       - Current query (150 tokens)                                 │   │   │
│  │  │                                                                  │   │   │
│  │  │  2. Generate cache key                                             │   │   │
│  │  │     Key = hash(prefix + model + timestamp)                        │   │   │
│  │  │     Key: "a7f3c9e1b2d4f6e8"                                         │   │   │
│  │  │                                                                  │   │   │
│  │  │  3. Check provider cache                                           │   │   │
│  │  │     Provider: Anthropic (Claude)                                   │   │   │
│  │  │     Cache endpoint: /v1/messages/check_cache                       │   │   │
│  │  │     Request: { prefix_key: "a7f3c9e1b2d4f6e8" }                    │   │   │
│  │  │                                                                  │   │   │
│  │  │  4. Provider response                                              │   │   │
│  │  │     {                                                              │   │   │
│  │  │       "cached": true,                                              │   │   │
│  │  │       "created_at": "2026-01-13T10:30:00Z",                         │   │   │
│  │  │       "hit_count": 47,                                              │   │   │
│  │  │       "tokens_cached": 2600                                         │   │   │
│  │  │     }                                                              │   │   │
│  │  │                                                                  │   │   │
│  │  │  ┌────────────────────────────────────────────────────────────┐   │   │   │
│  │  │  │  CACHE HIT! 🎯                                              │   │   │   │
│  │  │  │                                                             │   │   │   │
│  │  │  │  Prefix cost: 90% discount                                   │   │   │   │
│  │  │  │  Regular: $0.0078 → Cached: $0.00078                         │   │   │   │
│  │  │  │  Savings: $0.00702                                            │   │   │   │
│  │  │  └────────────────────────────────────────────────────────────┘   │   │   │
│  │  │                                                                  │   │   │
│  │  └──────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                              │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Cache Statistics

| Layer | Hit Rate | Latency | Cost Reduction | Storage |
|-------|----------|---------|----------------|---------|
| **Semantic** | 45% | <10ms | 100% | DO (50MB) |
| **Prompt** | 35% | 50ms | 90% | Provider |
| **Response** | 15% | <1ms | 100% | KV (300MB) |
| **KV Cache** | 50% | 100ms | N/A | Local GPU |
| **Combined** | **90%** | **<50ms** | **95%** | Multi-tier |

---

## 7. Vector Indexing Flow

### 7.1 Document Ingestion Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VECTOR INDEXING FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. FILE UPLOAD                                                              │
│     │                                                                       │
│     ├── User uploads project: "my-ts-app"                                   │
│     ├── Files: 1,247 TypeScript files                                       │
│     ├── Total size: 47.3 MB                                                 │
│     └── Target: Index for semantic search                                    │
│     │                                                                       │
│     ▼                                                                       │
│  2. FILE DISCOVERY                                                           │
│     │                                                                       │
│     ├── Scan directory recursively                                           │
│     ├── Filter by extension: .ts, .tsx, .js, .jsx                            │
│     ├── Exclude patterns: node_modules, dist, .git                          │
│     ├── Result: 1,189 files to index                                         │
│     │                                                                       │
│     ▼                                                                       │
│  3. CHUNKING STRATEGY                                                        │
│     │                                                                       │
│     ├── For each file:                                                      │
│     │   - Read file content                                                 │
│     │   - Parse AST (TypeScript compiler)                                   │
│     │   - Extract:                                                           │
│     │     • Functions                                                       │
│     │     • Classes                                                         │
│     │     • Interfaces                                                      │
│     │     • Type definitions                                                │
│     │   - Chunk by semantic units (not fixed size)                          │
│     │     • Max chunk size: 500 tokens                                      │
│     │     • Overlap: 50 tokens                                              │
│     │                                                                      │
│     ├── Example chunking for "AuthService.ts":                              │
│     │   Chunk 1: Class definition and imports (180 tokens)                  │
│     │   Chunk 2: Constructor and DI (220 tokens)                            │
│     │   Chunk 3: login() method (350 tokens)                                │
│     │   Chunk 4: logout() method (200 tokens)                               │
│     │   ...                                                                 │
│     │                                                                      │
│     └── Total chunks generated: 8,456                                        │
│     │                                                                       │
│     ▼                                                                       │
│  4. EMBEDDING GENERATION                                                     │
│     │                                                                       │
│     ├── For each chunk:                                                     │
│     │   - Preprocess:                                                       │
│     │     • Remove comments                                                 │
│     │     • Normalize indentation                                           │
│     │     • Extract type signatures                                         │
│     │   - Add context:                                                      │
│     │     • File path: "src/auth/AuthService.ts"                            │
│     │     • Language: TypeScript                                            │
│     │     • Chunk type: "method"                                            │
│     │   - Generate embedding:                                                │
│     │     • Model: BGE-M3 (via Workers AI)                                  │
│     │     • Dimensions: 768                                                 │
│     │     • Latency: 50ms per chunk                                         │
│     │     • Batch size: 20 chunks per request                               │
│     │                                                                      │
│     ├── Total embedding time: ~21 seconds (424 batches)                      │
│     ├── Cost: $0 (Workers AI free tier: 10K neurons/day)                     │
│     └── Storage: 8,456 × 768 × 4 bytes = ~26 MB (raw)                        │
│     │                                                                       │
│     ▼                                                                       │
│  5. PRODUCT QUANTIZATION                                                      │
│     │                                                                       │
│     ├── Apply 8-bit product quantization                                      │
│     │   - Subvector count: 8                                                │
│     │   - Codebook size: 256                                                │
│     │   - Compression ratio: 4x                                             │
│     │                                                                      │
│     ├── Quantized storage: 8,456 × 768 × 1 byte = ~6.5 MB                    │
│     ├── Quality loss: <2% (negligible for search)                            │
│     └── Search speed: 2x faster (smaller vectors)                            │
│     │                                                                       │
│     ▼                                                                       │
│  6. HNSW INDEX CONSTRUCTION                                                  │
│     │                                                                       │
│     ├── Build HNSW graph in VectorIndex DO                                   │
│     │   - Parameters:                                                        │
│     │     • M (max connections): 16                                          │
│     │     • efConstruction: 100                                             │
│     │     • Level: Probabilistic (skip list)                                │
│     │   - Construction time: ~45 seconds                                     │
│     │   - Memory usage: ~40 MB (including graph structure)                   │
│     │                                                                      │
│     ├── Index statistics:                                                    │
│     │   • Total vectors: 8,456                                              │
│     │   • Average connections: 12                                           │
│     │   • Max level: 5                                                      │
│     │   • Graph edges: ~101,472                                             │
│     │                                                                      │
│     └── Persist to storage:                                                  │
│         - HOT: DO memory (40MB)                                             │
│         - Checkpoint to WARM: KV (6.5MB quantized)                          │
│         │                                                                       │
│         ▼                                                                       │
│  7. METADATA STORAGE                                                         │
│     │                                                                       │
│     ├── Store in D1 (metadata tier):                                         │
│     │   - Documents table:                                                   │
│     │     • 1,189 file records                                              │
│     │     • File paths, hashes, sizes                                       │
│     │   - Vectors table:                                                     │
│     │     • 8,456 chunk records                                             │
│     │     • Chunk-to-document mapping                                       │
│     │     • Embedding IDs and tier locations                                 │
│     │   - Index metadata:                                                    │
│     │     • HNSW parameters                                                  │
│     │     • Quantization settings                                           │
│     │     • Build timestamp                                                 │
│     │                                                                      │
│     └── Total metadata: ~250 MB (D1 free tier: 500MB)                        │
│     │                                                                       │
│     ▼                                                                       │
│  8. READY FOR SEARCH                                                         │
│     │                                                                       │
│     ├── Vector index ready in VectorIndex DO                                 │
│     ├── Search latency: <10ms (8,456 vectors)                                │
│     ├── Recall: 95%+ (with HNSW parameters)                                  │
│     └── Auto-updates on file changes                                         │
│                                                                              │
│  INDEXING SUMMARY                                                             │
│     - Total time: ~90 seconds                                                │
│     - Files indexed: 1,189                                                   │
│     - Chunks generated: 8,456                                                │
│     - Vectors stored: 8,456 (quantized, 6.5MB)                               │
│     - Metadata: 250 MB                                                       │
│     - Search latency: <10ms                                                  │
│     - Cost: $0 (free tier)                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Incremental Updates

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INCREMENTAL UPDATE FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FILE CHANGE DETECTED                                                        │
│     │                                                                       │
│     ├── File: "src/auth/AuthService.ts"                                      │
│     ├── Change: Modified (user added new method)                             │
│     ├── Old hash: "abc123"                                                   │
│     └── New hash: "def456"                                                   │
│     │                                                                       │
│     ▼                                                                       │
│  1. INVALIDATE OLD CHUNKS                                                    │
│     │                                                                       │
│     ├── Query D1 for vectors in this file                                    │
│     │   SELECT id FROM vectors WHERE document_id = (                         │
│     │     SELECT id FROM documents WHERE path = 'src/auth/AuthService.ts'    │
│     │   )                                                                   │
│     │                                                                       │
│     ├── Result: 12 chunks to invalidate                                      │
│     ├── Remove from HNSW index (VectorIndex DO)                              │
│     └── Mark as deleted in D1 (soft delete)                                  │
│     │                                                                       │
│     ▼                                                                       │
│  2. RE-INDEX FILE                                                           │
│     │                                                                       │
│     ├── Re-chunk file                                                       │
│     │   - Old: 12 chunks                                                    │
│     │   - New: 14 chunks (added 2 for new method)                           │
│     │                                                                       │
│     ├── Generate embeddings for new chunks                                   │
│     │   - Workers AI (BGE-M3)                                               │
│     │   - Latency: ~700ms (14 chunks)                                       │
│     │                                                                       │
│     ├── Quantize embeddings (8-bit PQ)                                       │
│     │   - Compress: 56KB → 14KB                                             │
│     │                                                                       │
│     └── Insert into HNSW index                                               │
│         - VectorIndex DO updates in-memory graph                             │
│         - Add 14 new vectors                                                 │
│         - Update metadata in D1                                              │
│     │                                                                       │
│     ▼                                                                       │
│  3. CACHE INVALIDATION                                                       │
│     │                                                                       │
│     ├── Invalidate affected cache entries                                     │
│     │   - Find cache entries referencing this file                           │
│     │   - Mark as invalid (semantic drift)                                   │
│     │                                                                       │
│     ├── Example:                                                            │
│     │   Cache entry: "How do I use AuthService?"                             │
│     │   Affected chunks: [chunk_001, chunk_005, chunk_007]                   │
│     │   Action: Invalidate (chunks changed)                                  │
│     │                                                                       │
│     └── Result: 3 cache entries invalidated                                  │
│     │                                                                       │
│     ▼                                                                       │
│  4. VERIFY INTEGRITY                                                         │
│     │                                                                       │
│     ├── Validate index consistency                                            │
│     │   - Vector count: +2 (old 12, new 14) ✓                                │
│     │   - Document count: unchanged ✓                                        │
│     │   - HNSW graph integrity: ✓                                           │
│     │                                                                       │
│     ├── Test search                                                          │
│     │   Query: "AuthService new method"                                     │
│     │   Expected: Should return new chunks                                  │
│     │   Result: ✓ Returns chunk_013, chunk_014                              │
│     │                                                                       │
│     └── Ready for queries                                                   │
│                                                                              │
│  UPDATE SUMMARY                                                              │
│     - Time: ~2 seconds                                                      │
│     - Old chunks removed: 12                                                │
│     - New chunks added: 14                                                  │
│     - Net change: +2 chunks (+1KB)                                          │
│     - Cache entries invalidated: 3                                          │
│     - Index integrity: ✓ Maintained                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Security Authentication Flow

### 8.1 Hardware-Rooted Authentication

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SECURITY AUTHENTICATION FLOW                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. DEVICE REGISTRATION (One-Time)                                            │
│     │                                                                       │
│     ├── User installs ClaudeFlare desktop app                                │
│     ├── App detects platform: Windows 11                                     │
│     ├── Check for TPM 2.0                                                    │
│     │   └── ✓ TPM 2.0 available                                             │
│     │                                                                       │
│     ▼                                                                       │
│  2. GENERATE HARDWARE-BOUND KEY                                               │
│     │                                                                       │
│     ├── Use Windows Credential Provider API                                   │
│     ├── Generate RSA-2048 key pair in TPM                                     │
│     │   - Private key: Non-exportable, stored in TPM                         │
│     │   - Public key: Exportable for sealing                                 │
│     │   - Key usage: Sign, Decrypt                                           │
│     │   - Required: User presence (Windows Hello)                            │
│     │                                                                       │
│     ├── Register key with TPM                                                │
│     │   - Make persistent: TRUE                                             │
│     │   - Key ID: "claudeflare-device-key"                                   │
│     │                                                                       │
│     └── Get device attestation certificate                                   │
│         - TPM EK (Endorsement Key) certificate                               │
│         - Device ID: SHA-256(EK certificate)                                 │
│     │                                                                       │
│     ▼                                                                       │
│  3. SEAL CREDENTIALS                                                         │
│     │                                                                       │
│     ├── User signs in to ClaudeFlare                                         │
│     ├── API key received: "sk-ant-..."                                      │
│     │                                                                       │
│     ├── Create SealedEnvelope:                                               │
│     │   {                                                                   │
│     │     version: 1,                                                       │
│     │     algorithm: "RSA-OAEP-256",                                        │
│     │     deviceId: "tpm-a7f3c9e1b2d4f6e8",                                 │
│     │     devicePublicKey: "<TPM public key>",                               │
│     │     encryptedKey: "<API key encrypted with TPM>",                     │
│     │     nonce: "<random nonce>",                                           │
│     │     timestamp: 1705134567890,                                         │
│     │     signature: "<TPM signature of envelope>",                          │
│     │     signerCert: "<TPM attestation certificate>"                       │
│     │   }                                                                   │
│     │                                                                       │
│     ├── Encrypt API key with TPM public key                                   │
│     │   - Algorithm: RSA-OAEP with SHA-256                                  │
│     │   - Requires: TPM key + user presence (Windows Hello)                 │
│     │                                                                       │
│     ├── Sign envelope with TPM key                                            │
│     │   - Requires: User presence (biometric)                               │
│     │   - Signature: ECDSA with SHA-256                                     │
│     │                                                                       │
│     └── Store sealed envelope in cloud (D1)                                  │
│         - Table: credentials                                                │
│         - Encrypted blob stored securely                                    │
│         - API key never stored in plaintext                                 │
│     │                                                                       │
│     ▼                                                                       │
│  4. SUBSEQUENT AUTHENTICATION                                                │
│     │                                                                       │
│     ├── User opens ClaudeFlare on new device (mobile)                        │
│     ├── Request to access credentials                                        │
│     │                                                                       │
│     ▼                                                                       │
│  5. FETCH SEALED ENVELOPE                                                     │
│     │                                                                       │
│     ├── Request from mobile to Cloudflare Workers                            │
│     ├── Query D1 for sealed envelope                                          │
│     │   SELECT envelope FROM credentials WHERE device_id = '...'            │
│     │                                                                       │
│     ├── Return sealed envelope to mobile                                      │
│     │   - Encrypted API key inside                                          │
│     │   - Cannot be decrypted without TPM                                   │
│     │                                                                       │
│     └── Mobile receives: "Cannot decrypt - requires hardware key"            │
│     │                                                                       │
│     ▼                                                                       │
│  6. TRANSFER TO AUTHORIZED DEVICE                                            │
│     │                                                                       │
│     ├── User selects: "Authorize this device"                                │
│     ├── Desktop (Windows) receives notification                               │
│     │                                                                       │
│     ▼                                                                       │
│  7. UNSEAL ON AUTHORIZED DEVICE                                               │
│     │                                                                       │
│     ├── Desktop receives sealed envelope                                     │
│     ├── Verify signature                                                     │
│     │   - Use TPM public key to verify signature                            │
│     │   - ✓ Signature valid                                                 │
│     │                                                                       │
│     ├── Request biometric authentication                                      │
│     │   - Windows Hello prompt appears                                      │
│     │   - User: Looks at camera (Face ID) or touches sensor (Fingerprint)   │
│     │   - Windows Hello: ✓ Authentication successful                        │
│     │                                                                       │
│     ├── Decrypt encrypted key with TPM                                        │
│     │   - TPM operation: RSA Decrypt                                        │
│     │   - Requires: User presence (already verified)                        │
│     │   - Result: API key decrypted                                         │
│     │                                                                       │
│     └── Return API key to user session (in memory only)                      │
│         - Never stored on disk                                              │
│         - Cleared when session ends                                         │
│     │                                                                       │
│     ▼                                                                       │
│  8. AUDIT LOGGING                                                            │
│     │                                                                       │
│     ├── Log all security events to D1                                        │
│     │   - Event type: CREDENTIAL_ACCESSED                                   │
│     │   - Device ID: "tpm-..."                                               │
│     │   - User ID: "user_..."                                                │
│     │   - Timestamp: 1705134567890                                           │
│     │   - IP address: "..."                                                  │
│     │   - User agent: "..."                                                  │
│     │   - Details: { method: "biometric", provider: "Windows Hello" }       │
│     │   - Signature: "<cryptographic signature of event>"                   │
│     │                                                                       │
│     └── Immutable audit trail                                                │
│         - All events signed                                                │
│         - Tamper-evident                                                   │
│         - Compliance-ready                                                  │
│                                                                              │
│  SECURITY SUMMARY                                                             │
│     - Private key: Never leaves TPM                                          │
│     - Encryption: RSA-OAEP-256                                               │
│     - Authentication: Biometric (Windows Hello)                              │
│     - Storage: Encrypted at rest (sealed envelope)                            │
│     - Audit: Immutable logs with signatures                                  │
│     - Compliance: SOC 2, GDPR, HIPAA ready                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Security Event Logging

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SECURITY AUDIT LOG                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  RECENT SECURITY EVENTS (Last 24 Hours)                                      │
│                                                                              │
│  Timestamp           Type                    Device        Status             │
│  ──────────────────────────────────────────────────────────────────────────  │
│  2026-01-13 14:32:15  CREDENTIAL_ACCESSED     tpm-xxx       ✓ Success         │
│  2026-01-13 14:32:10  BIOMETRIC_AUTH_SUCCESS  tpm-xxx       ✓ Face ID         │
│  2026-01-13 14:30:00  SESSION_CREATED         tpm-xxx       ✓ Secure          │
│  2026-01-13 10:15:22  CREDENTIAL_ACCESSED     tpm-xxx       ✓ Success         │
│  2026-01-13 10:15:18  BIOMETRIC_AUTH_SUCCESS  tpm-xxx       ✓ Fingerprint     │
│  2026-01-13 08:00:00  KEY_ROTATION            system        ✓ Completed       │
│  2026-01-12 18:45:33  BIOMETRIC_AUTH_FAILED   tpm-xxx       ✗ Cancelled       │
│  2026-01-12 18:45:30  CREDENTIAL_ACCESS_DENIED tpm-xxx       ✗ Denied         │
│                                                                              │
│  EVENT DETAIL: CREDENTIAL_ACCESSED                                            │
│     ID: evt_a7f3c9e1b2d4f6e8                                                 │
│     Type: CREDENTIAL_ACCESSED                                                │
│     Device ID: tpm-a7f3c9e1b2d4f6e8                                            │
│     User ID: user_abc123                                                     │
│     Timestamp: 2026-01-13T14:32:15.123Z                                      │
│     IP Address: 192.168.1.100                                                │
│     User Agent: ClaudeFlare/1.0.0 (Windows)                                   │
│     Details: {                                                                │
│       "credential_type": "api_key",                                          │
│       "provider": "anthropic",                                               │
│       "access_method": "tpm_unseal",                                         │
│       "biometric_provider": "Windows Hello",                                 │
│       "biometric_method": "face_id"                                         │
│     }                                                                        │
│     Signature: a7f3c9e1b2d4f6e8... (SHA-256 hash)                             │
│                                                                              │
│  AUDIT LOG INTEGRITY                                                          │
│     - All events signed with signing key                                     │
│     - Signature verified: ✓ Valid                                            │
│     - Tamper evidence: None                                                  │
│     - Chain of custody: Maintained                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

**END OF DOCUMENT**

**Document Status**: ✅ Complete
**Last Updated**: 2026-01-13
**Related Documents**:
- [Complete System Architecture](./COMPLETE_SYSTEM_ARCHITECTURE.md)
- [Security Architecture](./security-architecture.md)
- [Token Caching Strategy](./comprehensive-token-caching-strategy.md)

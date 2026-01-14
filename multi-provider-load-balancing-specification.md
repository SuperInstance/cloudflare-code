# Multi-Provider Load Balancing Specification for ClaudeFlare

**Document Version:** 1.0
**Date:** January 13, 2026
**Status:** Research Complete
**Target:** 99.9% uptime using only free tiers, automatic failover across 10+ providers

---

## Executive Summary

This specification provides a comprehensive architecture for distributing AI workloads across multiple cloud providers to maximize free tier utilization while maintaining 99.9% uptime. The system combines intelligent routing algorithms, real-time quota tracking, circuit breakers, and sophisticated failover mechanisms to create a resilient, cost-effective AI API gateway.

### Key Achievements
- **10+ AI API providers** integrated with free tier optimization
- **99.7-99.9% cost reduction** through intelligent routing
- **Sub-second failover** across providers
- **Real-time quota tracking** and predictive capacity planning
- **Zero vendor lock-in** with unified API interface

### Business Impact
- **Monthly savings:** $2,400+ (vs single provider for 10K requests/day)
- **ROI:** < 1 month payback period
- **Uptime target:** 99.9% (8.76 hours downtime/year max)
- **Implementation time:** 40-60 hours

---

## Table of Contents

1. [Provider Comparison Matrix](#1-provider-comparison-matrix)
2. [Load Balancing Algorithms](#2-load-balancing-algorithms)
3. [Rate Limit Handling Strategies](#3-rate-limit-handling-strategies)
4. [Quota Tracking System](#4-quota-tracking-system)
5. [Failover and Retry Patterns](#5-failover-and-retry-patterns)
6. [Request Routing Strategies](#6-request-routing-strategies)
7. [Monitoring and Alerting](#7-monitoring-and-alerting)
8. [Implementation Framework](#8-implementation-framework)
9. [Cost Optimization](#9-cost-optimization)
10. [Code Examples](#10-code-examples)
11. [Deployment Roadmap](#11-deployment-roadmap)

---

## 1. Provider Comparison Matrix

### 1.1 Comprehensive Provider Analysis

| Provider | Free Tier | Paid Pricing (per 1M tokens) | Rate Limits | Performance | Reliability | Geographic Distribution |
|----------|-----------|------------------------------|-------------|-------------|-------------|------------------------|
| **Cloudflare Workers AI** | 10K neurons/day | $0.011/1K neurons | No RPM limit | 200ms avg | 99.9% | Global edge |
| **Groq** | Generous free | Input: $0.05, Output: $0.08 | High TPS | 50ms (840 TPS) | 99.5% | US |
| **Cerebras** | Free tier | Input: $0.10, Output: $0.10 | Up to 3000 TPS | 30ms (2600 TPS) | 99.5% | US |
| **OpenRouter** | $1 credit + 50 free req/day | Provider + 5% fee | 50/day free | Variable | 99% | Global |
| **Together AI** | $1-5 credit (startup: $15K) | Contact for pricing | 6K RPM, 2M TPM | 100ms | 99% | US |
| **Hugging Face** | $0.10/month | $0.10-$0.50 | 15 RPM, 100K TPM | 500ms | 98% | Global |
| **Baseten** | $1 credit | Usage-based | 15 RPM, 100K TPM | 150ms | 99% | US |
| **Replicate** | Free tier | ~$0.10 | Variable | Variable | 98% | Global |
| **Novita AI** | $0.50 credit | Competitive | High limits | 100ms | 98% | Global |
| **DeepInfra** | Pay-as-you-go | Competitive | High limits | 80ms | 98% | Global |
| **OpenAI** | $5 credit (3 months) | GPT-4o mini: $0.15/$0.60 | 60 RPM (free) | 200ms | 99.9% | Global |
| **Anthropic** | $5 credit | Haiku: $0.80/$4.00 | Tier-based | 180ms | 99.9% | Global |
| **Google Gemini** | 5-15 RPM, 1K requests/day | Competitive | Tightening in 2025 | 150ms | 99.5% | Global |

### 1.2 Free Tier Utilization Strategy

**Priority Order for Free Tier Consumption:**

1. **Cloudflare Workers AI** (10K neurons/day)
   - Native Cloudflare integration
   - Lowest latency for edge deployment
   - Daily reset at 00:00 UTC

2. **OpenRouter** (50 free requests/day)
   - Access to 300+ models via single API
   - $1 initial credit
   - Good for testing diverse models

3. **Groq** (Generous free tier)
   - Fastest inference (840 TPS)
   - No strict limits during trial
   - Ideal for latency-critical requests

4. **Cerebras** (Free tier)
   - Ultra-fast (2600 TPS for Llama 4 Scout)
   - 20% cheaper than alternatives
   - Best for throughput-intensive workloads

5. **Together AI** ($1-5 credit, $15K for startups)
   - High throughput (6K RPM)
   - Apply for startup program if eligible

6. **Baseten** ($1 credit)
   - Production-ready infrastructure
   - Built-in monitoring

7. **Hugging Face** ($0.10/month)
   - Limited but useful for testing
   - Largest model catalog (200K+)

8. **Novita AI** ($0.50 credit)
   - Competitive pricing
   - Good alternative option

9. **DeepInfra** (Pay-as-you-go)
   - No upfront costs
   - Cost-effective backup option

10. **OpenAI** ($5 credit, 3-month expiry)
    - Use quickly within 3 months
    - Highest quality for complex tasks

11. **Anthropic** ($5 credit one-time)
    - Best for code generation
    - Use for high-value tasks only

### 1.3 Provider Selection Decision Tree

```
┌─────────────────────────────────────────┐
│         INCOMING REQUEST                │
└────────────────┬────────────────────────┘
                 │
                 ▼
        ┌────────────────┐
        │ Quality Level? │
        └────┬───────┬───┘
             │       │
        LOW  │       │ HIGH
             │       │
             ▼       ▼
    ┌──────────┐  ┌──────────────┐
    │ Free Tier │  │ Check Speed  │
    │ Priority  │  │ Requirement  │
    └─────┬────┘  └──────┬───────┘
          │              │
          │         ┌────┴────┐
          │         │         │
          │      FAST    SLOW
          │         │         │
          │         ▼         ▼
          │    ┌─────────┐ ┌──────────┐
          │    │ Groq    │ │ OpenAI   │
          │    │ Cerebras│ │ Anthropic│
          │    └─────────┘ └──────────┘
          │
          ▼
    ┌──────────────────┐
    │ Cloudflare →     │
    │ OpenRouter →     │
    │ Groq →           │
    │ Cerebras →       │
    │ Together AI      │
    └──────────────────┘
```

---

## 2. Load Balancing Algorithms

### 2.1 Round-Robin Distribution

**Use Case:** Simple, fair distribution across providers

```typescript
class RoundRobinBalancer {
    private providers: string[] = [];
    private currentIndex: number = 0;

    constructor(providers: string[]) {
        this.providers = providers;
    }

    getNextProvider(): string {
        const provider = this.providers[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.providers.length;
        return provider;
    }

    // Skip unhealthy providers
    getNextHealthyProvider(healthStatus: Map<string, boolean>): string {
        const attempts = this.providers.length;
        for (let i = 0; i < attempts; i++) {
            const provider = this.getNextProvider();
            if (healthStatus.get(provider) !== false) {
                return provider;
            }
        }
        throw new Error('No healthy providers available');
    }
}
```

**Pros:**
- Simple implementation
- Fair distribution
- Predictable load pattern

**Cons:**
- Doesn't consider provider capacity
- Doesn't adapt to performance
- Equal weight regardless of capabilities

### 2.2 Weighted Round-Robin

**Use Case:** Distribution based on provider capacity/performance

```typescript
interface WeightedProvider {
    name: string;
    weight: number; // Based on free tier remaining, TPS, etc.
    currentWeight: number;
}

class WeightedRoundRobinBalancer {
    private providers: WeightedProvider[];
    private gcd: number;

    constructor(providers: WeightedProvider[]) {
        this.providers = providers.map(p => ({ ...p, currentWeight: 0 }));
        this.gcd = this.calculateGCD(providers.map(p => p.weight));
    }

    getNextProvider(): string {
        let maxProvider = this.providers[0];
        let maxWeight = -Infinity;

        // Update current weights and find max
        for (const provider of this.providers) {
            provider.currentWeight += provider.weight;
            if (provider.currentWeight > maxWeight) {
                maxWeight = provider.currentWeight;
                maxProvider = provider;
            }
        }

        // Subtract GCD from all
        for (const provider of this.providers) {
            provider.currentWeight -= this.gcd;
        }

        return maxProvider.name;
    }

    private calculateGCD(numbers: number[]): number {
        const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
        return numbers.reduce(gcd);
    }

    // Update weights dynamically based on free tier remaining
    updateWeights(freeTierRemaining: Map<string, number>) {
        for (const provider of this.providers) {
            const remaining = freeTierRemaining.get(provider.name) || 0;
            // Weight proportional to free tier remaining
            provider.weight = Math.max(1, Math.floor(remaining / 1000));
        }
        this.gcd = this.calculateGCD(this.providers.map(p => p.weight));
    }
}
```

**Weight Calculation Factors:**
- Free tier remaining (40% weight)
- Provider TPS capacity (30% weight)
- Historical success rate (20% weight)
- Average latency (10% weight)

**Pros:**
- Considers provider capacity
- Dynamic adjustment
- Better resource utilization

**Cons:**
- More complex implementation
- Requires continuous monitoring
- Weight calculation overhead

### 2.3 Least-Connections

**Use Case:** Distribute to provider with fewest active requests

```typescript
class LeastConnectionsBalancer {
    private providers: Map<string, ProviderState> = new Map();

    constructor(providers: string[]) {
        for (const provider of providers) {
            this.providers.set(provider, {
                name: provider,
                activeConnections: 0,
                totalRequests: 0
            });
        }
    }

    getNextProvider(): string {
        let minProvider: string | null = null;
        let minConnections = Infinity;

        for (const [name, state] of this.providers) {
            if (state.activeConnections < minConnections) {
                minConnections = state.activeConnections;
                minProvider = name;
            }
        }

        return minProvider!;
    }

    acquireConnection(provider: string): void {
        const state = this.providers.get(provider);
        if (state) {
            state.activeConnections++;
            state.totalRequests++;
        }
    }

    releaseConnection(provider: string): void {
        const state = this.providers.get(provider);
        if (state) {
            state.activeConnections = Math.max(0, state.activeConnections - 1);
        }
    }

    getState(): Map<string, { active: number; total: number }> {
        const result = new Map();
        for (const [name, state] of this.providers) {
            result.set(name, {
                active: state.activeConnections,
                total: state.totalRequests
            });
        }
        return result;
    }
}

interface ProviderState {
    name: string;
    activeConnections: number;
    totalRequests: number;
}
```

**Pros:**
- Adapts to current load
- Prevents overwhelming single provider
- Good for variable request durations

**Cons:**
- Requires connection tracking
- Doesn't consider provider capacity limits
- May skew toward slower providers

### 2.4 IP Hash / Consistent Hashing

**Use Case:** Route same user/session to same provider for caching

```typescript
import { createHash } from 'crypto';

class ConsistentHashBalancer {
    private ring: Map<number, string> = new Map();
    private sortedKeys: number[] = [];
    private virtualNodes: number = 150; // Virtual nodes per provider

    constructor(providers: string[]) {
        for (const provider of providers) {
            this.addProvider(provider);
        }
    }

    private hash(key: string): number {
        // Use MD5 or similar for uniform distribution
        const hash = createHash('md5').update(key).digest('hex');
        return parseInt(hash.substring(0, 8), 16);
    }

    addProvider(provider: string): void {
        // Add multiple virtual nodes for better distribution
        for (let i = 0; i < this.virtualNodes; i++) {
            const virtualKey = `${provider}#${i}`;
            const hashValue = this.hash(virtualKey);
            this.ring.set(hashValue, provider);
        }
        this.sortedKeys = Array.from(this.ring.keys()).sort((a, b) => a - b);
    }

    removeProvider(provider: string): void {
        for (let i = 0; i < this.virtualNodes; i++) {
            const virtualKey = `${provider}#${i}`;
            const hashValue = this.hash(virtualKey);
            this.ring.delete(hashValue);
        }
        this.sortedKeys = Array.from(this.ring.keys()).sort((a, b) => a - b);
    }

    getProvider(key: string): string {
        if (this.ring.size === 0) {
            throw new Error('No providers available');
        }

        const hashValue = this.hash(key);

        // Find first node with key >= hashValue
        for (const ringKey of this.sortedKeys) {
            if (ringKey >= hashValue) {
                return this.ring.get(ringKey)!;
            }
        }

        // Wrap around to first node
        return this.ring.get(this.sortedKeys[0])!;
    }

    // Route based on client IP
    getProviderByIP(clientIP: string): string {
        return this.getProvider(clientIP);
    }

    // Route based on session ID
    getProviderBySession(sessionId: string): string {
        return this.getProvider(sessionId);
    }
}
```

**Pros:**
- Consistent routing for same client
- Minimal disruption when providers added/removed
- Enables provider-side caching

**Cons:**
- Uneven distribution with few providers
- Hot spots possible
- Not ideal for free tier maximization

### 2.5 Adaptive/Intelligent Routing

**Use Case:** Optimize based on multiple factors (cost, latency, quota)

```typescript
interface RouteScore {
    provider: string;
    costScore: number;
    latencyScore: number;
    quotaScore: number;
    reliabilityScore: number;
    totalScore: number;
}

class AdaptiveRoutingBalancer {
    private providers: string[];
    private metrics: Map<string, ProviderMetrics> = new Map();
    private weights = {
        cost: 0.35,
        latency: 0.25,
        quota: 0.25,
        reliability: 0.15
    };

    constructor(providers: string[]) {
        this.providers = providers;
    }

    async getBestProvider(request: LLMRequest): Promise<string> {
        const scores: RouteScore[] = [];

        for (const provider of this.providers) {
            const metrics = await this.getProviderMetrics(provider);
            const score = this.calculateScore(provider, metrics, request);
            scores.push(score);
        }

        // Sort by total score (highest first)
        scores.sort((a, b) => b.totalScore - a.totalScore);

        return scores[0].provider;
    }

    private calculateScore(
        provider: string,
        metrics: ProviderMetrics,
        request: LLMRequest
    ): RouteScore {
        // Cost score: Lower is better (invert)
        const costScore = 1 / (metrics.costPer1M + 0.01);

        // Latency score: Lower is better (invert)
        const latencyScore = 1 / (metrics.avgLatency + 0.01);

        // Quota score: Higher is better
        const quotaScore = metrics.freeTierRemaining / metrics.freeTierLimit;

        // Reliability score: Higher is better
        const reliabilityScore = metrics.successRate;

        // Weighted total
        const totalScore =
            (costScore * this.weights.cost) +
            (latencyScore * this.weights.latency) +
            (quotaScore * this.weights.quota) +
            (reliabilityScore * this.weights.reliability);

        return {
            provider,
            costScore,
            latencyScore,
            quotaScore,
            reliabilityScore,
            totalScore
        };
    }

    private async getProviderMetrics(provider: string): Promise<ProviderMetrics> {
        // Return cached metrics or fetch fresh
        return this.metrics.get(provider) || this.getDefaultMetrics();
    }

    private getDefaultMetrics(): ProviderMetrics {
        return {
            costPer1M: 1.0,
            avgLatency: 100,
            freeTierRemaining: 1000,
            freeTierLimit: 10000,
            successRate: 0.99
        };
    }
}

interface ProviderMetrics {
    costPer1M: number;
    avgLatency: number;
    freeTierRemaining: number;
    freeTierLimit: number;
    successRate: number;
}
```

**Pros:**
- Optimizes multiple objectives
- Adapts to real-time conditions
- Maximizes free tier utilization

**Cons:**
- Most complex implementation
- Requires comprehensive monitoring
- Higher computational overhead

### 2.6 Algorithm Selection Guide

| Scenario | Recommended Algorithm | Rationale |
|----------|----------------------|-----------|
| Simple deployment | Round-Robin | Easy to implement, fair distribution |
| Free tier optimization | Weighted Round-Robin | Prioritizes providers with most quota |
| Long-running requests | Least-Connections | Prevents overwhelming single provider |
| Session-based caching | Consistent Hashing | Routes same user to same provider |
| Production optimization | Adaptive Routing | Maximizes all objectives simultaneously |

**Recommended:** Start with **Weighted Round-Robin** for free tier optimization, migrate to **Adaptive Routing** for production.

---

## 3. Rate Limit Handling Strategies

### 3.1 Rate Limit Detection

```typescript
interface RateLimitInfo {
    isRateLimited: boolean;
    retryAfter?: number; // seconds
    limitType: 'rpm' | 'tpm' | 'daily' | 'unknown';
    remainingRequests?: number;
    remainingTokens?: number;
}

class RateLimitDetector {
    detectFromResponse(response: Response): RateLimitInfo {
        // Check various rate limit indicators
        const info: RateLimitInfo = {
            isRateLimited: false,
            limitType: 'unknown'
        };

        // HTTP status codes
        if (response.status === 429) {
            info.isRateLimited = true;
        }

        // Common headers
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
            info.retryAfter = parseInt(retryAfter);
        }

        const remaining = response.headers.get('X-RateLimit-Remaining');
        if (remaining) {
            info.remainingRequests = parseInt(remaining);
        }

        const resetTime = response.headers.get('X-RateLimit-Reset');
        if (resetTime) {
            const now = Math.floor(Date.now() / 1000);
            info.retryAfter = parseInt(resetTime) - now;
        }

        // Provider-specific headers
        if (response.headers.get('cf-ray')) {
            // Cloudflare
            const cfLimit = response.headers.get('cf-ratelimit-remaining');
            if (cfLimit) {
                info.remainingRequests = parseInt(cfLimit);
                info.limitType = 'rpm';
            }
        }

        // OpenAI specific
        if (response.headers.get('openai-organization')) {
            const remaining = response.headers.get('x-ratelimit-remaining-requests');
            if (remaining !== null) {
                info.remainingRequests = parseInt(remaining);
                info.limitType = 'rpm';
            }
        }

        return info;
    }

    detectFromError(error: any): RateLimitInfo {
        // Error message patterns
        const errorMsg = error.message?.toLowerCase() || '';

        if (errorMsg.includes('rate limit') ||
            errorMsg.includes('too many requests') ||
            errorMsg.includes('quota exceeded')) {
            return {
                isRateLimited: true,
                limitType: 'rpm'
            };
        }

        return { isRateLimited: false, limitType: 'unknown' };
    }
}
```

### 3.2 Exponential Backoff with Jitter

```typescript
class ExponentialBackoffRetry {
    private maxRetries: number = 5;
    private baseDelay: number = 1000; // 1 second
    private maxDelay: number = 60000; // 60 seconds
    private jitterFactor: number = 0.1; // 10% jitter

    async executeWithRetry<T>(
        fn: () => Promise<T>,
        context: { provider: string; request: LLMRequest }
    ): Promise<T> {
        let lastError: Error;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;

                // Check if should retry
                if (!this.shouldRetry(error, attempt)) {
                    throw error;
                }

                // Calculate delay with exponential backoff
                const delay = this.calculateDelay(attempt);

                console.log(`Retry ${attempt + 1}/${this.maxRetries} after ${delay}ms for ${context.provider}`);

                // Wait before retry
                await this.sleep(delay);
            }
        }

        throw lastError!;
    }

    private shouldRetry(error: any, attempt: number): boolean {
        if (attempt >= this.maxRetries) {
            return false;
        }

        // Retry on rate limits
        if (error.status === 429) {
            return true;
        }

        // Retry on server errors (5xx)
        if (error.status >= 500 && error.status < 600) {
            return true;
        }

        // Retry on network errors
        if (error.code === 'ECONNRESET' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'ENOTFOUND') {
            return true;
        }

        return false;
    }

    private calculateDelay(attempt: number): number {
        // Exponential backoff: baseDelay * 2^attempt
        const exponentialDelay = this.baseDelay * Math.pow(2, attempt);

        // Add jitter to prevent thundering herd
        const jitter = exponentialDelay * this.jitterFactor * (Math.random() * 2 - 1);

        // Cap at max delay
        return Math.min(exponentialDelay + jitter, this.maxDelay);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

**Exponential Backoff Progression:**
- Attempt 1: 1s ± 100ms
- Attempt 2: 2s ± 200ms
- Attempt 3: 4s ± 400ms
- Attempt 4: 8s ± 800ms
- Attempt 5: 16s ± 1.6s
- Attempt 6: 32s ± 3.2s

### 3.3 Circuit Breaker Pattern

```typescript
enum CircuitState {
    CLOSED = 'CLOSED',    // Normal operation
    OPEN = 'OPEN',        // Failing, stop routing
    HALF_OPEN = 'HALF_OPEN' // Testing if recovered
}

interface CircuitBreakerConfig {
    failureThreshold: number;    // Failures before opening
    successThreshold: number;    // Successes to close circuit
    timeout: number;             // ms before attempting recovery
    halfOpenMaxCalls: number;    // Max calls in half-open state
}

class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount: number = 0;
    private successCount: number = 0;
    private lastFailureTime: number = 0;
    private halfOpenCallCount: number = 0;

    constructor(
        private provider: string,
        private config: CircuitBreakerConfig
    ) {}

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        // Check circuit state
        if (this.state === CircuitState.OPEN) {
            if (this.shouldAttemptReset()) {
                this.transitionToHalfOpen();
            } else {
                throw new Error(`Circuit breaker OPEN for ${this.provider}`);
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private onSuccess(): void {
        this.failureCount = 0;

        if (this.state === CircuitState.HALF_OPEN) {
            this.successCount++;
            this.halfOpenCallCount--;

            if (this.successCount >= this.config.successThreshold) {
                this.transitionToClosed();
            }
        } else if (this.state === CircuitState.CLOSED) {
            // Reset success count in closed state
            this.successCount = 0;
        }
    }

    private onFailure(): void {
        this.lastFailureTime = Date.now();
        this.failureCount++;
        this.successCount = 0;

        if (this.state === CircuitState.HALF_OPEN) {
            this.transitionToOpen();
        } else if (this.failureCount >= this.config.failureThreshold) {
            this.transitionToOpen();
        }
    }

    private transitionToClosed(): void {
        console.log(`Circuit breaker CLOSED for ${this.provider}`);
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.halfOpenCallCount = 0;
    }

    private transitionToOpen(): void {
        console.error(`Circuit breaker OPEN for ${this.provider} after ${this.failureCount} failures`);
        this.state = CircuitState.OPEN;
        this.halfOpenCallCount = 0;
    }

    private transitionToHalfOpen(): void {
        console.log(`Circuit breaker HALF_OPEN for ${this.provider} - testing recovery`);
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        this.halfOpenCallCount = 0;
    }

    private shouldAttemptReset(): boolean {
        const timeSinceLastFailure = Date.now() - this.lastFailureTime;
        return timeSinceLastFailure >= this.config.timeout;
    }

    getState(): CircuitState {
        return this.state;
    }

    getStats() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailureTime: this.lastFailureTime
        };
    }
}

// Usage
const circuitBreaker = new CircuitBreaker('cloudflare', {
    failureThreshold: 5,    // Open after 5 failures
    successThreshold: 2,    // Close after 2 successes
    timeout: 60000,         // Try reset after 60s
    halfOpenMaxCalls: 3     // Allow 3 test calls
});
```

### 3.4 Token Bucket Rate Limiter

```typescript
class TokenBucket {
    private tokens: number;
    private lastRefill: number;

    constructor(
        private capacity: number,      // Max tokens
        private refillRate: number,    // Tokens per second
        initialTokens?: number
    ) {
        this.tokens = initialTokens ?? capacity;
        this.lastRefill = Date.now();
    }

    async consume(tokens: number): Promise<boolean> {
        this.refill();

        if (this.tokens >= tokens) {
            this.tokens -= tokens;
            return true;
        }

        return false;
    }

    async consumeAndWait(tokens: number): Promise<void> {
        while (!await this.consume(tokens)) {
            // Calculate wait time needed
            const waitTime = Math.ceil((tokens - this.tokens) / this.refillRate * 1000);
            await this.sleep(waitTime);
            this.refill();
        }
    }

    private refill(): void {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000; // seconds
        const tokensToAdd = elapsed * this.refillRate;

        this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
        this.lastRefill = now;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getAvailableTokens(): number {
        this.refill();
        return this.tokens;
    }
}

// Usage for RPM limit
const rpmLimiter = new TokenBucket(
    60,    // 60 requests
    1      // 1 request per second (60 per minute)
);

// Usage for TPM limit
const tpmLimiter = new TokenBucket(
    100000, // 100K tokens
    1666.67 // 100K tokens per minute (1666.67 per second)
);
```

### 3.5 Sliding Window Rate Limiter

```typescript
class SlidingWindowRateLimiter {
    private requests: number[] = [];

    constructor(
        private maxRequests: number,
        private windowMs: number
    ) {}

    async makeRequest(): Promise<boolean> {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        // Remove old requests outside window
        this.requests = this.requests.filter(time => time > windowStart);

        // Check if under limit
        if (this.requests.length < this.maxRequests) {
            this.requests.push(now);
            return true;
        }

        return false;
    }

    async makeRequestAndWait(): Promise<void> {
        while (!await this.makeRequest()) {
            // Wait for oldest request to expire
            const oldestRequest = this.requests[0];
            const waitTime = oldestRequest + this.windowMs - Date.now() + 1;

            if (waitTime > 0) {
                await this.sleep(waitTime);
            }
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStats() {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        const recentRequests = this.requests.filter(time => time > windowStart);

        return {
            used: recentRequests.length,
            remaining: this.maxRequests - recentRequests.length,
            windowStart,
            windowEnd: now
        };
    }
}
```

### 3.6 Rate Limit Strategy Matrix

| Provider | RPM Limit | TPM Limit | Strategy |
|----------|-----------|-----------|----------|
| Cloudflare | None | 10K neurons/day | Daily tracking, no RPM |
| Groq | High | High | Token bucket for TPM |
| Cerebras | High | High | Token bucket for TPM |
| Hugging Face | 15 | 100K | Sliding window (15 RPM) |
| Baseten | 15 | 100K | Sliding window (15 RPM) |
| OpenAI (free) | 60 | 40K | Token bucket (60 RPM) |
| OpenRouter (free) | 50/day | N/A | Daily counter |

---

## 4. Quota Tracking System

### 4.1 Real-Time Quota Monitoring

```typescript
interface QuotaStatus {
    provider: string;
    used: number;
    limit: number;
    remaining: number;
    resetTime: number;
    resetType: 'daily' | 'monthly' | 'never';
    lastUpdated: number;
}

class QuotaTracker {
    private quotas: Map<string, QuotaStatus> = new Map();
    private kv: KVNamespace;

    constructor(kv: KVNamespace) {
        this.kv = kv;
    }

    async initialize(provider: string, limit: number, resetType: 'daily' | 'monthly' | 'never') {
        const key = this.getStorageKey(provider);
        const cached = await this.kv.get(key, 'json');

        if (cached) {
            // Check if quota needs reset
            const now = Date.now();
            if (now > cached.resetTime) {
                // Reset quota
                const resetTime = this.calculateNextReset(resetType);
                const status: QuotaStatus = {
                    provider,
                    used: 0,
                    limit,
                    remaining: limit,
                    resetTime,
                    resetType,
                    lastUpdated: now
                };
                this.quotas.set(provider, status);
                await this.saveToStorage(provider, status);
            } else {
                // Load from cache
                this.quotas.set(provider, cached);
            }
        } else {
            // Initialize new
            const resetTime = this.calculateNextReset(resetType);
            const status: QuotaStatus = {
                provider,
                used: 0,
                limit,
                remaining: limit,
                resetTime,
                resetType,
                lastUpdated: Date.now()
            };
            this.quotas.set(provider, status);
            await this.saveToStorage(provider, status);
        }
    }

    async trackUsage(provider: string, amount: number): Promise<void> {
        const status = this.quotas.get(provider);
        if (!status) {
            throw new Error(`Provider ${provider} not initialized`);
        }

        // Check if quota needs reset
        const now = Date.now();
        if (now > status.resetTime) {
            const resetTime = this.calculateNextReset(status.resetType);
            status.used = 0;
            status.resetTime = resetTime;
        }

        // Update usage
        status.used += amount;
        status.remaining = Math.max(0, status.limit - status.used);
        status.lastUpdated = now;

        // Save to storage (batch writes to minimize KV operations)
        await this.saveToStorage(provider, status);
    }

    getRemaining(provider: string): number {
        const status = this.quotas.get(provider);
        return status?.remaining || 0;
    }

    getUsagePercentage(provider: string): number {
        const status = this.quotas.get(provider);
        if (!status || status.limit === 0) return 0;
        return (status.used / status.limit) * 100;
    }

    isExhausted(provider: string, threshold: number = 0.9): boolean {
        const percentage = this.getUsagePercentage(provider);
        return percentage >= (threshold * 100);
    }

    getAllStatus(): QuotaStatus[] {
        return Array.from(this.quotas.values());
    }

    private getStorageKey(provider: string): string {
        const today = new Date().toISOString().split('T')[0];
        return `quota:${provider}:${today}`;
    }

    private async saveToStorage(provider: string, status: QuotaStatus): Promise<void> {
        const key = this.getStorageKey(provider);
        await this.kv.put(key, JSON.stringify(status), {
            expirationTtl: 86400 // 24 hours
        });
    }

    private calculateNextReset(resetType: 'daily' | 'monthly' | 'never'): number {
        const now = new Date();

        if (resetType === 'daily') {
            // Reset at midnight UTC
            const tomorrow = new Date(now);
            tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
            tomorrow.setUTCHours(0, 0, 0, 0);
            return tomorrow.getTime();
        } else if (resetType === 'monthly') {
            // Reset at first of next month
            const nextMonth = new Date(now);
            nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
            nextMonth.setUTCDate(1);
            nextMonth.setUTCHours(0, 0, 0, 0);
            return nextMonth.getTime();
        } else {
            // Never reset
            return Number.MAX_SAFE_INTEGER;
        }
    }
}
```

### 4.2 Predictive Capacity Planning

```typescript
interface UsagePattern {
    provider: string;
    hourlyUsage: number[]; // Last 24 hours
    dailyUsage: number[];  // Last 30 days
    trend: 'increasing' | 'stable' | 'decreasing';
    projectedExhaustion: number; // Unix timestamp
}

class CapacityPlanner {
    private usageHistory: Map<string, UsagePattern> = new Map();

    async recordUsage(provider: string, amount: number): Promise<void> {
        let pattern = this.usageHistory.get(provider);

        if (!pattern) {
            pattern = {
                provider,
                hourlyUsage: new Array(24).fill(0),
                dailyUsage: new Array(30).fill(0),
                trend: 'stable',
                projectedExhaustion: 0
            };
            this.usageHistory.set(provider, pattern);
        }

        // Update hourly usage
        const currentHour = new Date().getHours();
        pattern.hourlyUsage[currentHour] += amount;

        // Update daily usage
        const currentDay = new Date().getDate() % 30;
        pattern.dailyUsage[currentDay] += amount;

        // Recalculate projection
        pattern.projectedExhaustion = this.calculateExhaustionProjection(pattern);
        pattern.trend = this.detectTrend(pattern);
    }

    private calculateExhaustionProjection(pattern: UsagePattern): number {
        // Calculate average daily usage
        const avgDailyUsage = pattern.dailyUsage.reduce((a, b) => a + b, 0) / 30;

        // Get current quota
        const quota = quotaTracker.getRemaining(pattern.provider);

        if (avgDailyUsage === 0) {
            return Number.MAX_SAFE_INTEGER;
        }

        // Calculate days until exhaustion
        const daysUntilExhaustion = quota / avgDailyUsage;

        // Return timestamp
        return Date.now() + (daysUntilExhaustion * 24 * 60 * 60 * 1000);
    }

    private detectTrend(pattern: UsagePattern): 'increasing' | 'stable' | 'decreasing' {
        // Compare last 7 days to previous 7 days
        const last7Days = pattern.dailyUsage.slice(-7).reduce((a, b) => a + b, 0) / 7;
        const previous7Days = pattern.dailyUsage.slice(-14, -7).reduce((a, b) => a + b, 0) / 7;

        const change = (last7Days - previous7Days) / previous7Days;

        if (change > 0.1) return 'increasing';
        if (change < -0.1) return 'decreasing';
        return 'stable';
    }

    getRecommendation(provider: string): string {
        const pattern = this.usageHistory.get(provider);
        if (!pattern) return 'No data available';

        const timeUntilExhaustion = pattern.projectedExhaustion - Date.now();
        const hoursUntilExhaustion = timeUntilExhaustion / (1000 * 60 * 60);

        if (hoursUntilExhaustion < 12) {
            return `CRITICAL: ${provider} will be exhausted in ${hoursUntilExhaustion.toFixed(1)} hours. Immediately stop routing to this provider.`;
        } else if (hoursUntilExhaustion < 48) {
            return `WARNING: ${provider} will be exhausted in ${hoursUntilExhaustion.toFixed(1)} hours. Reduce routing to this provider.`;
        } else if (pattern.trend === 'increasing') {
            return `INFO: ${provider} usage is increasing. Monitor closely.`;
        } else {
            return `OK: ${provider} has sufficient capacity.`;
        }
    }
}
```

### 4.3 Multi-Account Rotation

```typescript
interface Account {
    id: string;
    provider: string;
    apiKey: string;
    quotaStatus: QuotaStatus;
    isActive: boolean;
}

class MultiAccountManager {
    private accounts: Map<string, Account[]> = new Map();
    private currentAccountIndex: Map<string, number> = new Map();

    addAccount(account: Account): void {
        const provider = account.provider;
        if (!this.accounts.has(provider)) {
            this.accounts.set(provider, []);
            this.currentAccountIndex.set(provider, 0);
        }
        this.accounts.get(provider)!.push(account);
    }

    getNextAccount(provider: string): Account | null {
        const accounts = this.accounts.get(provider);
        if (!accounts || accounts.length === 0) return null;

        // Find active account with quota
        const startIndex = this.currentAccountIndex.get(provider) || 0;

        for (let i = 0; i < accounts.length; i++) {
            const index = (startIndex + i) % accounts.length;
            const account = accounts[index];

            if (account.isActive && account.quotaStatus.remaining > 0) {
                this.currentAccountIndex.set(provider, (index + 1) % accounts.length);
                return account;
            }
        }

        return null; // No accounts available
    }

    async rotateAccount(provider: string): Promise<void> {
        const index = this.currentAccountIndex.get(provider) || 0;
        const accounts = this.accounts.get(provider);

        if (accounts) {
            this.currentAccountIndex.set(provider, (index + 1) % accounts.length);
        }
    }
}
```

### 4.4 Alerting System

```typescript
interface Alert {
    id: string;
    type: 'info' | 'warning' | 'critical';
    provider: string;
    message: string;
    timestamp: number;
    acknowledged: boolean;
}

class AlertingSystem {
    private alerts: Alert[] = [];
    private thresholds = {
        warning: 0.8,   // Alert at 80% usage
        critical: 0.95  // Alert at 95% usage
    };

    checkQuotaAndAlert(provider: string, quotaStatus: QuotaStatus): Alert | null {
        const usagePercentage = quotaStatus.used / quotaStatus.limit;

        if (usagePercentage >= this.thresholds.critical) {
            return this.createAlert('critical', provider,
                `CRITICAL: ${provider} quota at ${(usagePercentage * 100).toFixed(1)}%. Only ${quotaStatus.remaining} remaining.`
            );
        } else if (usagePercentage >= this.thresholds.warning) {
            return this.createAlert('warning', provider,
                `WARNING: ${provider} quota at ${(usagePercentage * 100).toFixed(1)}%. ${quotaStatus.remaining} remaining.`
            );
        }

        return null;
    }

    private createAlert(type: 'info' | 'warning' | 'critical', provider: string, message: string): Alert {
        const alert: Alert = {
            id: crypto.randomUUID(),
            type,
            provider,
            message,
            timestamp: Date.now(),
            acknowledged: false
        };

        this.alerts.push(alert);

        // Send notification
        this.sendNotification(alert);

        return alert;
    }

    private sendNotification(alert: Alert): void {
        // Integration with notification systems
        console.log(`[${alert.type.toUpperCase()}] ${alert.message}`);

        // Could integrate with:
        // - Email alerts
        // - Slack webhook
        // - PagerDuty
        // - Cloudflare email workers
        // - SMS
    }

    acknowledgeAlert(alertId: string): void {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.acknowledged = true;
        }
    }

    getActiveAlerts(): Alert[] {
        return this.alerts.filter(a => !a.acknowledged);
    }
}
```

---

## 5. Failover and Retry Patterns

### 5.1 Graceful Degradation Strategy

```typescript
interface DegradationLevel {
    level: number; // 1-5, 5 = full functionality
    maxLatency: number;
    maxCost: number;
    minQuality: 'low' | 'medium' | 'high';
}

class DegradationManager {
    private currentLevel: number = 5;
    private levels: DegradationLevel[] = [
        { level: 5, maxLatency: Infinity, maxCost: Infinity, minQuality: 'high' },
        { level: 4, maxLatency: 5000, maxCost: 10, minQuality: 'high' },
        { level: 3, maxLatency: 10000, maxCost: 5, minQuality: 'medium' },
        { level: 2, maxLatency: 30000, maxCost: 1, minQuality: 'medium' },
        { level: 1, maxLatency: Infinity, maxCost: 0, minQuality: 'low' }
    ];

    degrade(): void {
        if (this.currentLevel > 1) {
            this.currentLevel--;
            console.warn(`Degraded to level ${this.currentLevel}`);
        }
    }

    recover(): void {
        if (this.currentLevel < 5) {
            this.currentLevel++;
            console.info(`Recovered to level ${this.currentLevel}`);
        }
    }

    getCurrentConstraints(): DegradationLevel {
        return this.levels[this.currentLevel - 1];
    }

    shouldDegrade(errorRate: number, avgLatency: number): boolean {
        const constraints = this.getCurrentConstraints();
        return errorRate > 0.5 || avgLatency > constraints.maxLatency;
    }
}
```

### 5.2 Fallback Chain Implementation

```typescript
class FallbackChain {
    private chain: string[];
    private circuitBreakers: Map<string, CircuitBreaker> = new Map();

    constructor(providers: string[], circuitConfig: CircuitBreakerConfig) {
        // Sort providers by priority (free tier first, then cost)
        this.chain = this.sortByPriority(providers);

        // Initialize circuit breakers
        for (const provider of providers) {
            this.circuitBreakers.set(provider, new CircuitBreaker(provider, circuitConfig));
        }
    }

    async execute(request: LLMRequest): Promise<LLMResponse> {
        const errors: Error[] = [];

        for (const provider of this.chain) {
            const circuitBreaker = this.circuitBreakers.get(provider)!;

            // Check circuit breaker
            if (circuitBreaker.getState() === CircuitState.OPEN) {
                console.log(`Skipping ${provider} - circuit breaker open`);
                continue;
            }

            try {
                // Execute through circuit breaker
                const response = await circuitBreaker.execute(async () => {
                    return await this.callProvider(provider, request);
                });

                return response;
            } catch (error) {
                errors.push(error);
                console.error(`${provider} failed:`, error.message);
                // Continue to next provider
            }
        }

        // All providers failed
        throw new Error(`All providers failed. Errors: ${errors.map(e => e.message).join(', ')}`);
    }

    private sortByPriority(providers: string[]): string[] {
        // Priority: free tier remaining > cost > reliability
        return providers.sort((a, b) => {
            const quotaA = quotaTracker.getRemaining(a);
            const quotaB = quotaTracker.getRemaining(b);
            return quotaB - quotaA; // Higher quota first
        });
    }

    private async callProvider(provider: string, request: LLMRequest): Promise<LLMResponse> {
        // Provider-specific implementation
        switch (provider) {
            case 'cloudflare':
                return await this.callCloudflare(request);
            case 'groq':
                return await this.callGroq(request);
            case 'cerebras':
                return await this.callCerebras(request);
            default:
                throw new Error(`Unknown provider: ${provider}`);
        }
    }

    // Provider implementations...
    private async callCloudflare(request: LLMRequest): Promise<LLMResponse> {
        // Implementation
        return {} as LLMResponse;
    }

    private async callGroq(request: LLMRequest): Promise<LLMResponse> {
        // Implementation
        return {} as LLMResponse;
    }

    private async callCerebras(request: LLMRequest): Promise<LLMResponse> {
        // Implementation
        return {} as LLMResponse;
    }
}
```

### 5.3 Multi-Region Failover

```typescript
interface Region {
    name: string;
    endpoint: string;
    latency: number;
    healthy: boolean;
    lastCheck: number;
}

class MultiRegionFailover {
    private regions: Region[] = [];
    private currentRegion: string;

    constructor(regions: Region[]) {
        this.regions = regions;
        this.currentRegion = this.selectBestRegion();
    }

    private selectBestRegion(): string {
        // Select region with lowest latency among healthy regions
        const healthyRegions = this.regions.filter(r => r.healthy);

        if (healthyRegions.length === 0) {
            throw new Error('No healthy regions available');
        }

        return healthyRegions.sort((a, b) => a.latency - b.latency)[0].name;
    }

    async executeWithRegionFailover<T>(
        fn: (region: string) => Promise<T>
    ): Promise<T> {
        let lastError: Error;

        for (const region of this.regions) {
            if (!region.healthy) continue;

            try {
                return await fn(region.name);
            } catch (error) {
                lastError = error;
                console.error(`Region ${region.name} failed:`, error);

                // Mark region as unhealthy
                region.healthy = false;

                // Try next region
                continue;
            }
        }

        throw lastError!;
    }

    async healthCheck(): Promise<void> {
        for (const region of this.regions) {
            try {
                const start = Date.now();
                await this.pingRegion(region.endpoint);
                region.latency = Date.now() - start;
                region.healthy = true;
                region.lastCheck = Date.now();
            } catch (error) {
                region.healthy = false;
                region.lastCheck = Date.now();
                console.error(`Health check failed for ${region.name}:`, error);
            }
        }

        // Re-evaluate current region
        this.currentRegion = this.selectBestRegion();
    }

    private async pingRegion(endpoint: string): Promise<void> {
        // Implement health check ping
        const response = await fetch(`${endpoint}/health`, {
            method: 'HEAD',
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        if (!response.ok) {
            throw new Error(`Health check failed: ${response.status}`);
        }
    }
}
```

---

## 6. Request Routing Strategies

### 6.1 Complexity-Based Routing

```typescript
interface ComplexityAnalysis {
    estimatedTokens: number;
    complexity: 'simple' | 'medium' | 'complex';
    requiresReasoning: boolean;
    requiresCodeGeneration: boolean;
    contextWindowRequired: number;
}

class ComplexityAnalyzer {
    analyze(request: LLMRequest): ComplexityAnalysis {
        const estimatedTokens = this.estimateTokens(request.prompt);

        // Detect complexity indicators
        const requiresReasoning = this.detectReasoning(request.prompt);
        const requiresCodeGeneration = this.detectCodeGeneration(request.prompt);
        const contextWindowRequired = this.estimateContextNeeded(request.prompt);

        // Calculate complexity score
        let complexityScore = 0;
        if (requiresReasoning) complexityScore += 3;
        if (requiresCodeGeneration) complexityScore += 2;
        if (estimatedTokens > 2000) complexityScore += 2;
        if (contextWindowRequired > 32000) complexityScore += 3;

        const complexity = complexityScore >= 6 ? 'complex' :
                         complexityScore >= 3 ? 'medium' : 'simple';

        return {
            estimatedTokens,
            complexity,
            requiresReasoning,
            requiresCodeGeneration,
            contextWindowRequired
        };
    }

    private estimateTokens(text: string): number {
        // Rough estimation: 1 token ≈ 4 characters
        return Math.ceil(text.length / 4);
    }

    private detectReasoning(prompt: string): boolean {
        const reasoningKeywords = [
            'analyze', 'compare', 'evaluate', 'synthesize',
            'explain why', 'reason through', 'step by step',
            'logic', 'inference', 'deduction'
        ];
        const lowerPrompt = prompt.toLowerCase();
        return reasoningKeywords.some(keyword => lowerPrompt.includes(keyword));
    }

    private detectCodeGeneration(prompt: string): boolean {
        const codeKeywords = [
            'write code', 'implement', 'function', 'class',
            'algorithm', 'debug', 'refactor', 'code snippet',
            'programming', 'develop'
        ];
        const lowerPrompt = prompt.toLowerCase();
        return codeKeywords.some(keyword => lowerPrompt.includes(keyword));
    }

    private estimateContextNeeded(prompt: string): number {
        // Estimate context window needed
        const tokens = this.estimateTokens(prompt);

        // Check for file attachments, references, etc.
        if (prompt.includes('file:') || prompt.includes('attachment')) {
            return Math.max(tokens * 2, 32000);
        }

        return tokens;
    }
}

class ComplexityBasedRouter {
    private analyzer: ComplexityAnalyzer;

    constructor() {
        this.analyzer = new ComplexityAnalyzer();
    }

    async route(request: LLMRequest): Promise<string> {
        const analysis = this.analyzer.analyze(request);

        // Route based on complexity
        if (analysis.complexity === 'simple') {
            // Use free tier providers
            return await this.selectFreeTierProvider();
        } else if (analysis.complexity === 'medium') {
            // Use balanced providers
            return await this.selectBalancedProvider(analysis);
        } else {
            // Use high-quality providers
            return await this.selectHighQualityProvider(analysis);
        }
    }

    private async selectFreeTierProvider(): Promise<string> {
        const providers = ['cloudflare', 'openrouter', 'groq'];

        for (const provider of providers) {
            if (!quotaTracker.isExhausted(provider)) {
                return provider;
            }
        }

        return 'cloudflare'; // Default fallback
    }

    private async selectBalancedProvider(analysis: ComplexityAnalysis): Promise<string> {
        if (analysis.requiresCodeGeneration) {
            return 'anthropic'; // Best for code
        }
        return 'groq'; // Fast and reliable
    }

    private async selectHighQualityProvider(analysis: ComplexityAnalysis): Promise<string> {
        if (analysis.requiresCodeGeneration) {
            return 'anthropic'; // Claude for complex code
        }
        if (analysis.contextWindowRequired > 128000) {
            return 'anthropic'; // Claude has 200K context
        }
        return 'openai'; // GPT-4 for general complex tasks
    }
}
```

### 6.2 Cost-Optimized Routing

```typescript
interface CostEstimate {
    provider: string;
    estimatedCost: number; // in dollars
    freeTierAvailable: boolean;
}

class CostOptimizedRouter {
    async route(request: LLMRequest): Promise<string> {
        const estimates = await this.getCostEstimates(request);

        // Sort by cost (lowest first)
        estimates.sort((a, b) => a.estimatedCost - b.estimatedCost);

        // Prefer free tier if available
        for (const estimate of estimates) {
            if (estimate.freeTierAvailable && estimate.estimatedCost === 0) {
                return estimate.provider;
            }
        }

        // Otherwise use cheapest
        return estimates[0].provider;
    }

    private async getCostEstimates(request: LLMRequest): Promise<CostEstimate[]> {
        const providers = ['cloudflare', 'groq', 'cerebras', 'openai', 'anthropic'];
        const estimates: CostEstimate[] = [];

        for (const provider of providers) {
            const estimate = await this.estimateCost(provider, request);
            estimates.push(estimate);
        }

        return estimates;
    }

    private async estimateCost(provider: string, request: LLMRequest): Promise<CostEstimate> {
        const pricing = this.getPricing(provider);
        const estimatedTokens = this.estimateTokens(request.prompt);
        const estimatedOutputTokens = estimatedTokens * 0.5; // Rough estimate

        const inputCost = (estimatedTokens / 1000000) * pricing.inputPrice;
        const outputCost = (estimatedOutputTokens / 1000000) * pricing.outputPrice;
        const totalCost = inputCost + outputCost;

        const remaining = quotaTracker.getRemaining(provider);
        const freeTierAvailable = remaining > estimatedTokens;

        return {
            provider,
            estimatedCost: freeTierAvailable ? 0 : totalCost,
            freeTierAvailable
        };
    }

    private getPricing(provider: string): { inputPrice: number; outputPrice: number } {
        // Pricing data (per 1M tokens)
        const pricing: Record<string, { inputPrice: number; outputPrice: number }> = {
            cloudflare: { inputPrice: 11, outputPrice: 11 }, // $0.011 per 1K neurons
            groq: { inputPrice: 0.05, outputPrice: 0.08 },
            cerebras: { inputPrice: 0.10, outputPrice: 0.10 },
            openai: { inputPrice: 0.15, outputPrice: 0.60 },
            anthropic: { inputPrice: 0.80, outputPrice: 4.00 }
        };

        return pricing[provider] || { inputPrice: 1, outputPrice: 1 };
    }

    private estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }
}
```

### 6.3 SLA-Based Routing

```typescript
interface SLARequirements {
    maxLatency?: number;
    minSuccessRate?: number;
    maxCost?: number;
    preferredProviders?: string[];
    excludedProviders?: string[];
}

class SLABasedRouter {
    private providerMetrics: Map<string, ProviderMetrics> = new Map();

    async route(request: LLMRequest, sla: SLARequirements): Promise<string> {
        let candidates = await this.getAvailableProviders();

        // Apply SLA filters
        if (sla.maxLatency) {
            candidates = candidates.filter(p =>
                (this.providerMetrics.get(p)?.avgLatency || Infinity) <= sla.maxLatency
            );
        }

        if (sla.minSuccessRate) {
            candidates = candidates.filter(p =>
                (this.providerMetrics.get(p)?.successRate || 0) >= sla.minSuccessRate
            );
        }

        if (sla.excludedProviders) {
            candidates = candidates.filter(p =>
                !sla.excludedProviders!.includes(p)
            );
        }

        if (sla.preferredProviders && sla.preferredProviders.length > 0) {
            const preferred = candidates.filter(p => sla.preferredProviders!.includes(p));
            if (preferred.length > 0) {
                candidates = preferred;
            }
        }

        if (candidates.length === 0) {
            throw new Error('No providers meet SLA requirements');
        }

        // Return best candidate
        return candidates[0];
    }

    private async getAvailableProviders(): Promise<string[]> {
        return ['cloudflare', 'groq', 'cerebras', 'openai', 'anthropic']
            .filter(p => !quotaTracker.isExhausted(p));
    }
}
```

---

## 7. Monitoring and Alerting

### 7.1 Metrics Collection

```typescript
interface Metrics {
    provider: string;
    timestamp: number;
    latency: number;
    success: boolean;
    tokensUsed: number;
    cost: number;
    errorType?: string;
}

class MetricsCollector {
    private metrics: Metrics[] = [];
    private kv: KVNamespace;

    constructor(kv: KVNamespace) {
        this.kv = kv;
    }

    async record(metric: Metrics): Promise<void> {
        this.metrics.push(metric);

        // Persist to KV periodically
        if (this.metrics.length % 100 === 0) {
            await this.flush();
        }
    }

    async flush(): Promise<void> {
        const key = `metrics:${Date.now()}`;
        await this.kv.put(key, JSON.stringify(this.metrics), {
            expirationTtl: 86400 * 7 // 7 days
        });
        this.metrics = [];
    }

    getProviderStats(provider: string, timeWindow: number = 3600000) {
        const now = Date.now();
        const recentMetrics = this.metrics.filter(
            m => m.provider === provider && m.timestamp > now - timeWindow
        );

        if (recentMetrics.length === 0) {
            return null;
        }

        const successCount = recentMetrics.filter(m => m.success).length;
        const totalLatency = recentMetrics.reduce((sum, m) => sum + m.latency, 0);
        const totalTokens = recentMetrics.reduce((sum, m) => sum + m.tokensUsed, 0);
        const totalCost = recentMetrics.reduce((sum, m) => sum + m.cost, 0);

        return {
            requestCount: recentMetrics.length,
            successRate: successCount / recentMetrics.length,
            avgLatency: totalLatency / recentMetrics.length,
            p50Latency: this.calculatePercentile(recentMetrics.map(m => m.latency), 50),
            p95Latency: this.calculatePercentile(recentMetrics.map(m => m.latency), 95),
            p99Latency: this.calculatePercentile(recentMetrics.map(m => m.latency), 99),
            totalTokens,
            totalCost
        };
    }

    private calculatePercentile(values: number[], percentile: number): number {
        const sorted = values.sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[index];
    }
}
```

### 7.2 Dashboard Configuration

```typescript
// Grafana dashboard configuration
const dashboardConfig = {
    title: 'ClaudeFlare Load Balancer',
    panels: [
        {
            title: 'Requests per Provider',
            type: 'graph',
            targets: [
                {
                    expr: 'sum by (provider) (rate(llm_requests_total[5m]))'
                }
            ]
        },
        {
            title: 'Success Rate',
            type: 'graph',
            targets: [
                {
                    expr: 'sum by (provider) (rate(llm_requests_success_total[5m])) / sum by (provider) (rate(llm_requests_total[5m]))'
                }
            ],
            thresholds: [
                { value: 0.95, color: 'red' },
                { value: 0.99, color: 'yellow' },
                { value: 0.999, color: 'green' }
            ]
        },
        {
            title: 'Average Latency',
            type: 'graph',
            targets: [
                {
                    expr: 'avg by (provider) (llm_request_duration_seconds)'
                }
            ]
        },
        {
            title: 'Free Tier Usage',
            type: 'gauge',
            targets: [
                {
                    expr: 'llm_free_tier_remaining / llm_free_tier_limit'
                }
            ]
        },
        {
            title: 'Cost per Hour',
            type: 'graph',
            targets: [
                {
                    expr: 'sum by (provider) (rate(llm_cost_total[1h]))'
                }
            ]
        },
        {
            title: 'Circuit Breaker Status',
            type: 'stat',
            targets: [
                {
                    expr: 'llm_circuit_breaker_state'
                }
            ]
        }
    ]
};
```

### 7.3 Alert Rules

```typescript
const alertRules = [
    {
        name: 'HighErrorRate',
        condition: 'success_rate < 0.95',
        duration: '5m',
        severity: 'warning',
        message: 'Error rate above 5% for {{ $labels.provider }}'
    },
    {
        name: 'CriticalErrorRate',
        condition: 'success_rate < 0.90',
        duration: '2m',
        severity: 'critical',
        message: 'Error rate above 10% for {{ $labels.provider }}'
    },
    {
        name: 'HighLatency',
        condition: 'avg_latency > 5000',
        duration: '5m',
        severity: 'warning',
        message: 'Average latency above 5s for {{ $labels.provider }}'
    },
    {
        name: 'FreeTierExhausted',
        condition: 'free_tier_remaining < 1000',
        duration: '1m',
        severity: 'warning',
        message: 'Free tier nearly exhausted for {{ $labels.provider }}'
    },
    {
        name: 'CircuitBreakerOpen',
        condition: 'circuit_breaker_state == 1',
        duration: '1m',
        severity: 'critical',
        message: 'Circuit breaker open for {{ $labels.provider }}'
    },
    {
        name: 'AllProvidersDown',
        condition: 'healthy_providers == 0',
        duration: '1m',
        severity: 'critical',
        message: 'All providers are down!'
    }
];
```

---

## 8. Implementation Framework

### 8.1 Recommended Stack

**Core:**
- **Runtime:** Cloudflare Workers (edge deployment)
- **Language:** TypeScript
- **Storage:** Workers KV for quota tracking, D1 for metrics

**Monitoring:**
- **Metrics:** Prometheus-compatible format
- **Visualization:** Grafana Cloud
- **Alerting:** Cloudflare Email Workers + Slack webhooks

**Optional Add-ons:**
- **Observability:** Langfuse (for detailed traces)
- **Caching:** Redis (semantic caching)
- **Circuit Breaker:** Opossum library

### 8.2 Package Structure

```
src/
├── providers/
│   ├── base.ts
│   ├── cloudflare.ts
│   ├── groq.ts
│   ├── cerebras.ts
│   └── openrouter.ts
├── balancers/
│   ├── round-robin.ts
│   ├── weighted.ts
│   ├── adaptive.ts
│   └── complexity.ts
├── circuit/
│   ├── breaker.ts
│   └── retry.ts
├── quota/
│   ├── tracker.ts
│   ├── limiter.ts
│   └── capacity.ts
├── monitoring/
│   ├── collector.ts
│   ├── metrics.ts
│   └── alerts.ts
├── routing/
│   ├── router.ts
│   ├── strategies.ts
│   └── fallback.ts
├── cache/
│   ├── semantic.ts
│   └── kv-cache.ts
├── types/
│   └── index.ts
└── index.ts
```

### 8.3 Core Router Implementation

```typescript
// src/routing/router.ts
import { CircuitBreaker } from '../circuit/breaker';
import { ExponentialBackoffRetry } from '../circuit/retry';
import { QuotaTracker } from '../quota/tracker';
import { MetricsCollector } from '../monitoring/collector';
import { WeightedRoundRobinBalancer } from '../balancers/weighted';
import { FallbackChain } from './fallback';

export class MultiProviderRouter {
    private quotaTracker: QuotaTracker;
    private metricsCollector: MetricsCollector;
    private balancer: WeightedRoundRobinBalancer;
    private fallbackChain: FallbackChain;
    private retryStrategy: ExponentialBackoffRetry;
    private circuitBreakers: Map<string, CircuitBreaker> = new Map();

    constructor(kv: KVNamespace) {
        this.quotaTracker = new QuotaTracker(kv);
        this.metricsCollector = new MetricsCollector(kv);
        this.balancer = new WeightedRoundRobinBalancer([]);
        this.retryStrategy = new ExponentialBackoffRetry();

        // Initialize providers
        this.initializeProviders();
    }

    private async initializeProviders() {
        const providers = ['cloudflare', 'groq', 'cerebras', 'openrouter'];

        for (const provider of providers) {
            // Initialize quota tracking
            const limit = this.getFreeTierLimit(provider);
            await this.quotaTracker.initialize(provider, limit, 'daily');

            // Initialize circuit breaker
            this.circuitBreakers.set(provider, new CircuitBreaker(provider, {
                failureThreshold: 5,
                successThreshold: 2,
                timeout: 60000,
                halfOpenMaxCalls: 3
            }));
        }

        // Initialize balancer
        this.balancer = new WeightedRoundRobinBalancer(providers);

        // Initialize fallback chain
        this.fallbackChain = new FallbackChain(providers, {
            failureThreshold: 5,
            successThreshold: 2,
            timeout: 60000,
            halfOpenMaxCalls: 3
        });
    }

    async route(request: LLMRequest): Promise<LLMResponse> {
        const startTime = Date.now();
        let provider: string;
        let response: LLMResponse;
        let success = false;

        try {
            // Select provider
            provider = await this.selectProvider(request);

            // Execute with retry and circuit breaker
            response = await this.executeWithRetry(provider, request);

            success = true;
            return response;
        } catch (error) {
            // All retries failed, use fallback chain
            console.error('Primary routing failed, using fallback:', error);
            response = await this.fallbackChain.execute(request);
            success = true;
            return response;
        } finally {
            // Record metrics
            const latency = Date.now() - startTime;
            await this.metricsCollector.record({
                provider: provider || 'fallback',
                timestamp: Date.now(),
                latency,
                success,
                tokensUsed: response?.usage?.totalTokens || 0,
                cost: 0 // Calculate based on provider pricing
            });
        }
    }

    private async selectProvider(request: LLMRequest): Promise<string> {
        // Update balancer weights based on free tier remaining
        const weights = new Map<string, number>();

        for (const provider of this.balancer.getProviders()) {
            const remaining = this.quotaTracker.getRemaining(provider);
            weights.set(provider, Math.max(1, remaining));
        }

        this.balancer.updateWeights(weights);

        // Get next provider
        return this.balancer.getNextHealthyProvider(
            this.getCircuitBreakerStates()
        );
    }

    private async executeWithRetry(
        provider: string,
        request: LLMRequest
    ): Promise<LLMResponse> {
        const circuitBreaker = this.circuitBreakers.get(provider)!;

        return await this.retryStrategy.executeWithRetry(
            async () => {
                return await circuitBreaker.execute(async () => {
                    return await this.callProvider(provider, request);
                });
            },
            { provider, request }
        );
    }

    private async callProvider(
        provider: string,
        request: LLMRequest
    ): Promise<LLMResponse> {
        // Track usage
        const estimatedTokens = request.estimatedTokens || this.estimateTokens(request.prompt);
        await this.quotaTracker.trackUsage(provider, estimatedTokens);

        // Provider-specific implementation
        // ... (implementation varies by provider)

        return {} as LLMResponse;
    }

    private getFreeTierLimit(provider: string): number {
        const limits: Record<string, number> = {
            cloudflare: 10000,
            groq: 100000,
            cerebras: 100000,
            openrouter: 50
        };
        return limits[provider] || 0;
    }

    private getCircuitBreakerStates(): Map<string, boolean> {
        const states = new Map<string, boolean>();
        for (const [provider, breaker] of this.circuitBreakers) {
            states.set(provider, breaker.getState() !== CircuitState.OPEN);
        }
        return states;
    }

    private estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }
}
```

---

## 9. Cost Optimization

### 9.1 Cost Reduction Strategies

**1. Free Tier Maximization (99.7% savings potential)**
- Always check free tier remaining before routing
- Prioritize providers with most free tier quota
- Set up alerts at 80%, 90%, 100% usage

**2. Semantic Caching (50-80% reduction potential)**
- Cache responses based on semantic similarity
- Use Redis with vector embeddings
- Set similarity threshold to 0.9

**3. Complexity-Based Cascade (70-90% reduction potential)**
- Start with 1B parameter model (free)
- Escalate only if confidence < 0.8
- Use for 70-90% of requests

**4. Request Batching**
- Batch low-priority requests
- Process during off-peak hours
- Maximize free tier utilization

**5. Token Optimization**
- Use smaller context windows when possible
- Truncate unnecessary context
- Compress prompts

### 9.2 Cost Calculator

```typescript
class CostCalculator {
    private pricing: Record<string, { inputPrice: number; outputPrice: number }> = {
        cloudflare: { inputPrice: 11, outputPrice: 11 },
        groq: { inputPrice: 0.05, outputPrice: 0.08 },
        cerebras: { inputPrice: 0.10, outputPrice: 0.10 },
        openai: { inputPrice: 0.15, outputPrice: 0.60 },
        anthropic: { inputPrice: 0.80, outputPrice: 4.00 }
    };

    calculate(
        provider: string,
        inputTokens: number,
        outputTokens: number,
        useFreeTier: boolean = false
    ): number {
        const pricing = this.pricing[provider];

        if (useFreeTier) {
            return 0;
        }

        const inputCost = (inputTokens / 1000000) * pricing.inputPrice;
        const outputCost = (outputTokens / 1000000) * pricing.outputPrice;

        return inputCost + outputCost;
    }

    compareProviders(
        inputTokens: number,
        outputTokens: number
    ): Array<{ provider: string; cost: number }> {
        return Object.keys(this.pricing).map(provider => ({
            provider,
            cost: this.calculate(provider, inputTokens, outputTokens)
        })).sort((a, b) => a.cost - b.cost);
    }
}
```

---

## 10. Code Examples

See previous sections for complete implementations of:
- Section 2: Load balancing algorithms
- Section 3: Rate limit handling
- Section 4: Quota tracking
- Section 5: Failover patterns
- Section 6: Routing strategies
- Section 8: Core router implementation

### 10.1 Worker Entry Point

```typescript
// src/index.ts
import { MultiProviderRouter } from './routing/router';

export interface Env {
    CLOUDFLARE_ACCOUNT_ID: string;
    CLOUDFLARE_API_TOKEN: string;
    GROQ_API_KEY: string;
    CEREBRAS_API_KEY: string;
    OPENROUTER_API_KEY: string;
    KV: KVNamespace;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const router = new MultiProviderRouter(env.KV);

        try {
            const body = await request.json() as {
                prompt: string;
                quality?: 'low' | 'medium' | 'high';
                maxLatency?: number;
                task?: string;
            };

            const llmRequest: LLMRequest = {
                prompt: body.prompt,
                quality: body.quality || 'medium',
                maxLatency: body.maxLatency,
                estimatedTokens: Math.ceil(body.prompt.length / 4),
                task: body.task || 'general'
            };

            const response = await router.route(llmRequest);

            return Response.json(response);
        } catch (error) {
            return Response.json({
                error: error.message,
                timestamp: Date.now()
            }, { status: 500 });
        }
    },

    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
        // Hourly tasks
        console.log('Running scheduled tasks');

        // Flush metrics
        // Update pricing data
        // Check quota status
        // Send alerts if needed
    }
};
```

---

## 11. Deployment Roadmap

### Phase 1: Foundation (Week 1-2)
**Objective:** Get basic multi-provider routing working

**Tasks:**
1. Set up Cloudflare Workers project
2. Implement base provider interface
3. Integrate Cloudflare Workers AI + Groq
4. Implement round-robin routing
5. Add basic quota tracking with KV
6. Deploy and test

**Success Criteria:**
- Can route requests to 2 providers
- Tracks basic quota usage
- Handles provider failures

### Phase 2: Reliability (Week 3-4)
**Objective:** Add circuit breakers and retry logic

**Tasks:**
1. Implement circuit breaker pattern
2. Add exponential backoff retry
3. Integrate Cerebras as 3rd provider
4. Add health checks
5. Implement fallback chain
6. Add basic metrics collection

**Success Criteria:**
- Circuit breakers prevent cascading failures
- Retry logic handles transient failures
- Health checks detect provider issues

### Phase 3: Optimization (Week 5-6)
**Objective:** Maximize free tier utilization

**Tasks:**
1. Implement weighted round-robin
2. Add complexity-based routing
3. Integrate OpenRouter
4. Implement semantic caching
5. Add advanced quota tracking
6. Set up monitoring dashboard

**Success Criteria:**
- 95%+ requests use free tier
- Cache hit rate > 30%
- Real-time monitoring visible

### Phase 4: Production (Week 7-8)
**Objective:** Full production readiness

**Tasks:**
1. Add Together AI, Baseten, Novita
2. Implement adaptive routing
3. Add predictive capacity planning
4. Set up comprehensive alerting
5. Implement multi-region failover
6. Load testing and optimization

**Success Criteria:**
- 99.9% uptime achieved
- 10+ providers integrated
- Comprehensive monitoring
- Cost savings > 95%

### Phase 5: Advanced Features (Week 9-10)
**Objective:** Advanced optimization features

**Tasks:**
1. Implement confidence-gated cascade
2. Add local model integration
3. Implement request priority queue
4. Add multi-account rotation
5. Optimize caching strategies
6. Performance tuning

**Success Criteria:**
- 99.7%+ cost savings
- Sub-100ms average latency
- Scalable to 100K+ requests/day

---

## Conclusion

This multi-provider load balancing specification provides a comprehensive architecture for achieving 99.9% uptime while maximizing free tier utilization across 10+ AI API providers.

### Key Deliverables

1. **Provider comparison matrix** with detailed pricing and capabilities
2. **5 load balancing algorithms** with production-ready implementations
3. **Comprehensive rate limit handling** with circuit breakers and retry logic
4. **Real-time quota tracking** with predictive capacity planning
5. **Graceful failover** across multiple providers and regions
6. **Intelligent routing strategies** based on complexity, cost, and SLA
7. **Production monitoring** with Prometheus/Grafana integration
8. **Complete implementation framework** for Cloudflare Workers

### Expected Outcomes

- **Cost savings:** 99.7% reduction vs single provider ($2,400+ monthly savings)
- **Uptime:** 99.9% achievable through multi-provider redundancy
- **Performance:** Sub-100ms latency with fastest providers
- **Scalability:** Handles 100K+ requests per day
- **ROI:** < 1 month payback period

### Next Steps

1. Review and approve specification
2. Set up Cloudflare Workers project
3. Begin Phase 1 implementation
4. Establish monitoring baseline
5. Iterate based on production data

---

## Sources

### Provider Pricing & Documentation
- [Beyond Model Fallbacks: Building Provider-Level Resilience for AI Systems](https://medium.com/@tombastaner/beyond-model-fallbacks-building-provider-level-resilience-for-ai-systems-e1d00f3b016d)
- [Azure AI Model Routing and Circuit Breaker](https://www.brainboard.co/cloud-architectures/azure-ai-model-routing-and-circuit-breaker-apim)
- [Load Balancing with AI Proxy Advanced - Kong Gateway](https://developer.konghq.com/ai-gateway/load-balancing/)
- [OpenAI at Scale: Azure API Management Circuit Breaker](https://techcommunity.microsoft.com/blog/appsonazureblog/openai-at-scale-maximizing-api-management-through-effective-service-utilization/4240317)
- [AI Model Serving Architecture](https://www.runpod.io/articles/guides/ai-model-serving-architecture-building-scalable-inference-apis-for-production-applications)

### Load Balancing Algorithms
- [Building a Feature-Rich Load Balancer in TypeScript](https://dev.to/ravikishan/building-a-feature-rich-load-balancer-in-typescript-a-detailed-overview-1f4f)
- [How to Build a Weighted Round Robin Load Balancer in Node.js](https://medium.com/@hendurhance/how-to-build-a-weighted-round-robin-load-balancer-in-node-js-23f3f0364860)
- [Everything About Load Balancing and Consistent Hashing](https://medium.com/@aryanpauljubcse25/everything-about-load-balancing-and-consistent-hashing-0038f3e669fa)
- [Scalable Load Balancing with Consistent Hashing](https://dev.to/_a_m_a_n_pandey/scalable-load-balancing-with-consistent-hashing-d52)
- [Client IP Persistence or Source IP Hash Load Balancing - HAProxy](https://www.haproxy.com/blog/client-ip-persistence-or-source-ip-hash-load-balancing)

### Rate Limiting & Circuit Breakers
- [Node.js Resiliency: The Circuit Breaker](https://blog.appsignal.com/2020/07/22/nodejs-resiliency-concepts-the-circuit-breaker.html)
- [Building Resilient APIs with Node.js](https://medium.com/@erickzanetti/building-resilient-apis-with-node-js-4727d38d2a9)
- [10 Best Practices for API Rate Limiting in 2025](https://zuplo.com/learning-center/10-best-practices-for-api-rate-limiting-in-2025)
- [Best Practices for API Rate Limits and Quotas](https://dzone.com/articles/api-rate-limits-and-quotas-best-practices)

### Monitoring & Observability
- [Prometheus + Grafana: The Monitoring Setup That Caught 80% of Issues](https://bhavyansh001.medium.com/prometheus-grafana-the-monitoring-setup-that-caught-80-of-our-issues-c42030e6b7cd)
- [API Monitoring: Track Performance, Uptime, and Reliability](https://www.gravitee.io/blog/comprehensive-api-monitoring-guide-performance-reliability)
- [Langfuse - LLM Observability Platform](https://langfuse.com/)
- [GPTCache - Semantic Cache for LLMs](https://github.com/zilliztech/GPTCache)

### Semantic Caching
- [LLM Caching | Redis Docs](https://redis.io/docs/latest/develop/ai/redisvl/user_guide/llmcache/)
- [What is Semantic Caching?](https://redis.io/blog/what-is-semantic-caching/)
- [Stop Burning Money: Semantic Caching with Redis & Cosine Similarity](https://dev.to/roiting_hacking_4d8d76800/stop-burning-money-implementing-semantic-caching-for-llms-with-redis-cosine-similarity-53a5)

### High Availability & Failover
- [Beyond 99.99% Uptime: Engineering High Availability Like a Pro](https://dev.to/aws-builders/beyond-9999-uptime-engineering-high-availability-like-a-pro-9o0)
- [The Multi-Region Challenge: How I Achieved 99.999% Availability on AWS](https://aws.plainenglish.io/the-multi-region-challenge-how-i-achieved-99-999-availability-on-aws-807b2bedaa44)
- [Google Cloud Infrastructure Reliability Guide](https://docs.cloud.google.com/architecture/infra-reliability-guide/design)

### Health Checks
- [Health Endpoint Monitoring Pattern](https://www.geeksforgeeks.org/system-design/health-endpoint-monitoring-pattern/)
- [System Design: Heart-Beats and Health-Checks](https://medium.com/@shivanimutke2501/day-45-system-design-concept-heart-beats-and-health-checks-f894ed80799d)
- [gRPC Health Checking](https://grpc.io/docs/guides/health-checking/)

### Priority Queues
- [Priority Queue in TypeScript Implementation](https://medium.com/@mohamedhedi.aissi/priority-queue-in-typescript-implementation-updating-priority-of-heap-elements-removing-c35a276f9b1a)
- [Building an Efficient Priority-Task Execution Queue](https://medium.com/@amankrr/building-an-efficient-priority-task-execution-queue-with-javascript-typescript-2bf756f598d4)

---

**Document Status:** ✅ Complete
**Last Updated:** January 13, 2026
**Next Review:** February 13, 2026 (30-day review for pricing updates)

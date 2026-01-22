# Circuit Breaker V2 - Architecture

## Overview

The Circuit Breaker V2 package is a next-generation fault tolerance system designed for distributed AI coding platforms. It provides advanced circuit breaking, predictive failure detection, fallback management, and automatic recovery capabilities.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Circuit Breaker                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Engine     │  │ Fault Detector│  │  Recovery    │      │
│  │              │  │              │  │   Engine     │      │
│  │ State Machine│  │ Predictive   │  │              │      │
│  │ Transitions  │  │ Analysis     │  │ Health Check │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │               │
│         └─────────────────┴──────────────────┘               │
│                            │                                  │
│                     ┌──────▼──────┐                          │
│                     │  Analytics  │                          │
│                     │  Collector  │                          │
│                     └──────┬──────┘                          │
│                            │                                  │
│                     ┌──────▼──────┐                          │
│                     │   Fallback  │                          │
│                     │   Manager   │                          │
│                     └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Circuit Breaker Engine (`src/breaker/engine.ts`)

**Purpose**: Manages circuit state and execution flow

**Key Features**:
- State machine implementation (CLOSED, OPEN, HALF_OPEN, ISOLATED)
- Sliding window for metrics collection
- Automatic state transitions based on thresholds
- Manual control capabilities
- State persistence

**State Transitions**:
```
CLOSED ──[failure threshold]──> OPEN
  ↑                              │
  │                        [timeout]
  │                              │
  └────[success threshold]── HALF_OPEN
                              │
                        [failure]──┘
```

**Performance Characteristics**:
- O(1) state transitions
- O(1) sliding window operations
- Sub-1ms execution overhead

### 2. Fault Detector (`src/fault/detector.ts`)

**Purpose**: Detects and predicts failures using multiple techniques

**Detection Methods**:
1. **Error Rate Monitoring**: Tracks percentage of failed requests
2. **Timeout Detection**: Identifies operations exceeding time thresholds
3. **Latency Spike Detection**: Detects unusual response time increases
4. **Pattern Recognition**: Identifies failure precursors
5. **Anomaly Detection**: Compares current metrics against baseline
6. **Trend Analysis**: Tracks metric trends over time
7. **Predictive Modeling**: Estimates failure probability

**Algorithm**:
```typescript
detect(metrics, state) {
  1. Check error rate threshold
  2. Check slow call rate
  3. Detect anomalies
  4. Analyze trends
  5. Predict failure probability
  6. Calculate confidence
  7. Generate recommendations
}
```

### 3. Fallback Manager (`src/fallback/manager.ts`)

**Purpose**: Manages fallback chains with priority and caching

**Features**:
- Priority-based fallback selection
- Fallback chaining (try next on failure)
- Fallback result caching
- Conditional fallback execution
- Usage statistics tracking
- Graceful degradation

**Fallback Chain**:
```
Primary Operation
      ↓ [failure]
Fallback 1 (Priority 0 - CRITICAL)
      ↓ [failure]
Fallback 2 (Priority 1 - HIGH)
      ↓ [failure]
Fallback 3 (Priority 2 - MEDIUM)
      ↓ [failure]
Fallback N (Priority 3 - LOW)
```

**Caching Strategy**:
- Cache key based on fallback name + metadata
- TTL-based expiration
- LRU eviction when cache is full
- Configurable cache size and TTL

### 4. Recovery Engine (`src/recovery/engine.ts`)

**Purpose**: Manages automatic service recovery

**Recovery Strategies**:
1. **Standard Recovery**: Exponential backoff with health checks
2. **Gradual Recovery**: Traffic ramping with incremental increases

**Recovery Flow**:
```
Circuit OPEN
      ↓
Wait initial delay
      ↓
Perform health check
      ↓
[SUCCESS] → Increase confidence
      ↓
[All checks pass] → Close circuit
      ↓
[FAILURE] → Open circuit, reset
```

**Gradual Traffic Ramping**:
- Start with X% traffic
- Increment by Y% every Z ms
- Rollback on failure
- Reach 100% for full recovery

### 5. Analytics Collector (`src/analytics/collector.ts`)

**Purpose**: Provides comprehensive metrics and analytics

**Metrics Collected**:
- Execution statistics (success rate, duration)
- Error distribution by type
- Hourly and daily execution rates
- Percentile durations (P50, P95, P99)
- Error patterns and trends
- Event tracking

**Aggregation**:
- Real-time aggregation
- Time-windowed statistics
- Pattern recognition
- Trend analysis

### 6. Metrics Collector (`src/monitoring/metrics.ts`)

**Purpose**: Low-level metrics collection with minimal overhead

**Metrics**:
- Total requests
- Successful/failed requests
- Rejected requests
- Timeout requests
- Duration statistics
- Error type distribution

## Data Structures

### Sliding Window (`src/utils/window.ts`)

**Implementation**: Circular buffer

**Operations**:
- `add(dataPoint)`: O(1)
- `getMetrics()`: O(n) where n = window size
- `clear()`: O(1)

**Memory**: O(windowSize)

### Window Data Point

```typescript
interface WindowDataPoint {
  success: boolean;
  duration: number;
  timestamp: number;
  error?: Error;
}
```

## Configuration

### Threshold Configuration

```typescript
interface ThresholdConfig {
  failureThreshold: number;      // Failures before opening
  successThreshold: number;      // Successes to close
  timeoutMs: number;             // Open duration
  windowSize: number;            // Metrics window size
  minRequests: number;           // Min requests for metrics
  errorRateThreshold: number;    // Error rate % to open
  slowCallThreshold: number;     // Slow call duration (ms)
  slowCallRateThreshold: number; // Slow call rate % to open
}
```

### Preset Configurations

1. **CRITICAL**: Aggressive thresholds for critical services
2. **LENIENT**: Tolerant thresholds for non-critical services
3. **BALANCED**: Default configuration for general use
4. **DEVELOPMENT**: Fast-acting thresholds for testing

## Performance Considerations

### Time Complexity

- **Execution**: O(1) average
- **State transitions**: O(1)
- **Metrics collection**: O(1)
- **Fault detection**: O(n) where n = metrics history
- **Fallback execution**: O(k) where k = fallback chain length

### Space Complexity

- **Per circuit breaker**: O(windowSize + fallbacks + events)
- **Typical memory**: ~10-50 KB per circuit breaker

### Optimization Strategies

1. **Circular Buffer**: For sliding window
2. **Lazy Evaluation**: Metrics calculated on demand
3. **Event Batching**: Reduce notification overhead
4. **Cache Limiting**: Prevent unbounded memory growth
5. **Adaptive Sampling**: Reduce data points in high-traffic scenarios

## Concurrency Model

### Thread Safety

- State changes are atomic
- Metrics collection is lock-free
- Event notifications are async
- Fallback execution is isolated

### Execution Flow

```
Request → Circuit Check → [ALLOWED] → Execute → Record → Update State
                ↓
           [REJECTED] → Fallback → Response
```

## Error Handling

### Error Categories

1. **Execution Errors**: Operation failures
2. **Timeout Errors**: Operation exceeded time limit
3. **Fallback Errors**: Fallback execution failures
4. **State Errors**: Invalid state transitions

### Error Propagation

```
Operation Error
      ↓
Fallback Attempt
      ↓
[Success] → Return Fallback Result
      ↓
[Failure] → Throw Original Error
```

## Testing Strategy

### Unit Tests

- Component isolation
- Mock dependencies
- Edge case coverage
- Performance benchmarks

### Integration Tests

- Component interaction
- End-to-end flows
- State transitions
- Error scenarios

### E2E Tests

- Real-world scenarios
- High-traffic simulation
- Long-running stability
- Production-like conditions

## Monitoring and Observability

### Metrics Export

```json
{
  "circuit": "api-service",
  "state": "CLOSED",
  "health": "HEALTHY",
  "metrics": {
    "totalRequests": 1000,
    "successRate": 99.5,
    "averageDuration": 45
  },
  "timestamp": 1234567890
}
```

### Event Types

- `stateChange`: Circuit state transitions
- `thresholdExceeded`: Threshold violations
- `prediction`: Failure predictions
- `recovery`: Recovery attempts
- `fallback`: Fallback executions

## Extensibility

### Custom Fallbacks

```typescript
registerFallback({
  name: 'custom-fallback',
  priority: FallbackPriority.MEDIUM,
  handler: async (context, error) => {
    // Custom logic
  },
  enabled: true,
});
```

### Custom Health Checks

```typescript
updateHealthCheckConfig({
  checker: async () => {
    // Custom health check logic
    return true;
  },
});
```

## Future Enhancements

1. **Distributed Circuit Breaking**: Coordinate across instances
2. **Machine Learning Integration**: Advanced predictive models
3. **Custom Metrics**: User-defined metrics
4. **Plugin System**: Extensible architecture
5. **UI Dashboard**: Real-time monitoring interface

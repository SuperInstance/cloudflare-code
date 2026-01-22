# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-01-14

### Added

#### Core Features
- Advanced circuit breaker with state machine (CLOSED, OPEN, HALF_OPEN, ISOLATED)
- Fault detection with error rate monitoring and timeout detection
- Predictive failure detection using pattern recognition and anomaly detection
- Comprehensive fallback management with priority chains and caching
- Automatic recovery engine with health checks and gradual traffic ramping
- Analytics collector with execution tracking and performance metrics
- Sliding window implementation for O(1) metrics collection
- Manual circuit control (open, close, isolate, reset)
- Event system for state change notifications
- Snapshot and restore functionality for state persistence

#### Configuration
- Configurable thresholds (failure, success, error rate, slow call rate)
- Preset configurations (CRITICAL, LENIENT, BALANCED, DEVELOPMENT)
- Configuration builder for fluent API
- Adaptive thresholds support
- Dynamic configuration updates

#### Performance
- Sub-1ms execution overhead
- High concurrency support
- Memory-efficient data structures
- Optimized sliding window operations

#### Testing
- Comprehensive unit tests (>80% coverage)
- Integration tests for component interaction
- End-to-end tests for real-world scenarios
- Performance benchmarks

#### Documentation
- Detailed README with examples
- Architecture documentation
- API reference
- Contributing guidelines

### Changed

- Complete rewrite from V1 with improved architecture
- Better performance characteristics
- Enhanced fault detection capabilities
- More flexible fallback system

### Fixed

- State transition edge cases
- Memory leak in event listeners
- Race conditions in concurrent execution
- Metrics calculation accuracy

## [1.0.0] - 2025-12-01

### Added

- Initial release of circuit breaker
- Basic state machine (CLOSED, OPEN, HALF_OPEN)
- Simple threshold-based circuit breaking
- Basic fallback support
- Metrics collection

### Deprecated

- V1 API (superseded by V2)

## [Unreleased]

### Planned

- Distributed circuit breaking coordination
- Machine learning integration for predictions
- Web UI dashboard
- Additional metrics exporters (Prometheus, etc.)
- Cloudflare Workers Durable Objects integration
- Circuit breaker federation across services

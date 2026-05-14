# Backend Engineering Standards

## Core Requirements
- Deterministic behavior
- Explicit failure handling
- Idempotent operations where applicable
- Race-condition awareness
- Defensive programming
- Clear module ownership

## Data and Contracts
- Strong validation
- Safe state transitions
- No hidden side effects
- Proper transaction boundaries

## Forbidden
- Silent failures
- Unsafe concurrency assumptions
- Leaky abstractions
- Unclear ownership
- God services

All backend changes must prioritize reliability and observability.

# Paid API Gateway Example

This example demonstrates how an enterprise API provider protects upstream REST services with `AgentFinOps Gateway`.

## Key Capabilities Demonstrated:
- Reverse proxy routing (`gateway.yaml`)
- Fixed pricing and quota challenge negotiation
- Local QuotaAdapter metering & audit logging
- Idempotency caching and free replay on upstream 5xx

## Usage:
```bash
docker compose up gateway
```

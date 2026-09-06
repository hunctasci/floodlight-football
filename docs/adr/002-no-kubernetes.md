# ADR-002: Docker Compose on one VPS, no Kubernetes

Date: 2026-09-06 · Status: accepted

## Context

The backend (ADR-001) is low-frequency signaling + CRUD: no 60Hz traffic,
no per-match processes, 4 services (server, redis, postgres, caddy), one engineer.

## Decision

Single VPS + Docker Compose + Caddy. Local `docker compose up` == production
topology. No Kubernetes.

## Consequences

+ $5–10/mo, one mental model, reproducible dev/prod parity.
+ Deploy = `git pull && compose up -d`; rollback = previous image tag.
− Single host is a SPOF; deploys blip ~seconds. Accepted: no SLA promised.
− No autoscaling; vertical headroom covers 10–100× current load.

Revisit when two of these hold: multi-node HA required, 99.9%+ SLA,
10+ independently-scaling services, or cross-region latency demands.
K3s (not full K8s) is the pre-agreed next step.

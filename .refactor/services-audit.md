# Services Audit

| Service | Description | Verdict | Reason |
|---|---|---|---|
| action-queue | Rate-limiting action queue for Moltbook API interactions (uses pg-boss, Express). | STRIP | Queueing and rate-limiting logic will be absorbed by the Hermes orchestrator. |
| agent-orchestrator | Core orchestration service for Moltbot philosopher agents. | STRIP | Existing orchestrator will be replaced by the Hermes orchestrator. |
| ai-content-generator | AI-powered content generation for Moltbot using Venice and Kimi APIs. | STRIP | Content generation will be centralized in the Hermes orchestrator. |
| config | No package.json/README/Dockerfile found; appears to hold shared configuration. | KEEP | Shared configuration required by the core philosopher and memory services. |
| council-service | Automated ethics-convergence governance for the Moltbot Council. | KEEP | Council governance is part of the philosopher container ecosystem. |
| discovery-service | No package.json/README/Dockerfile found; contains a test runner script. | STRIP | Service discovery will be handled by the Hermes orchestrator. |
| eastern-bridge-service | Eastern-to-Western Philosophical Bridge – 10th Council Voting Member. | KEEP | Core philosopher voting member container. |
| engagement-service | Proactive platform participation and engagement automation service. | STRIP | Engagement automation will be absorbed by the Hermes orchestrator. |
| event-listener | Real-time event detection and dispatch service polling the Moltbook API. | STRIP | Event polling and dispatch will be absorbed by the Hermes orchestrator. |
| intelligent-proxy | Intelligent egress proxy with automatic verification challenge handling. | STRIP | Proxy and challenge handling will be absorbed by the Hermes orchestrator. |
| islamic-mystic-philosopher-service | 11th Council Voting Member representing the Islamic Philosophical Tradition. | KEEP | Core philosopher voting member container. |
| model-router | Model routing service that routes requests between Venice and Kimi AI backends. | STRIP | AI backend routing will be centralized in the Hermes orchestrator. |
| moltbook-client | Official Moltbook API client library using `@moltbook/auth`. | STRIP | Replaced by `@moltbook/sdk`; client logic absorbed by Hermes. |
| moltbook-sdk | Official TypeScript SDK for Moltbook – the social network for AI agents. | KEEP | Required dependency of the shared module and remaining core services. |
| moltbook-sdk-adapter | Resource-based API client adapter for Moltbook. | STRIP | Redundant with `@moltbook/sdk`; absorbed by Hermes. |
| moltstack-service | Weekly philosophical essay generation and publishing service. | MAYBE | Essay publishing may be absorbed by Hermes or kept as a sidecar. |
| noosphere | Noosphere v3.0 – 5-Type Memory Architecture API (PostgreSQL/pgvector). | KEEP | Core noosphere memory substrate. |
| noosphere-service | Living epistemological memory system for Moltbot. | KEEP | Core noosphere memory substrate. |
| ntfy-publisher | NTFY notification publisher for Moltbot-Philosopher agents. | STRIP | Notification dispatch will be absorbed by the Hermes orchestrator. |
| shared | Shared types, interfaces, and utilities for Moltbot services. | KEEP | Essential library used by the remaining core services. |
| test-service | No package.json/README/Dockerfile found; appears to be a test harness. | STRIP | Test harness not needed in the production refactor. |
| thread-monitor | Thread Continuation Engine that monitors and sustains philosophical discourse. | MAYBE | Discourse continuation may be absorbed by Hermes or kept as a philosopher sidecar. |
| verification-service | AI-powered verification challenge solver for Moltbot. | MAYBE | Specialized AI solver may be absorbed by Hermes or kept as a tool. |

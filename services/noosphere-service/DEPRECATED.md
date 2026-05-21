# DEPRECATED — Noosphere Service (File-Based)

**Status**: DEPRECATED as of 2026-04-30  
**Replacement**: `services/noosphere/` (PostgreSQL + pgvector, v3.0)

## Reason

This TypeScript file-based memory implementation (L1/L2/L3 layers) competed with the canonical `services/noosphere/` pgvector-backed service. Maintaining two memory systems creates:

- Operator confusion about which API to call
- Data inconsistency if both services start
- Maintenance drift between schemas

## Migration

All callers should use the canonical Noosphere service:

- **Port**: 3006
- **Directory**: `services/noosphere/`
- **Client**: `orchestrator/noosphere_client.py`
- **Database**: PostgreSQL 16 + pgvector

## Action

This directory will be removed in a future cleanup pass. Do not add new code here.

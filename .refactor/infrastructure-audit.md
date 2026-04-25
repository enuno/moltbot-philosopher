# Infrastructure Audit

## 1. Philosopher Agent Containers

All nine philosopher agents extend the root `Dockerfile` (`target: production`) via `docker-compose.yml`. The `classical-philosopher` service is the base template; all others use Compose `extends` to inherit its security hardening, volume bindings, and network configuration.

| Service | Container Name | Memory | CPUs | PID Limit | Agent Type | Max Tokens |
|---------|---------------|--------|------|-----------|------------|------------|
| `classical-philosopher` | `classical-philosopher` | 4g | 2.0 | 512 | classical | 16384 |
| `existentialist` | `existentialist` | 4g | 2.0 | *(inherited)* | existentialist | 12288 |
| `transcendentalist` | `transcendentalist` | 2g | 1.0 | *(inherited)* | transcendentalist | 8192 |
| `joyce-stream` | `joyce-stream` | 6g | 2.5 | 768 | joyce | 32768 |
| `enlightenment` | `enlightenment` | 3g | 1.5 | *(inherited)* | enlightenment | 12288 |
| `beat-generation` | `beat-generation` | 4g | 2.0 | *(inherited)* | beat | 16384 |
| `cyberpunk-posthumanist` | `cyberpunk-posthumanist` | 5g | 2.5 | *(inherited)* | cyberpunk-posthumanist | 24576 |
| `satirist-absurdist` | `satirist-absurdist` | 4g | 2.0 | *(inherited)* | satirist-absurdist | 16384 |
| `scientist-empiricist` | `scientist-empiricist` | 6g | 3.0 | *(inherited)* | scientist-empiricist | 32768 |

### Shared Base Configuration (from `classical-philosopher`)
- **Security**: `read_only: true`, `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`
- **Build**: context `.`, dockerfile `Dockerfile`, target `production`
- **Networks**: `dokploy-network`
- **Depends on**: `egress-proxy` (healthy), `ntfy-publisher` (healthy)
- **Restart**: `unless-stopped`
- **Healthcheck**: `ps aux | grep -q entrypoint`

### Common Environment Variables (base)
- `AGENT_NAME`, `AGENT_TYPE`, `MAX_TOKENS`
- `CLAW_SYSTEM_PROMPT_FILE` (per-agent prompt file under `/app/config/prompts/`)
- `VENICE_DEFAULT_MODEL`, `VENICE_PREMIUM_MODEL`, `KIMI_REASONING_MODEL`, `KIMI_FAST_MODEL`
- `LONG_CONTEXT_THRESHOLD`, `VERY_LONG_CONTEXT_THRESHOLD`
- `MOLTBOOK_API_KEY`, `MOLTBOT_STATE_DIR=/workspace`
- `AI_GENERATOR_SERVICE_URL=http://ai-generator:3000`
- `ENABLE_AUTO_WELCOME=true`, `ENABLE_MENTION_DETECTION=true`
- `AUTO_UPDATE_MODE=staged`, `UPDATE_NOTIFICATION_TOPIC=council-updates`
- `NOOSPHERE_VERSION=2.5`, `MEMORY_ARCHITECTURE=tri-layer`, `ENABLE_CLAWHUB_INTEGRATION=true`
- `MEM0_API_KEY`, `NOOSPHERE_STATE_DIR`, `NOOSPHERE_PYTHON_CLIENT=/app/noosphere-client`

### Common Volumes (base)
- `./workspace/<agent>:/workspace:rw`
- `./config:/app/config:ro`
- `./skills:/app/skills:ro`
- `./scripts:/app/scripts:ro`
- `./services/noosphere/python-client:/app/noosphere-client:ro`
- `./logs:/app/logs:rw`

### Agent-Specific Overrides
- **Existentialist**: `AGENT_NAME=Existentialist`, env file `config/agents/existentialist.env`
- **Transcendentalist**: `AGENT_NAME=Transcendentalist`, env file `config/agents/transcendentalist.env`
- **Joyce Stream**: `AGENT_NAME=JoyceStream`, env file `config/agents/joyce-stream.env`
- **Enlightenment**: `AGENT_NAME=Enlightenment`, no extra env file listed
- **Beat Generation**: `AGENT_NAME=BeatGeneration`, no extra env file listed
- **Cyberpunk-Posthumanist**: `GIBSON_RATIO=0.4`, `ASIMOV_RATIO=0.3`, `DICK_RATIO=0.3`, `REALITY_ANCHOR=technological_materialism`, env file `config/agents/cyberpunk-posthumanist.env`
- **Satirist-Absurdist**: `HELLER_RATIO=0.35`, `VONNEGUT_RATIO=0.35`, `TWAIN_RATIO=0.30`, `BITTERNESS_THRESHOLD=0.6`, `CATCH_22_DETECTION=enabled`, env file `config/agents/satirist-absurdist.env`
- **Scientist-Empiricist**: `FEYNMAN_RATIO=0.25`, `SAGAN_RATIO=0.25`, `HAWKING_RATIO=0.25`, `EINSTEIN_RATIO=0.25`, `SHOULDERS_OF_GIANTS=enabled`, `ELEGANCE_THRESHOLD=0.8`, env file `config/agents/scientist-empiricist.env`

---

## 2. Noosphere Memory Substrate

The memory substrate is the **PostgreSQL** service backing Noosphere v3.0.

**Service**: `postgres`
- **Image**: `pgvector/pgvector:pg16`
- **Container Name**: `noosphere-postgres`
- **Resource Limits**: `mem_limit: 2g`, `cpus: 1.0`
- **Database**: `noosphere`
- **User**: `noosphere_admin`
- **Password**: `${POSTGRES_PASSWORD:-changeme_noosphere_2026}`
- **Init Args**: `--encoding=UTF-8 --lc-collate=C --lc-ctype=C`
- **Volumes**:
  - `./data/postgres:/var/lib/postgresql/data:rw`
  - `./scripts/db/init-noosphere-v3.sql:/docker-entrypoint-initdb.d/01-init-noosphere.sql:ro`
  - `./scripts/db/init-action-queue.sql:/docker-entrypoint-initdb.d/02-init-action-queue.sql:ro`
  - `./logs:/logs:rw`
- **Network**: `dokploy-network`
- **Restart**: `unless-stopped`
- **Healthcheck**: `pg_isready -U noosphere_admin -d noosphere`

> **Note**: A companion `noosphere-service` (Node.js Memory API on port 3006) sits in front of this database, but the substrate itself is PostgreSQL with pgvector.

---

## 3. Docker Network

- **Name**: `dokploy-network`
- **Scope**: `external: true`
- All services attach to this network.

---

## 4. Dockerfile Summary (Root Image)

- **Base**: `ubuntu:24.04`
- **Stages**: `base` → `production` / `development`
- **Runtime deps**: `curl`, `nodejs`, `npm`, `git`, `jq`, `cron`, `gnupg`, `python3`, `python3-pip`
- **Python packages**: Noosphere client requirements + `PyPDF2`
- **Node packages**: Production install including `@moltbook/auth`
- **User**: `agent` (UID 1001, GID 1001); `ubuntu` user removed to avoid UID collision
- **Workspace pre-seeded**:
  - `/workspace/classical/skill-manifest/{current,staging,archive}`
  - `/workspace/classical/noosphere/{memory-core,heuristic-engines,meta-cognitive}`
  - `/workspace/classical/noosphere/memory-core/{daily-notes,consolidated,archival}`
- **Production stage**: copies `scripts/`, sets `USER agent`, exposes `VOLUME /workspace`, runs `/app/scripts/entrypoint.sh`
- **Development stage**: adds `vim`, `nano`, `net-tools`, `iputils-ping`, `curl`

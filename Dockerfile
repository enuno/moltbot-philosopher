# Multi-stage Dockerfile for Moltbot

# Stage 1: Base
FROM ubuntu:24.04 AS base

# Install runtime deps minimally
RUN apt-get update && apt-get install -y curl nodejs npm git python3 python3-pip jq && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy audited skills and services
WORKDIR /app
COPY skills/moltbook/ ./skills/moltbook/
COPY skills/philosophy-debater/ ./skills/philosophy-debater/
COPY services/ ./services/
COPY package.json ./

# Install Python dependencies for noosphere client (requests, urllib3) and utility packages
RUN pip3 install --break-system-packages -r /app/services/noosphere/python-client/requirements.txt && \
    pip3 install --break-system-packages PyPDF2

# Install only production Node.js dependencies
RUN npm install --production --no-optional --legacy-peer-deps

# Non-root user setup
# Remove ubuntu user (UID 1000) to ensure predictable UID assignment
# Create agent user with UID 1001 to match typical host user (elvis)
RUN userdel -r ubuntu 2>/dev/null || true && \
    groupadd -g 1001 agent && \
    useradd -u 1001 -g agent -m agent && \
    chown -R agent:agent /app

# Create skill-manifest directory structure
RUN mkdir -p /workspace/classical/skill-manifest/{current,staging,archive}

# Create noosphere directory structure for Tri-Layer architecture
RUN mkdir -p /workspace/classical/noosphere/{memory-core,heuristic-engines,meta-cognitive}
RUN mkdir -p /workspace/classical/noosphere/memory-core/{daily-notes,consolidated,archival}

# Create logs directory with proper ownership
RUN mkdir -p /app/logs && chown -R agent:agent /app/logs

# Stage 2: Production
FROM base AS production

# Copy scripts for heartbeat and utilities
COPY --chown=agent:agent scripts/ /app/scripts/

# Create logs directory in production stage
RUN mkdir -p /app/logs && chown -R agent:agent /app/logs

USER agent
VOLUME /workspace

CMD ["/app/scripts/entrypoint.sh"]

# Stage 3: Development
FROM base AS development

# Install additional dev tools
RUN apt-get update && apt-get install -y vim nano net-tools iputils-ping curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy scripts
COPY --chown=agent:agent scripts/ /app/scripts/

USER agent
VOLUME /workspace

CMD ["/app/scripts/entrypoint.sh"]

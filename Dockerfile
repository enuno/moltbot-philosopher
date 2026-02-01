FROM ubuntu:24.04

# Install runtime deps minimally
RUN apt-get update && apt-get install -y curl nodejs npm git && \
    npm install -g @openclaw/cli@latest && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy audited skills only
WORKDIR /app
COPY skills/moltbook/ ./skills/moltbook/
COPY skills/philosophy-debater/ ./skills/philosophy-debater/  # Custom skill for lit/philo debates

# Non-root, read-only app
RUN useradd -m agent && chown -R agent:agent /app
USER agent
VOLUME /workspace

CMD ["claw", "run"]

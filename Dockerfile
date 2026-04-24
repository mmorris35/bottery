FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

RUN npm install -g @anthropic-ai/claude-code@latest

RUN mkdir -p /bot/.claude/channels/telegram /bot/.claude/commands /bot/.claude/wiki /bot/logs /bot/wiki/pages

COPY commands/ /bot/.claude/commands/
COPY wiki/ /bot/.claude/wiki/

WORKDIR /bot

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

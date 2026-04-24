FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    ca-certificates \
    unzip \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

RUN useradd -m -s /bin/bash botuser

RUN mkdir -p /bot/.claude/channels/telegram /bot/.claude/commands /bot/.claude/wiki /bot/logs /bot/wiki/pages

COPY --chown=botuser:botuser commands/ /bot/.claude/commands/
COPY --chown=botuser:botuser wiki/ /bot/.claude/wiki/

WORKDIR /bot

COPY --chown=botuser:botuser entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN chown -R botuser:botuser /bot

USER botuser
ENV HOME=/home/botuser

RUN curl -fsSL https://claude.ai/install.sh | bash
ENV PATH="/home/botuser/.local/bin:$PATH"

ENTRYPOINT ["/entrypoint.sh"]

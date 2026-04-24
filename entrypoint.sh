#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"

: "${TELEGRAM_BOT_TOKEN:?TELEGRAM_BOT_TOKEN is required}"
: "${OWNER_CHAT_ID:?OWNER_CHAT_ID is required}"
: "${PERSONA_NAME:?PERSONA_NAME is required}"

CLAUDE_MODEL="${CLAUDE_MODEL:-claude-opus-4-6}"
GROUP_CHAT_ID="${GROUP_CHAT_ID:-}"
NELLIE_URL="${NELLIE_URL:-}"
BEERCAN_URL="${BEERCAN_URL:-}"
AUTH_MODE="${AUTH_MODE:-auto}"

mkdir -p /bot/.claude/channels/telegram /bot/logs /bot/wiki/pages

# --- Generate CLAUDE.md from persona + wiki system ---
# Persona can come from a mounted file or base64 env var (for Azure Container Apps)
if [[ -f /bot/persona.md ]]; then
  cat /bot/persona.md > /bot/CLAUDE.md
elif [[ -n "${PERSONA_CONTENT_B64:-}" ]]; then
  echo "$PERSONA_CONTENT_B64" | base64 -d > /bot/CLAUDE.md
fi

if [[ -f /bot/CLAUDE.md ]]; then
  # Strip old wiki section if present (replaced by enhanced system)
  sed -i '/^## Memory System (Karpathy LLM Wiki Pattern)/,/^## [^#]/{ /^## [^M]/!d; }' /bot/CLAUDE.md
  # Append enhanced wiki system
  printf '\n' >> /bot/CLAUDE.md
  cat /bot/.claude/wiki/wiki-system.md >> /bot/CLAUDE.md
fi

# --- Initialize wiki structure (first boot only) ---
if [[ ! -f /bot/wiki/purpose.md ]]; then
  sed "s/{{PERSONA_NAME}}/$PERSONA_NAME/g" /bot/.claude/wiki/purpose.md.template > /bot/wiki/purpose.md
fi

if [[ ! -f /bot/wiki/index.md ]]; then
  cat > /bot/wiki/index.md <<'WIKIINDEX'
# Wiki Index

Pages in this wiki, organized by category.

## User
<!-- Pages about the person you're talking to -->

## People
<!-- Pages about people the user mentions -->

## Projects
<!-- Pages about projects and initiatives -->

## Concepts
<!-- Pages about topics, technologies, methodologies -->

## Documents
<!-- Pages generated from ingested documents -->
WIKIINDEX
fi

if [[ ! -f /bot/wiki/sources.json ]]; then
  echo '{"sources":[]}' > /bot/wiki/sources.json
fi

if [[ ! -f /bot/wiki/log.md ]]; then
  echo "# Wiki Log" > /bot/wiki/log.md
  echo "" >> /bot/wiki/log.md
fi

# --- settings.json ---
MCP_BLOCK=""
MCP_PERMS=""

if [[ -n "$NELLIE_URL" ]]; then
  MCP_BLOCK="$MCP_BLOCK\"nellie\":{\"type\":\"sse\",\"url\":\"$NELLIE_URL\"},"
  MCP_PERMS="$MCP_PERMS\"mcp__nellie__*\","
fi

if [[ -n "$BEERCAN_URL" ]]; then
  MCP_BLOCK="$MCP_BLOCK\"beercan\":{\"type\":\"sse\",\"url\":\"$BEERCAN_URL\"},"
  MCP_PERMS="$MCP_PERMS\"mcp__beercan__*\","
fi

# Strip trailing comma from MCP block
MCP_BLOCK="${MCP_BLOCK%,}"

# Build allow list
EXTRA_PERMS=""
if [[ -n "$MCP_PERMS" ]]; then
  EXTRA_PERMS=",${MCP_PERMS%,}"
fi

node -e "
const s = {
  permissions: {
    allow: [
      'Edit','MultiEdit','Write(*)','Read','Bash(*)','Glob(*)','Grep(*)','Agent(*)',
      'mcp__plugin_telegram_telegram__*'${EXTRA_PERMS}
    ],
    deny: [
      'Read(//**/.env)','Read(//**/.env.*)','Read(//**/.env.local)',
      'Read(//**/.env.production)','Read(//**/credentials.json)',
      'Bash(reboot:*)','Bash(shutdown:*)','Bash(poweroff:*)'
    ],
    defaultMode: 'dontAsk'
  },
  enabledPlugins: {'telegram@claude-plugins-official': true},
  alwaysThinkingEnabled: true,
  effortLevel: 'max',
  fastMode: false,
  skipDangerousModePermissionPrompt: true,
  mcpServers: {${MCP_BLOCK}}
};
console.log(JSON.stringify(s, null, 2));
" > /bot/.claude/settings.json

# --- settings.local.json (disable cloud MCPs) ---
cat > /bot/.claude/settings.local.json <<'LOCALSET'
{
  "mcpServers": {
    "Context7": { "disabled": true },
    "Google Calendar": { "disabled": true },
    "Google Drive": { "disabled": true },
    "Cloudflare Developer Platform": { "disabled": true },
    "Netlify": { "disabled": true }
  }
}
LOCALSET

# --- .mcp.json (project-level MCP, optional) ---
if [[ -n "$NELLIE_URL" || -n "$BEERCAN_URL" ]]; then
  MCP_PROJECT=""
  if [[ -n "$BEERCAN_URL" ]]; then
    MCP_PROJECT="$MCP_PROJECT\"beercan\":{\"type\":\"sse\",\"url\":\"$BEERCAN_URL\"},"
  fi
  MCP_PROJECT="${MCP_PROJECT%,}"
  cat > /bot/.mcp.json <<MCP
{
  "mcpServers": {
    ${MCP_PROJECT}
  }
}
MCP
fi

# --- access.json ---
ALLOW_FROM="[{\"id\":\"$OWNER_CHAT_ID\",\"name\":\"owner\"}]"

GROUP_BLOCK=""
if [[ -n "$GROUP_CHAT_ID" ]]; then
  MENTION_PATTERN=$(echo "$PERSONA_NAME" | tr '[:upper:]' '[:lower:]')
  GROUP_BLOCK=",\"groups\":{\"allowFrom\":[{\"id\":\"$GROUP_CHAT_ID\",\"name\":\"group\"}],\"mentionPatterns\":[\"$MENTION_PATTERN\",\"@$MENTION_PATTERN\"]}"
fi

cat > /bot/.claude/channels/telegram/access.json <<ACCESS
{
  "directMessages": {
    "allowFrom": $ALLOW_FROM
  }${GROUP_BLOCK}
}
ACCESS

# --- model.env ---
cat > /bot/.claude/channels/telegram/model.env <<MODELENV
CLAUDE_MODEL=$CLAUDE_MODEL
MODELENV

# --- Telegram channel .env (plugin reads token from here) ---
cat > /bot/.claude/channels/telegram/.env <<TGENV
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
TGENV

# --- Session resume support ---
SESSION_FILE="/bot/logs/session-id"

SESSION_ARGS=""
if [[ -f "$SESSION_FILE" ]]; then
  SESSION_ID=$(cat "$SESSION_FILE")
  SESSION_ARGS="--resume $SESSION_ID"
  echo "Resuming session: $SESSION_ID"
fi

WIKI_PAGES=$(find /bot/wiki/pages -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
echo "=== Bottery: Starting $PERSONA_NAME ==="
echo "  Model:    $CLAUDE_MODEL"
echo "  Owner:    $OWNER_CHAT_ID"
echo "  Group:    ${GROUP_CHAT_ID:-none}"
echo "  Nellie:   ${NELLIE_URL:-disabled}"
echo "  Beer Can: ${BEERCAN_URL:-disabled}"
echo "  Wiki:     $WIKI_PAGES pages"
echo "==========================================="

export TELEGRAM_BOT_TOKEN

# --- User-level config (skip onboarding) ---
mkdir -p "$HOME/.claude"
cat > "$HOME/.claude.json" <<'DOTCLAUDE'
{
  "numStartups": 1,
  "hasCompletedOnboarding": true,
  "lastOnboardingVersion": "2.1.119",
  "installMethod": "native",
  "autoUpdates": false,
  "projects": {
    "/bot": {
      "allowedTools": [],
      "hasTrustDialogAccepted": true,
      "hasCompletedProjectOnboarding": true,
      "projectOnboardingSeenCount": 1
    }
  }
}
DOTCLAUDE

cat > "$HOME/.claude/settings.json" <<'USERSET'
{
  "skipDangerousModePermissionPrompt": true
}
USERSET

# --- Authentication ---
# Two modes: API key (ANTHROPIC_API_KEY set) or Claude Max/Team (claude auth login)
if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
  export ANTHROPIC_API_KEY
  echo "  Auth:     API key"
elif [[ "$AUTH_MODE" == "login" ]]; then
  if [[ -n "${CREDENTIALS_B64:-}" ]]; then
    mkdir -p "$HOME/.claude"
    echo "$CREDENTIALS_B64" | base64 -d > "$HOME/.claude/.credentials.json"
    echo "  Auth:     Credentials restored from env"
  elif claude auth status &>/dev/null; then
    echo "  Auth:     Already logged in"
  else
    echo "  Auth:     Starting interactive login..."
    claude auth login 2>&1
  fi
  echo "  Auth:     Claude Max/Team (logged in)"
fi

# --- Install Telegram plugin (must run after auth, doesn't persist across restarts) ---
echo "  Plugin:   Installing telegram..."
timeout 30 claude plugin install telegram@claude-plugins-official 2>&1 && echo "  Plugin:   telegram installed" || echo "  Plugin:   WARNING - telegram install failed (continuing anyway)"

# Use claude46 wrapper if available, fall back to claude
if command -v claude46 &>/dev/null; then
  CLAUDE_CMD="claude46"
else
  CLAUDE_CMD="claude --model $CLAUDE_MODEL --dangerously-skip-permissions"
fi

exec script -q /bot/logs/$PERSONA_NAME.log -c "$CLAUDE_CMD \
  --channels plugin:telegram@claude-plugins-official \
  $SESSION_ARGS"

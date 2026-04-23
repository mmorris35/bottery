#!/usr/bin/env bash
set -euo pipefail

: "${TELEGRAM_BOT_TOKEN:?TELEGRAM_BOT_TOKEN is required}"
: "${OWNER_CHAT_ID:?OWNER_CHAT_ID is required}"
: "${PERSONA_NAME:?PERSONA_NAME is required}"

CLAUDE_MODEL="${CLAUDE_MODEL:-claude-opus-4-6}"
GROUP_CHAT_ID="${GROUP_CHAT_ID:-}"
NELLIE_URL="${NELLIE_URL:-}"
BEERCAN_URL="${BEERCAN_URL:-}"

mkdir -p /bot/.claude/channels/telegram /bot/logs

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

cat > /bot/.claude/settings.json <<SETTINGS
{
  "permissions": {
    "allow": [
      "Edit",
      "MultiEdit",
      "Write(*)",
      "Read",
      "Bash(*)",
      "Glob(*)",
      "Grep(*)",
      "Agent(*)",
      "mcp__plugin_telegram_telegram__*",
      ${MCP_PERMS}"__sentinel__"
    ],
    "deny": [
      "Read(//**/.env)",
      "Read(//**/.env.*)",
      "Read(//**/.env.local)",
      "Read(//**/.env.production)",
      "Read(//**/credentials.json)",
      "Bash(reboot:*)",
      "Bash(shutdown:*)",
      "Bash(poweroff:*)"
    ],
    "defaultMode": "dontAsk"
  },
  "enabledPlugins": {
    "telegram@claude-plugins-official": true
  },
  "alwaysThinkingEnabled": true,
  "effortLevel": "max",
  "fastMode": false,
  "skipDangerousModePermissionPrompt": true,
  "mcpServers": {
    ${MCP_BLOCK}
  }
}
SETTINGS

# Remove the sentinel from allow list
sed -i 's/,"__sentinel__"//g; s/"__sentinel__"//g' /bot/.claude/settings.json

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

# --- Session resume support ---
SESSION_FILE="/bot/logs/session-id"

SESSION_ARGS=""
if [[ -f "$SESSION_FILE" ]]; then
  SESSION_ID=$(cat "$SESSION_FILE")
  SESSION_ARGS="--resume $SESSION_ID"
  echo "Resuming session: $SESSION_ID"
fi

echo "=== Bottery: Starting $PERSONA_NAME ==="
echo "  Model:    $CLAUDE_MODEL"
echo "  Owner:    $OWNER_CHAT_ID"
echo "  Group:    ${GROUP_CHAT_ID:-none}"
echo "  Nellie:   ${NELLIE_URL:-disabled}"
echo "  Beer Can: ${BEERCAN_URL:-disabled}"
echo "==========================================="

export TELEGRAM_BOT_TOKEN
export ANTHROPIC_API_KEY

exec script -q /dev/null -c "claude \
  --dangerously-skip-permissions \
  --channels plugin:telegram \
  $SESSION_ARGS \
  2>&1 | tee /bot/logs/$PERSONA_NAME.log"

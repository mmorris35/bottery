#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_NAME="bottery"

usage() {
  cat <<EOF
Usage: $0 <PERSONA> <BOT_TOKEN> <OWNER_CHAT_ID> [options]

Deploy a Claude Code Telegram bot as a container.

Arguments:
  PERSONA          Persona name (matches personas/<NAME>.md)
  BOT_TOKEN        Telegram bot token from @BotFather
  OWNER_CHAT_ID    Telegram chat ID of the bot owner

Options:
  --group ID       Group chat ID to join
  --nellie URL     Nellie SSE endpoint URL
  --beercan URL    Beer Can SSE endpoint URL
  --model MODEL    Claude model (default: claude-opus-4-6)
  --name NAME      Container name (default: bottery-<persona>)
  --rebuild        Force rebuild of Docker image
  --runtime RT     Container runtime: docker or orbstack (auto-detected)
  -h, --help       Show this help

Examples:
  # Minimal — pure persona bot
  $0 OPRAH <bot_token> <owner_chat_id>

  # With MCP servers and a group chat
  $0 NAGATHA <bot_token> <owner_chat_id> \\
    --group -5143923460 \\
    --nellie http://100.114.129.95:8765/sse \\
    --beercan http://100.114.129.95:9100/sse

Environment:
  ANTHROPIC_API_KEY    Required. Your Anthropic API key.
EOF
  exit 0
}

# --- Argument parsing ---

[[ $# -lt 3 ]] && { echo "Error: requires PERSONA, BOT_TOKEN, and OWNER_CHAT_ID"; usage; }

PERSONA="$1"; shift
BOT_TOKEN="$1"; shift
OWNER_CHAT_ID="$1"; shift

GROUP_CHAT_ID=""
NELLIE_URL=""
BEERCAN_URL=""
CLAUDE_MODEL="claude-opus-4-6"
CONTAINER_NAME=""
REBUILD=false
RUNTIME=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --group)     GROUP_CHAT_ID="$2"; shift 2 ;;
    --nellie)    NELLIE_URL="$2"; shift 2 ;;
    --beercan)   BEERCAN_URL="$2"; shift 2 ;;
    --model)     CLAUDE_MODEL="$2"; shift 2 ;;
    --name)      CONTAINER_NAME="$2"; shift 2 ;;
    --rebuild)   REBUILD=true; shift ;;
    --runtime)   RUNTIME="$2"; shift 2 ;;
    -h|--help)   usage ;;
    *)           echo "Unknown option: $1"; usage ;;
  esac
done

# --- Validate ---

: "${ANTHROPIC_API_KEY:?Set ANTHROPIC_API_KEY before running deploy.sh}"

PERSONA_UPPER=$(echo "$PERSONA" | tr '[:lower:]' '[:upper:]')
PERSONA_LOWER=$(echo "$PERSONA" | tr '[:upper:]' '[:lower:]')
PERSONA_FILE="$SCRIPT_DIR/personas/${PERSONA_UPPER}.md"

if [[ ! -f "$PERSONA_FILE" ]]; then
  echo "Error: persona file not found: $PERSONA_FILE"
  echo "Available personas:"
  ls "$SCRIPT_DIR/personas/"*.md 2>/dev/null | xargs -I{} basename {} .md || echo "  (none)"
  exit 1
fi

CONTAINER_NAME="${CONTAINER_NAME:-bottery-${PERSONA_LOWER}}"
VOLUME_NAME="botdata-${PERSONA_LOWER}"

# --- Detect runtime ---

if [[ -z "$RUNTIME" ]]; then
  if command -v orbctl &>/dev/null; then
    RUNTIME="orbstack"
  else
    RUNTIME="docker"
  fi
fi

case "$RUNTIME" in
  docker|orbstack) ;;
  *) echo "Error: unsupported runtime '$RUNTIME' (use docker or orbstack)"; exit 1 ;;
esac

DOCKER_CMD="docker"
echo "Runtime: $RUNTIME"

# --- Build image ---

if $REBUILD || ! $DOCKER_CMD image inspect "$IMAGE_NAME" &>/dev/null; then
  echo "Building $IMAGE_NAME image..."
  $DOCKER_CMD build -t "$IMAGE_NAME" "$SCRIPT_DIR"
else
  echo "Image $IMAGE_NAME exists (use --rebuild to force)"
fi

# --- Stop existing container ---

if $DOCKER_CMD container inspect "$CONTAINER_NAME" &>/dev/null; then
  echo "Stopping existing container: $CONTAINER_NAME"
  $DOCKER_CMD stop "$CONTAINER_NAME" 2>/dev/null || true
  $DOCKER_CMD rm "$CONTAINER_NAME" 2>/dev/null || true
fi

# --- Create volume ---

$DOCKER_CMD volume create "$VOLUME_NAME" &>/dev/null || true

# --- Run ---

ENV_ARGS=(
  -e "TELEGRAM_BOT_TOKEN=$BOT_TOKEN"
  -e "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY"
  -e "OWNER_CHAT_ID=$OWNER_CHAT_ID"
  -e "PERSONA_NAME=$PERSONA_UPPER"
  -e "CLAUDE_MODEL=$CLAUDE_MODEL"
)

[[ -n "$GROUP_CHAT_ID" ]] && ENV_ARGS+=(-e "GROUP_CHAT_ID=$GROUP_CHAT_ID")
[[ -n "$NELLIE_URL" ]]    && ENV_ARGS+=(-e "NELLIE_URL=$NELLIE_URL")
[[ -n "$BEERCAN_URL" ]]   && ENV_ARGS+=(-e "BEERCAN_URL=$BEERCAN_URL")

echo "Deploying $PERSONA_UPPER as $CONTAINER_NAME..."

$DOCKER_CMD run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -v "$VOLUME_NAME:/bot/logs" \
  -v "$PERSONA_FILE:/bot/persona.md:ro" \
  -v "${VOLUME_NAME}-wiki:/bot/wiki" \
  "${ENV_ARGS[@]}" \
  "$IMAGE_NAME"

echo ""
echo "=== $PERSONA_UPPER deployed ==="
echo "  Container: $CONTAINER_NAME"
echo "  Logs vol:  $VOLUME_NAME"
echo "  Wiki vol:  ${VOLUME_NAME}-wiki"
echo "  Logs:      docker logs -f $CONTAINER_NAME"
echo ""

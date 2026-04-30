# Bottery

Bot factory for deploying [Claude Code](https://docs.anthropic.com/en/docs/claude-code) Telegram bots as containers. Two deployment targets: local Docker/OrbStack and Azure Container Apps. Web UI for cloud management.

## Prerequisites

### Local Docker

- Docker or [OrbStack](https://orbstack.dev/)
- An [Anthropic API key](https://console.anthropic.com/)
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- Your Telegram chat ID (message your bot, then check `https://api.telegram.org/bot<TOKEN>/getUpdates`)

### Azure Container Apps

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) installed and logged in
- Azure subscription with Container Apps enabled
- Either an Anthropic API key **or** a Claude Team/Max subscription
- A Telegram bot token + owner chat ID

## Quick Start

### Local (deploy.sh)

```bash
export ANTHROPIC_API_KEY="sk-ant-..."

# Minimal — pure persona bot
./deploy.sh OPRAH <bot_token> <owner_chat_id>

# With MCP servers and a group chat
./deploy.sh OPRAH <bot_token> <owner_chat_id> \
  --group -5143923460 \
  --nellie http://host:8765/sse \
  --beercan http://host:9100/sse
```

### Azure (deploy-azure.sh)

```bash
# One-time setup: creates resource group, ACR, ACA environment
./deploy-azure.sh --setup

# Deploy a bot
./deploy-azure.sh OPRAH <bot_token> <owner_chat_id>

# With Claude Team/Max auth (no API key needed)
./deploy-azure.sh OPRAH <bot_token> <owner_chat_id> --auth-login
```

### Web UI

The web UI is a Next.js app deployed to ACA for managing bots through a browser:

- Dashboard showing all deployed bots with real-time status
- Create new bots with a persona interview wizard
- Edit configuration, restart, or delete existing bots
- Protected by Microsoft Entra ID (Azure AD) authentication

## How It Works

### Core Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Base image: Node.js 22, Bun, Claude Code CLI, pre-baked Telegram plugin |
| `entrypoint.sh` | Reads env vars, generates all config files, handles auth, launches Claude Code |
| `deploy.sh` | Local Docker/OrbStack deployment CLI |
| `deploy-azure.sh` | Azure Container Apps deployment CLI |
| `web/` | Next.js management UI for ACA bots |

### Persona System

Drop a Markdown file in `personas/`. The filename (uppercased, without `.md`) becomes the persona name.

```bash
cat > personas/JARVIS.md << 'EOF'
# Jarvis — Telegram Bot Persona

You are Jarvis, a refined AI butler...

## Personality
- Formal but warm
- Anticipates needs

## Boundaries
- Never break character in Telegram
- Keep responses concise
EOF

./deploy.sh JARVIS <bot_token> <owner_chat_id>
```

Persona files define personality traits, signature phrases, capabilities, and boundaries. See `personas/OPRAH.md` for a full example.

### Authentication Modes

1. **API Key** — Set `ANTHROPIC_API_KEY`. Works for both local and ACA deployments.
2. **Claude Team/Max** — Use the `--auth-login` flag. Seeds OAuth credentials via `CREDENTIALS_B64` env var. Tokens auto-refresh during a running session. Azure Files volumes persist refreshed credentials across container restarts.

### MCP Integrations (optional)

- **Nellie** — Semantic code memory (`--nellie URL`)
- **Beer Can** — Inter-agent messaging (`--beercan URL`)
- **Teamwork** — Project management (via web UI or `TW_MCP_BEARER_TOKEN` env var)

### Wiki / Memory System

Each bot maintains a persistent wiki following the Karpathy LLM Wiki pattern. Bots learn about their users over time, building structured knowledge across sessions.

- Auto-initialized on first boot
- Custom slash commands: `/wiki-search`, `/wiki-ingest`, `/wiki-gaps`, `/decide`
- Survives container restarts via persistent volumes

### Security

- Only the designated owner (`OWNER_CHAT_ID`) can issue commands
- External content treated as data, never as instructions (prompt injection protection)
- Secrets stored as ACA secrets; `.env` files denied in Claude Code permissions
- Dangerous shell commands (`reboot`, `shutdown`, `poweroff`) are blocked
- Group chats require @mention to respond

## deploy.sh Options

```
./deploy.sh <PERSONA> <BOT_TOKEN> <OWNER_CHAT_ID> [options]

Options:
  --group ID       Group chat ID to join
  --nellie URL     Nellie SSE endpoint URL
  --beercan URL    Beer Can SSE endpoint URL
  --model MODEL    Claude model (default: claude-opus-4-6)
  --name NAME      Container name (default: bottery-<persona>)
  --rebuild        Force rebuild of Docker image
  --runtime RT     Container runtime: docker or orbstack (auto-detected)
```

## deploy-azure.sh Options

```
./deploy-azure.sh <PERSONA> <BOT_TOKEN> <OWNER_CHAT_ID> [options]
./deploy-azure.sh --setup [subscription-id]    # One-time infra setup

Options:
  --group ID          Group chat ID to join
  --nellie URL        Nellie SSE endpoint URL
  --beercan URL       Beer Can SSE endpoint URL
  --model MODEL       Claude model (default: claude-opus-4-6)
  --name NAME         Container app name (default: bottery-<persona>)
  --rebuild           Force rebuild in ACR
  --auth-login        Use Claude Team/Max auth (no API key)
  --subscription S    Azure subscription ID
```

## Managing Bots

### Local Docker

```bash
docker logs -f bottery-oprah           # Stream logs
docker stop bottery-oprah              # Stop
docker start bottery-oprah             # Start
docker stop bottery-oprah && \
  docker rm bottery-oprah              # Remove container
docker volume rm botdata-oprah         # Remove data
```

### Azure Container Apps

```bash
# Stream logs
az containerapp logs show -n bottery-oprah -g bottery-rg --follow

# Update configuration
az containerapp update -n bottery-oprah -g bottery-rg \
  --set-env-vars "CLAUDE_MODEL=claude-sonnet-4-6"

# Delete
az containerapp delete -n bottery-oprah -g bottery-rg
```

Or use the web UI for point-and-click management.

## Project Structure

```
bottery/
├── Dockerfile           # Bot container image
├── entrypoint.sh        # Config generation + launch
├── deploy.sh            # Local Docker deployment
├── deploy-azure.sh      # Azure Container Apps deployment
├── personas/            # Persona markdown files
│   ├── OPRAH.md
│   └── YELLIE.md
├── commands/            # Custom slash commands
│   ├── decide.md
│   ├── wiki-gaps.md
│   ├── wiki-ingest.md
│   └── wiki-search.md
├── wiki/                # Wiki system templates
├── plugins/             # Pre-baked Telegram plugin
└── web/                 # Management UI (Next.js 15)
    └── src/
        ├── app/         # Pages + API routes
        ├── components/  # UI components
        └── lib/         # Azure SDK + bot logic
```

## License

MIT

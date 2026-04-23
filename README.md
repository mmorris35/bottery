# Bottery

Bot factory: one-command Telegram bot deployment via containers.

Bottery deploys [Claude Code](https://docs.anthropic.com/en/docs/claude-code) Telegram bots as Docker/OrbStack containers. One command, one bot. Persona in, running bot out.

## Prerequisites

- Docker or [OrbStack](https://orbstack.dev/)
- An [Anthropic API key](https://console.anthropic.com/)
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- Your Telegram chat ID (message your bot, then check `https://api.telegram.org/bot<TOKEN>/getUpdates`)

## Quick Start

```bash
export ANTHROPIC_API_KEY="sk-ant-..."

# Minimal — pure persona bot, no MCP
./deploy.sh OPRAH <bot_token> <owner_chat_id>

# With optional MCP servers and a group chat
./deploy.sh NAGATHA <bot_token> <owner_chat_id> \
  --group -5143923460 \
  --nellie http://100.114.129.95:8765/sse \
  --beercan http://100.114.129.95:9100/sse
```

## How It Works

```
deploy.sh → builds Docker image → injects persona + config → launches Claude Code with Telegram plugin
```

Three files do all the work:

| File | Purpose |
|------|---------|
| `Dockerfile` | Base image with Node.js, Bun, and Claude Code CLI |
| `entrypoint.sh` | Reads env vars, writes config files, starts Claude Code |
| `deploy.sh` | CLI wrapper — parses args, builds image, runs container |

## Creating a Persona

Drop a Markdown file in `personas/`. The filename (uppercased, without `.md`) becomes the persona name.

```bash
# Create your persona
cat > personas/JARVIS.md << 'EOF'
# Jarvis — Telegram Bot Persona

You are Jarvis, a refined AI butler...
EOF

# Deploy it
./deploy.sh JARVIS <bot_token> <owner_chat_id>
```

See `personas/OPRAH.md` for a full example.

## Options

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

## Architecture

- Each bot runs in its own container with a persistent data volume
- The persona CLAUDE.md is mounted read-only — edit the file and restart to update
- MCP servers (Nellie, Beer Can) are optional — omit the flags and they won't be configured
- Claude Code gets a PTY via `script -q /dev/null` (required for CC to function)
- Cloud MCPs (Context7, Google Calendar, etc.) are disabled by default
- Containers restart automatically (`unless-stopped` policy)

## Managing Bots

```bash
# View logs
docker logs -f bottery-oprah

# Stop a bot
docker stop bottery-oprah

# Restart a bot
docker start bottery-oprah

# Remove a bot and its data
docker stop bottery-oprah && docker rm bottery-oprah
docker volume rm botdata-oprah
```

## License

MIT

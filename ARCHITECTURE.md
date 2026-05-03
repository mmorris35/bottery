# Bottery v2 Architecture

Bottery v2 deploys Claude Code agents as systemd services on Ubuntu VMs. Each OS user is an auth boundary with one supervisor agent and N project/repo agents.

## Agent Hierarchy

```mermaid
graph TB
    subgraph "Ubuntu VM (e.g. vm-bottery-0)"
        subgraph "OS User: mike"
            direction TB
            US1["~/.claude/settings.json<br/><b>USER SCOPE</b><br/>Shared auth · Nellie MCP · Beer Can MCP<br/>Base skills + permissions"]

            LT1["~/.claude/agents/lieutenant.md<br/><b>SUPERVISOR — PID 1</b><br/>Routes Beer Can tasks · Spawns/kills agents<br/>Purpose drift checks · Status aggregation"]

            subgraph "Project Agents"
                direction LR
                PA1["~/github/repo-a/<br/>CLAUDE.md · .claude/settings.json<br/>Agent-specific MCP + permissions<br/>memory/"]
                PA2["~/github/repo-b/<br/>CLAUDE.md · .claude/settings.json<br/>Agent-specific MCP + permissions<br/>memory/"]
                PA3["~/bots/goofy/<br/>CLAUDE.md (persona)<br/>Telegram channel bot"]
            end

            US1 --- LT1
            LT1 -->|manages| PA1
            LT1 -->|manages| PA2
            LT1 -->|manages| PA3
        end

        subgraph "OS User: danielle.guerra"
            direction TB
            US2["~/.claude/settings.json<br/><b>USER SCOPE</b>"]
            LT2["SUPERVISOR"]
            PA4["~/bots/yellie/<br/>Telegram persona bot"]

            US2 --- LT2
            LT2 -->|manages| PA4
        end

        subgraph "OS User: shane.scott"
            direction TB
            US3["~/.claude/settings.json<br/><b>USER SCOPE</b>"]
            LT3["SUPERVISOR"]
            PA5["~/bots/scrogie/<br/>Telegram persona bot"]

            US3 --- LT3
            LT3 -->|manages| PA5
        end
    end

    style US1 fill:#1a1a2e,color:#e0e0e0
    style US2 fill:#1a1a2e,color:#e0e0e0
    style US3 fill:#1a1a2e,color:#e0e0e0
    style LT1 fill:#16213e,color:#e0e0e0
    style LT2 fill:#16213e,color:#e0e0e0
    style LT3 fill:#16213e,color:#e0e0e0
```

### Scope Boundaries

| Scope | What lives here | Shared across |
|-------|----------------|---------------|
| **User** (`~/.claude/settings.json`) | OAuth creds, Nellie MCP, Beer Can MCP, base permissions | All agents under this OS user |
| **Supervisor** (`~/.claude/agents/lieutenant.md`) | Fleet management, task routing, drift checks | Sees all projects under this user |
| **Project** (`~/github/repo/.claude/settings.json`) | Agent persona, domain-specific MCP, repo-specific permissions, local memory | Only this agent |

Claude Code's native settings hierarchy IS the isolation layer — no containers needed.

## Deployment Architecture

```mermaid
graph TB
    subgraph "VM: vm-bottery-0"
        subgraph "systemd"
            S1["bot-goofy.service<br/>User=mike"]
            S2["bot-yellie.service<br/>User=danielle.guerra"]
            S3["bot-scrogie.service<br/>User=shane.scott"]
        end

        subgraph "Per-service process tree"
            direction LR
            P1["script (PTY)"] --> P2["claude<br/>--channels --model"]
            P2 --> P3["bun server.ts<br/>(Telegram MCP)"]
        end

        S1 --> P1
    end

    subgraph "External Services"
        TG["Telegram Bot API"]
        CLAUDE["Anthropic API<br/>(Claude Max / Team)"]
        NELLIE["Nellie MCP<br/>(Semantic memory)"]
        BC["Beer Can MCP<br/>(Agent IPC)"]
    end

    P3 <-->|Bot API| TG
    P2 <-->|OAuth| CLAUDE
    P2 -.->|SSE| NELLIE
    P2 -.->|HTTP| BC
```

### Process Tree (per bot)

Each systemd service runs four processes:

```
systemd
 └── start.sh
      └── script -q -c "claude ..." session.log    # PTY wrapper (required)
           └── claude --channels plugin:telegram     # Claude Code
                └── bun server.ts                    # Telegram MCP server (plugin-managed)
```

`script` provides a PTY — without it, CC enters `--print` mode and fails. The plugin manages its own bun process; never configure a manual `telegram` MCP server.

## Auth & Model Pinning

```mermaid
graph LR
    subgraph "Auth (per OS user)"
        OAUTH["claude auth login<br/>(one-time)"] --> CREDS["~/.claude/.credentials.json<br/>OAuth tokens auto-refresh"]
    end

    subgraph "Model Quad-Lock (per bot)"
        ML1["--model flag<br/>in start.sh"]
        ML2["settings.json<br/>model field"]
        ML3["model.env<br/>CLAUDE_MODEL"]
        ML4["settings.json<br/>autoMode: off"]
    end

    ML1 & ML2 & ML3 & ML4 -->|all must agree| PINNED["Model stays pinned<br/>No carousel downgrade"]
```

**Why quad-lock?** Without `autoMode: off`, CC's carousel silently downgrades the model (e.g. Opus → Haiku) when capacity is constrained.

**Allowed models:** claude-haiku-4-5-20251001, claude-sonnet-4-6, claude-opus-4-6. **Never** claude-opus-4-7.

## File Layout

```
/etc/claude-code/
  managed-settings.json              # {"channelsEnabled": true} (system-wide)

/home/USERNAME/
  .local/bin/claude                  # CC binary
  .bun/bin/bun                       # Bun runtime
  .claude/
    .credentials.json                # OAuth creds (from claude auth login)
    settings.json                    # User scope: skip prompts, shared MCP
    agents/
      lieutenant.md                  # Supervisor agent definition
    plugins/
      installed_plugins.json         # Plugin registry
      known_marketplaces.json        # Must point at THIS user's path
      cache/.../telegram/0.0.6/      # Plugin code
      marketplaces/.../              # Marketplace checkout
    channels/telegram/
      .env                           # TELEGRAM_BOT_TOKEN=...
      access.json                    # dmPolicy + allowlist
      model.env                      # CLAUDE_MODEL=...
  .claude.json                       # Onboarding state + project trust entries
  github/
    repo-a/                          # Repo agent working directory
      .claude/settings.json          # Project scope: agent-specific config
      CLAUDE.md                      # Agent purpose + persona
      memory/                        # Karpathy+ deep memory
  bots/
    botname/                         # Telegram persona bot
      CLAUDE.md                      # Persona
      start.sh                       # Launcher (script + claude)
      .mcp.json                      # Empty: {"mcpServers":{}}
      .git/                          # Required for CC project recognition
      .claude/settings.json          # Model, permissions, enabledPlugins, autoMode
      logs/
        debug.log                    # CC debug output
        session.log                  # PTY session capture

/etc/systemd/system/
  bot-BOTNAME.service                # systemd unit per bot
```

## Message Flow

```mermaid
sequenceDiagram
    participant User as Telegram User
    participant TG as Telegram API
    participant Plugin as Telegram Plugin<br/>(bun MCP server)
    participant CC as Claude Code
    participant Tools as Tools<br/>(Bash, Read, Write, MCP)

    User->>TG: Send message
    TG->>Plugin: Long-poll getUpdates
    Plugin->>Plugin: Check access.json<br/>(dmPolicy: allowlist)

    alt Authorized sender
        Plugin->>CC: Channel notification
        CC->>CC: Read CLAUDE.md (persona)

        opt Task execution
            CC->>Tools: Bash, Read, Write, MCP
            Tools-->>CC: Results
        end

        CC->>Plugin: Reply tool call
        Plugin->>TG: sendMessage
        TG->>User: Bot response
    else Unknown sender
        Plugin->>Plugin: Reject (allowlist mode)
    end
```

## Supervisor Pattern (Lieutenant)

```mermaid
graph TB
    subgraph "User Scope"
        BC_IN["Beer Can<br/>(inbound tasks)"] --> LT["Lieutenant<br/>(Supervisor Agent)"]

        LT -->|spawn/route| A1["Repo Agent A<br/>(project scope)"]
        LT -->|spawn/route| A2["Repo Agent B<br/>(project scope)"]
        LT -->|spawn/route| A3["Telegram Bot<br/>(project scope)"]

        LT -->|drift check| A1
        LT -->|drift check| A2
        LT -->|drift check| A3

        A1 -->|status| LT
        A2 -->|status| LT
        A3 -->|status| LT

        LT -->|aggregate| STATUS["Status Dashboard<br/>via Beer Can / Telegram"]
    end

    NELLIE["Nellie<br/>(shared semantic memory)"] -.-> A1
    NELLIE -.-> A2
    NELLIE -.-> A3
    NELLIE -.-> LT
```

The lieutenant runs at user scope with visibility across all projects. It:
- **Routes** incoming Beer Can tasks to the correct project agent
- **Spawns/monitors/kills** project agents as needed
- **Checks purpose drift** — ensures agents stay on-task
- **Aggregates status** for the human operator

## VM Hardening

| Layer | Implementation |
|-------|---------------|
| Firewall | UFW — deny all incoming, allow SSH only |
| Brute force | fail2ban on SSH |
| SSH | Key-only auth, no root login, max 3 attempts |
| Patching | unattended-upgrades with auto-reboot at 04:00 UTC |
| Network | NSG locks SSH to admin WAN IP |
| Isolation | OS users — filesystem + process isolation between employees |
| Bot services | systemd Restart=always, RestartSec=10 — self-healing |

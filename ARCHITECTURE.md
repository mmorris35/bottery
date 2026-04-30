# Bottery Architecture

Bottery is a bot factory that deploys Claude Code Telegram bots as containers. It supports two deployment targets — local Docker/OrbStack and Azure Container Apps — with an optional web UI for cloud management.

## High-Level Architecture

```mermaid
graph TB
    subgraph "Deployment Targets"
        direction TB
        subgraph "Local Docker / OrbStack"
            DS[deploy.sh] --> DI[Docker Image]
            DI --> DC[Bot Container]
            DC --- DV[(Volumes:<br/>logs + wiki)]
        end
        subgraph "Azure Container Apps"
            DA[deploy-azure.sh] --> ACR[Azure Container<br/>Registry]
            WEB[Web UI<br/>Next.js 15] --> ACA_API[Azure SDK]
            ACR --> ACA[ACA Environment<br/>bottery-env]
            ACA_API --> ACA
            ACA --- AFS[(Azure Files<br/>Credential Store)]
        end
    end

    subgraph "External Services"
        TG[Telegram Bot API]
        CLAUDE[Anthropic API /<br/>Claude Team]
        MCP_N[Nellie MCP]
        MCP_B[Beer Can MCP]
        MCP_TW[Teamwork MCP]
    end

    DC <--> TG
    DC <--> CLAUDE
    ACA <--> TG
    ACA <--> CLAUDE
    DC -.-> MCP_N
    DC -.-> MCP_B
    ACA -.-> MCP_TW

    ENTRA[Microsoft Entra ID] --> WEB
```

## Container Internals

Every bot — local or cloud — runs the same Docker image. The entrypoint generates all configuration at startup from environment variables.

```mermaid
graph TD
    EP[entrypoint.sh] --> V{Validate env vars}
    V -->|TELEGRAM_BOT_TOKEN<br/>OWNER_CHAT_ID<br/>PERSONA_NAME| GEN[Generate CLAUDE.md]

    GEN --> SEC[Append Security Policy<br/>Command Authority +<br/>Content Isolation]
    SEC --> WIKI_SYS[Append Wiki System<br/>Instructions]

    WIKI_SYS --> INIT{First boot?}
    INIT -->|Yes| WIKI_INIT[Initialize Wiki<br/>index.md, log.md,<br/>purpose.md, sources.json]
    INIT -->|No| CFG

    WIKI_INIT --> CFG[Generate Config Files]

    subgraph "Config Generation"
        CFG --> S1[settings.json<br/>Permissions + MCP servers]
        CFG --> S2[settings.local.json<br/>Disable cloud MCPs]
        CFG --> S3[.mcp.json<br/>Project-level MCP]
        CFG --> S4[access.json<br/>Owner allowlist + groups]
        CFG --> S5[model.env + telegram .env]
        CFG --> S6[~/.claude.json<br/>Skip onboarding]
    end

    S1 --> AUTH{Auth Mode?}
    AUTH -->|API Key| AK[Export ANTHROPIC_API_KEY]
    AUTH -->|Team/Max| OA[Restore or seed<br/>OAuth credentials]

    AK --> RESUME{Session file<br/>exists?}
    OA --> RESUME
    RESUME -->|Yes| RS[--resume SESSION_ID]
    RESUME -->|No| LAUNCH

    RS --> LAUNCH["exec script -q ... -c<br/>&quot;claude --channels plugin:telegram&quot;"]
```

### Container File Layout

```
/bot/                         # WORKDIR
├── CLAUDE.md                 # Generated: persona + security + wiki instructions
├── .claude/
│   ├── settings.json         # Permissions, MCP servers, plugin config
│   ├── settings.local.json   # Disabled cloud MCPs
│   ├── commands/             # Custom slash commands (wiki-search, decide, etc.)
│   ├── channels/telegram/
│   │   ├── access.json       # DM allowlist + group config
│   │   ├── model.env         # CLAUDE_MODEL
│   │   └── .env              # TELEGRAM_BOT_TOKEN
│   └── wiki/                 # Wiki system templates
├── wiki/                     # Persistent wiki data
│   ├── index.md
│   ├── log.md
│   ├── purpose.md
│   ├── sources.json
│   └── pages/                # User, topic, conversation pages
├── logs/
│   ├── session-id            # Session resume file
│   └── PERSONA.log           # Full session transcript
└── persona.md                # Mounted read-only (local Docker only)

/home/botuser/.claude/        # User-level Claude config
├── .credentials.json         # OAuth tokens (persisted via Azure Files)
├── plugins/                  # Pre-baked Telegram plugin
└── channels/telegram/.env    # Telegram token copy

/etc/claude-code/
└── managed-settings.json     # {"channelsEnabled": true} — required for Team auth
```

## ACA Deployment

```mermaid
graph LR
    subgraph "Azure Resource Group: bottery-rg"
        subgraph "Container Registry"
            ACR["botteryacr.azurecr.io<br/>bottery:latest"]
        end

        subgraph "ACA Environment: bottery-env"
            WEB_APP["bottery-web<br/>(Next.js 15)"]
            BOT1["bottery-yellie"]
            BOT2["bottery-scrogie"]
            BOT3["bottery-..."]
        end

        subgraph "Storage: botterycreds"
            FS1["yellie-claude<br/>Azure File Share"]
            FS2["scrogie-claude<br/>Azure File Share"]
        end
    end

    ACR -->|Image pull| BOT1
    ACR -->|Image pull| BOT2
    ACR -->|Image pull| WEB_APP

    BOT1 ---|Volume mount<br/>/home/botuser/.claude| FS1
    BOT2 ---|Volume mount<br/>/home/botuser/.claude| FS2

    ENTRA["Microsoft<br/>Entra ID"] -->|OAuth| WEB_APP
    WEB_APP -->|Azure SDK| BOT1
    WEB_APP -->|Azure SDK| BOT2

    BOT1 <-->|Bot API| TG[Telegram]
    BOT2 <-->|Bot API| TG
```

Each bot container app runs with:
- **1 CPU / 2 GiB memory**, single replica (min=1, max=1)
- **Secrets**: telegram-bot-token, credentials-b64, acr-password (optionally teamwork-api-token)
- **Env vars**: PERSONA_NAME, OWNER_CHAT_ID, CLAUDE_MODEL, PERSONA_CONTENT_B64, AUTH_MODE

## Authentication Flow

```mermaid
sequenceDiagram
    participant Deploy as deploy-azure.sh /<br/>Web UI
    participant ACA as Bot Container
    participant CC as Claude Code
    participant Claude as claude.com OAuth
    participant AFS as Azure Files Volume

    Note over Deploy: Initial deployment
    Deploy->>ACA: CREDENTIALS_B64 env var<br/>(base64 OAuth tokens)

    Note over ACA: Container starts
    ACA->>ACA: entrypoint.sh checks<br/>persisted vs env creds

    alt First boot (no persisted creds)
        ACA->>ACA: Decode CREDENTIALS_B64 →<br/>~/.claude/.credentials.json
    else Restart (persisted creds exist)
        ACA->>ACA: Compare expiresAt timestamps
        alt Persisted creds newer
            ACA->>ACA: Keep persisted creds<br/>(auto-refreshed by CC)
        else Env var creds newer
            ACA->>ACA: Overwrite with env var creds
        end
    end

    ACA->>CC: Launch Claude Code
    CC->>Claude: API request with access token

    alt Token valid
        Claude-->>CC: 200 OK
    else Token expired
        CC->>Claude: Refresh token request
        Claude-->>CC: New access + refresh tokens
        CC->>AFS: Write refreshed creds to<br/>/home/botuser/.claude/.credentials.json
        Note over AFS: Survives container restarts
    end

    Note over ACA: ~24h later, container restarts
    ACA->>AFS: Read persisted creds<br/>(refreshed tokens)
    ACA->>ACA: Persisted > env var → use persisted
```

## Message Flow

```mermaid
sequenceDiagram
    participant User as Telegram User
    participant TG as Telegram API
    participant Plugin as Telegram Plugin<br/>(MCP Server)
    participant CC as Claude Code
    participant Tools as Tools<br/>(Bash, Read, Write, MCP)

    User->>TG: Send message
    TG->>Plugin: Long-poll getUpdates
    Plugin->>Plugin: Check access.json<br/>(allowlist / group rules)

    alt Authorized sender
        Plugin->>CC: Deliver message via<br/>channel protocol
        CC->>CC: Read CLAUDE.md<br/>(persona + security + wiki)

        opt Wiki lookup
            CC->>Tools: Read wiki/index.md
            Tools-->>CC: Wiki context
        end

        opt Task execution
            CC->>Tools: Bash, Read, Write,<br/>MCP calls
            Tools-->>CC: Results
        end

        CC->>Plugin: Reply with response
        Plugin->>TG: sendMessage
        TG->>User: Bot response

        opt Wiki update
            CC->>Tools: Update wiki pages<br/>with new knowledge
        end
    else Unauthorized sender
        Plugin->>CC: Deliver message (untrusted)
        CC->>Plugin: Conversational reply only<br/>(no commands executed)
        Plugin->>TG: sendMessage
        TG->>User: Reply
    end
```

## Web UI Architecture

```mermaid
graph TB
    subgraph "Next.js 15 App Router"
        MW["Middleware<br/>JWT validation via getToken"]

        subgraph "Pages"
            P1["/bots — Dashboard"]
            P2["/bots/new — Create Bot"]
            P3["/bots/[name] — Detail"]
            P4["/bots/[name]/edit — Edit"]
            P5["/login — Sign In"]
        end

        subgraph "API Routes"
            A1["POST /api/bots"]
            A2["GET /api/bots/[name]"]
            A3["PUT /api/bots/[name]"]
            A4["DELETE /api/bots/[name]"]
            A5["POST /api/bots/[name]/restart"]
        end

        subgraph "Libraries"
            AUTH["lib/auth.ts<br/>NextAuth + Entra ID"]
            CA["lib/azure/container-apps.ts<br/>CRUD operations"]
            EB["lib/bottery/env-builder.ts<br/>Config → env vars + secrets"]
            TY["lib/bottery/types.ts<br/>BotConfig, Bot, BotStatus"]
        end
    end

    MW -->|Protect| P1
    MW -->|Protect| P2
    MW -->|Protect| P3
    MW -->|Protect| P4
    MW -.->|Allow| P5

    A1 --> EB --> CA
    A3 --> CA
    A4 --> CA
    A5 --> CA

    CA -->|Azure SDK| ACA["Azure Container Apps"]
```

## Security Model

```mermaid
graph TB
    subgraph "Defense Layers"
        L1["Layer 1: Telegram Access Control<br/>access.json — DM allowlist, group mention-only"]
        L2["Layer 2: Command Authority<br/>Only OWNER_CHAT_ID can issue commands"]
        L3["Layer 3: Content Isolation<br/>External content = DATA, never instructions"]
        L4["Layer 4: Permission Deny Rules<br/>.env files, credentials, reboot/shutdown"]
        L5["Layer 5: Secret Management<br/>ACA secrets for tokens + API keys"]
        L6["Layer 6: Web UI Auth<br/>Entra ID OAuth + JWT middleware"]
    end

    L1 --> L2 --> L3 --> L4 --> L5 --> L6
```

| Layer | What it protects | How |
|-------|-----------------|-----|
| Telegram Access | Unauthorized DM access | Allowlist in access.json; only OWNER_CHAT_ID |
| Command Authority | Bot actions from non-owners | CLAUDE.md security policy; other users get conversation only |
| Content Isolation | Prompt injection via URLs/docs | Fetched content treated as data, never executed |
| Permission Denials | Sensitive files and OS commands | settings.json deny rules for .env, credentials, reboot |
| Secret Management | API keys and tokens in transit/rest | ACA secrets (not plain env vars) for sensitive values |
| Web UI Auth | Management console access | Microsoft Entra ID + JWT validation on every route |

## MCP Integration

Bots can connect to external MCP servers for extended capabilities. All are optional and configured via environment variables.

| MCP Server | Transport | Env Var | Purpose |
|------------|-----------|---------|---------|
| Nellie | SSE | `NELLIE_URL` | Semantic code memory — search, index, lessons |
| Beer Can | SSE | `BEERCAN_URL` | Inter-agent messaging — group chat between bots |
| Teamwork | HTTP | `TW_MCP_BEARER_TOKEN` | Project management — tasks, projects, time tracking |

MCP servers are wired into both settings.json (permissions) and .mcp.json (project-level config) at container startup. Cloud-hosted MCPs (Context7, Google Calendar, Google Drive, Cloudflare, Netlify) are explicitly disabled in settings.local.json to prevent unintended external connections.

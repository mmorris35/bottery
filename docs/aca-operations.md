# ACA Deployment & Operations Runbook

Single source of truth for deploying and operating Bottery bots on Azure Container Apps.

## Architecture

### Credential Bridge

Azure File Share uses SMB, which does not support symlinks. Claude Code's Telegram plugin runs `bun install` at startup, which creates symlinks in `node_modules/.bin`. If `$HOME/.claude` is on SMB, the plugin crashes with `EACCES` on link creation.

The fix: mount the file share at `/mnt/claude-creds` instead of `$HOME/.claude`. The entrypoint seeds credentials from the mount into the local filesystem at startup and persists them back on exit. `$HOME/.claude` stays on local ext4 where symlinks work.

```
Azure File Share (/mnt/claude-creds)     Local ext4 ($HOME/.claude)
├── .credentials.json          ──seed──>  ├── .credentials.json
└── .credentials.json.bak                 ├── plugins/ (copied from /opt/bottery-plugins/)
                                          ├── channels/telegram/
                                          └── settings.json (generated)
```

### Cred-Guard Watchdog

Claude Code has a bug: it truncates `.credentials.json` to 0 bytes before writing a refreshed token. If the refresh request fails (network error, rate limit, expired refresh token), the file stays empty — the refresh token is gone permanently.

The entrypoint runs CC inside a watchdog loop that:
1. Backs up `.credentials.json` before each CC launch
2. Detects if the file was wiped to 0 bytes after CC exits
3. Restores from backup automatically
4. Persists both files to the Azure File Share
5. Uses exponential backoff (5s to 300s) with a 20-failure circuit breaker

### Plugin Handling

The Telegram plugin is pre-built during `docker build` and stored at `/opt/bottery-plugins/`. At container startup, the entrypoint copies it to `$HOME/.claude/plugins/`. This avoids running `bun install` on SMB and ensures the plugin is always available.

## Initial Setup

Run once per Azure subscription:

```bash
./deploy-azure.sh --setup
```

This creates:
- Resource group: `bottery-rg`
- Container registry: `botteryacr` (Basic SKU, admin enabled)
- Storage account: `botterycreds` (Standard LRS)
- Container Apps environment: `bottery-env`

It also registers the required resource providers (`Microsoft.ContainerRegistry`, `Microsoft.App`, `Microsoft.OperationalInsights`) and builds the container image.

## Deploying a New Bot

### Via CLI

```bash
# API key auth
export ANTHROPIC_API_KEY="sk-ant-..."
./deploy-azure.sh PERSONA <bot_token> <owner_chat_id>

# Team/Max auth
./deploy-azure.sh PERSONA <bot_token> <owner_chat_id> --auth-login
```

The script creates a file share (`<persona>-claude`), links it to the ACA environment, and deploys with the volume mounted at `/mnt/claude-creds`.

### Via Web Wizard

The bottery-web UI at `/bots/new` handles the same setup through the Azure SDK. It creates the file share, storage link, and container app with the correct volume mount path.

### Team/Max Credentials

For `--auth-login` (no API key), you need `CREDENTIALS_B64` — a base64-encoded OAuth credential file.

Extract from macOS Keychain (where CC stores tokens on newer versions):

```bash
security find-generic-password -s "Claude Code-credentials" -a "<username>" -w | base64
```

For the web wizard, set `DEFAULT_CREDENTIALS_B64` in the web app's environment, or provide credentials per-bot in the deploy form.

### Team Org Channel Requirement

Claude Code Team/Enterprise orgs block `--channels` by default. The Dockerfile bakes in `/etc/claude-code/managed-settings.json` with `{"channelsEnabled": true}`. No action needed for new deployments. If deploying CC natively on a new macOS host, create `/Library/Application Support/ClaudeCode/managed-settings.json` with the same content.

## Credential Rotation

### Normal Operation

Claude Team OAuth access tokens expire after ~1 hour. CC auto-refreshes using the refresh token. The cred-guard loop backs up valid credentials before each launch and restores them if the 0-byte wipe bug triggers.

### Full Credential Loss

If both the credential file and backup are gone or corrupted (no refresh token):

1. Extract fresh credentials from Keychain:
   ```bash
   security find-generic-password -s "Claude Code-credentials" -a "<username>" -w | base64
   ```

2. Delete broken file share credentials (so entrypoint uses the fresh env var):
   ```bash
   az storage file delete --share-name <persona>-claude --path .credentials.json --account-name botterycreds
   az storage file delete --share-name <persona>-claude --path .credentials.json.bak --account-name botterycreds
   ```

3. Update the ACA secret:
   ```bash
   az containerapp secret set -n <app> -g bottery-rg --secrets credentials-b64=<NEW_B64>
   ```

4. Deploy a new revision (secret changes require a new revision):
   ```bash
   az containerapp update -n <app> -g bottery-rg --revision-suffix "v$(date +%s)"
   ```

### Credential Separation

Two credential pools. Never mix them.

| Environment | Bots | Subscription | Tier |
|---|---|---|---|
| Mac mini (local Docker) | jennifer, mater, reigen, bilby | Mike's personal Claude Max 20x | `default_claude_max_20x` |
| Azure Container Apps | scrogie, yellie, goofy | Sequel Data corporate team | `default_raven` |

## Image Updates

### Build and Push

```bash
az acr build --registry botteryacr -g bottery-rg --image bottery:latest .
```

### Deploy the New Image

`az containerapp revision restart` does **NOT** pull a new image. It restarts the existing revision with the cached image digest.

Always force a new revision:

```bash
az containerapp update -n <app> -g bottery-rg \
  --image botteryacr.azurecr.io/bottery:latest \
  --revision-suffix "v$(date +%s)"
```

To update all ACA bots after a rebuild:

```bash
for app in bottery-goofy bottery-scrogie bottery-yellie; do
  az containerapp update -n "$app" -g bottery-rg \
    --image botteryacr.azurecr.io/bottery:latest \
    --revision-suffix "v$(date +%s)"
done
```

## Known Issues

### 1. SMB Symlink Limitation

Azure File Share (SMB) does not support symlinks. `bun install` fails with `EACCES` when trying to create `node_modules/.bin` links. Plugins must stay on the local container filesystem. The entrypoint copies them from `/opt/bottery-plugins/` at startup.

### 2. Credential File Wipe (0-Byte Bug)

CC opens `.credentials.json` for write (truncating it) before the OAuth refresh completes. If the refresh request fails, the file is 0 bytes and the refresh token is lost. The cred-guard loop detects and restores from backup.

### 3. Revision Restart vs Update

`az containerapp revision restart` restarts the same revision with the same image digest. `az containerapp update` with `--revision-suffix` creates a new revision that pulls the latest image. Always use `update` after rebuilding the image.

### 4. YAML Update Drops Env Vars

`az containerapp update --yaml` can wipe env vars not included in the YAML. Always re-set env vars after a YAML-based update, or use `--set-env-vars` instead.

### 5. File Share DeletePending

Deleting a file from the share while a container has it open returns `DeletePending`. Either stop the container first or wait for the SMB lock to release.

### 6. Log API Rate Limits

`az containerapp logs show` returns HTTP 429 if called too frequently. Space queries at least 10 seconds apart.

### 7. `claude auth status` Is Shallow

`claude auth status` checks whether a credential file exists and has valid structure. It does **not** verify token expiry or trigger a refresh. A "valid" auth status does not mean the access token will work on the next API call.

## Troubleshooting

Bot not responding to Telegram messages:

1. **Is the container running?**
   ```bash
   az containerapp show -n <app> -g bottery-rg --query properties.runningStatus -o tsv
   ```

2. **Is the plugin loaded?**
   ```bash
   az containerapp logs show -n <app> -g bottery-rg --tail 50
   ```
   - "Listening for channel messages" = plugin loaded, good
   - "plugin not installed" = plugin copy failed, rebuild image and redeploy

3. **Is auth working?**
   - Look for `401` or `Unauthorized` in logs
   - If present: credentials expired, follow [Full Credential Loss](#full-credential-loss)

4. **Is the cred file empty?**
   - Check file share: `az storage file list --share-name <persona>-claude --account-name botterycreds -o table`
   - If `.credentials.json` is 0 bytes, cred-guard should have restored it. If not, follow credential rotation steps.

5. **Is the image current?**
   ```bash
   # When was the image last pushed?
   az acr manifest list-metadata --registry botteryacr --name bottery --top 1 --orderby time_desc --query "[0].lastUpdateTime" -o tsv

   # What revision is the app running?
   az containerapp show -n <app> -g bottery-rg --query properties.latestRevisionName -o tsv
   ```
   If the revision predates the image push, force a new revision (see [Image Updates](#image-updates)).

6. **Is the container crash-looping?**
   ```bash
   az containerapp revision list -n <app> -g bottery-rg --query "[0].{name:name, status:properties.runningState, replicas:properties.replicas}" -o json
   ```

## Storage Details

| Item | Value |
|---|---|
| Storage account | `botterycreds` |
| File share naming | `<persona-lowercase>-claude` (e.g., `goofy-claude`) |
| ACA storage link naming | `<persona-lowercase>creds` (e.g., `goofycreds`) |
| Mount path in container | `/mnt/claude-creds` |
| Local credential path | `$HOME/.claude/.credentials.json` |
| Plugin source (image) | `/opt/bottery-plugins/` |
| Plugin destination (runtime) | `$HOME/.claude/plugins/` |

## Current ACA Bots

As of 2026-05-01.

| Bot | ACA Name | Model | Auth | Owner |
|---|---|---|---|---|
| Goofy | bottery-goofy | Haiku 4.5 | Team | Mike (test/benchmark) |
| Scrogie | bottery-scrogie | Opus 4.6 | Team | Shane |
| Yellie | bottery-yellie | Sonnet 4.6 | Team | Danielle |

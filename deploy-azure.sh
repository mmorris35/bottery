#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Azure defaults
RESOURCE_GROUP="bottery-rg"
ACR_NAME="botteryacr"
ACR_LOGIN_SERVER="botteryacr.azurecr.io"
ENVIRONMENT="bottery-env"
STORAGE_ACCOUNT="botterycreds"
IMAGE="bottery:latest"

usage() {
  cat <<EOF
Usage: $0 <PERSONA> <BOT_TOKEN> <OWNER_CHAT_ID> [options]

Deploy a Claude Code Telegram bot to Azure Container Apps.

Arguments:
  PERSONA          Persona name (matches personas/<NAME>.md)
  BOT_TOKEN        Telegram bot token from @BotFather
  OWNER_CHAT_ID    Telegram chat ID of the bot owner

Options:
  --group ID       Group chat ID to join
  --nellie URL     Nellie SSE endpoint URL
  --beercan URL    Beer Can SSE endpoint URL
  --model MODEL    Claude model (default: claude-opus-4-6)
  --name NAME      Container app name (default: bottery-<persona>)
  --rebuild        Force rebuild of container image in ACR
  --auth-login     Use claude auth login (Max/Team plan, no API key)
  --subscription S Azure subscription ID
  -h, --help       Show this help

Environment:
  ANTHROPIC_API_KEY    Optional. Your Anthropic API key.
                       If not set, uses claude auth login (Max/Team plan).

Prerequisites:
  - Azure CLI (az) installed and logged in
  - Resource group, ACR, and Container Apps environment created
    (run: deploy-azure.sh --setup to create them)
EOF
  exit 0
}

[[ $# -lt 1 ]] && usage

# --- Handle --setup ---
if [[ "$1" == "--setup" ]]; then
  echo "Setting up Azure infrastructure for Bottery..."
  echo ""

  SUB_ID="${2:-}"
  if [[ -n "$SUB_ID" ]]; then
    az account set --subscription "$SUB_ID"
  fi

  echo "Subscription: $(az account show --query name -o tsv)"
  echo ""

  echo "Registering resource providers..."
  az provider register --namespace Microsoft.ContainerRegistry --wait
  az provider register --namespace Microsoft.App --wait
  az provider register --namespace Microsoft.OperationalInsights --wait
  echo "  Done."

  echo "Creating resource group: $RESOURCE_GROUP"
  az group create --name "$RESOURCE_GROUP" --location centralus --output none

  echo "Creating container registry: $ACR_NAME"
  az acr create --resource-group "$RESOURCE_GROUP" --name "$ACR_NAME" \
    --sku Basic --admin-enabled true --output none

  echo "Creating storage account for credential persistence: $STORAGE_ACCOUNT"
  az storage account create --resource-group "$RESOURCE_GROUP" \
    --name "$STORAGE_ACCOUNT" --location centralus --sku Standard_LRS --output none

  echo "Creating Container Apps environment: $ENVIRONMENT"
  az containerapp env create --resource-group "$RESOURCE_GROUP" \
    --name "$ENVIRONMENT" --location centralus --output none

  echo "Building container image..."
  az acr build --registry "$ACR_NAME" --resource-group "$RESOURCE_GROUP" \
    --image "$IMAGE" "$SCRIPT_DIR/"

  echo ""
  echo "=== Azure infrastructure ready ==="
  echo "  Resource group:  $RESOURCE_GROUP"
  echo "  Registry:        $ACR_LOGIN_SERVER"
  echo "  Environment:     $ENVIRONMENT"
  echo "  Storage account: $STORAGE_ACCOUNT"
  echo "  Image:           $ACR_LOGIN_SERVER/$IMAGE"
  echo ""
  echo "Deploy a bot with:"
  echo "  $0 OPRAH <bot_token> <owner_chat_id>"
  exit 0
fi

# --- Argument parsing ---

[[ $# -lt 3 ]] && { echo "Error: requires PERSONA, BOT_TOKEN, and OWNER_CHAT_ID"; usage; }

PERSONA="$1"; shift
BOT_TOKEN="$1"; shift
OWNER_CHAT_ID="$1"; shift

GROUP_CHAT_ID=""
NELLIE_URL=""
BEERCAN_URL=""
CLAUDE_MODEL="claude-opus-4-6"
APP_NAME=""
REBUILD=false
AUTH_LOGIN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --group)        GROUP_CHAT_ID="$2"; shift 2 ;;
    --nellie)       NELLIE_URL="$2"; shift 2 ;;
    --beercan)      BEERCAN_URL="$2"; shift 2 ;;
    --model)        CLAUDE_MODEL="$2"; shift 2 ;;
    --name)         APP_NAME="$2"; shift 2 ;;
    --rebuild)      REBUILD=true; shift ;;
    --auth-login)   AUTH_LOGIN=true; shift ;;
    --subscription) az account set --subscription "$2"; shift 2 ;;
    -h|--help)      usage ;;
    *)              echo "Unknown option: $1"; usage ;;
  esac
done

# --- Validate ---

if ! $AUTH_LOGIN && [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  echo "Error: Set ANTHROPIC_API_KEY or use --auth-login for Max/Team plans"
  exit 1
fi

PERSONA_UPPER=$(echo "$PERSONA" | tr '[:lower:]' '[:upper:]')
PERSONA_LOWER=$(echo "$PERSONA" | tr '[:upper:]' '[:lower:]')
PERSONA_FILE="$SCRIPT_DIR/personas/${PERSONA_UPPER}.md"

if [[ ! -f "$PERSONA_FILE" ]]; then
  echo "Error: persona file not found: $PERSONA_FILE"
  echo "Available personas:"
  ls "$SCRIPT_DIR/personas/"*.md 2>/dev/null | xargs -I{} basename {} .md || echo "  (none)"
  exit 1
fi

APP_NAME="${APP_NAME:-bottery-${PERSONA_LOWER}}"

# --- Rebuild image if requested ---

if $REBUILD; then
  echo "Rebuilding container image in ACR..."
  az acr build --registry "$ACR_NAME" --resource-group "$RESOURCE_GROUP" \
    --image "$IMAGE" "$SCRIPT_DIR/"
fi

# --- Get ACR credentials ---

ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)

# --- Build env vars ---

ENV_VARS=(
  "TELEGRAM_BOT_TOKEN=$BOT_TOKEN"
  "OWNER_CHAT_ID=$OWNER_CHAT_ID"
  "PERSONA_NAME=$PERSONA_UPPER"
  "CLAUDE_MODEL=$CLAUDE_MODEL"
)

if $AUTH_LOGIN; then
  ENV_VARS+=("AUTH_MODE=login")
else
  ENV_VARS+=("ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY")
fi

# Inject persona as base64 (ACA can't mount host files)
PERSONA_B64=$(base64 < "$PERSONA_FILE" | tr -d '\n')
ENV_VARS+=("PERSONA_CONTENT_B64=$PERSONA_B64")

[[ -n "$GROUP_CHAT_ID" ]] && ENV_VARS+=("GROUP_CHAT_ID=$GROUP_CHAT_ID")
[[ -n "$NELLIE_URL" ]]    && ENV_VARS+=("NELLIE_URL=$NELLIE_URL")
[[ -n "$BEERCAN_URL" ]]   && ENV_VARS+=("BEERCAN_URL=$BEERCAN_URL")

# Format env vars for az containerapp
ENV_ARGS=""
for var in "${ENV_VARS[@]}"; do
  ENV_ARGS="$ENV_ARGS $var"
done

# --- Check if app exists ---

echo "Deploying $PERSONA_UPPER as $APP_NAME to Azure Container Apps..."

# --- Ensure credential file share and ACA storage link ---
SHARE_NAME="${PERSONA_LOWER}-claude"
STORAGE_NAME="${PERSONA_LOWER}creds"
STORAGE_KEY=$(az storage account keys list --account-name "$STORAGE_ACCOUNT" --resource-group "$RESOURCE_GROUP" --query "[0].value" -o tsv)

echo "Ensuring file share: $SHARE_NAME"
az storage share-rm create --storage-account "$STORAGE_ACCOUNT" --name "$SHARE_NAME" --quota 1 --output none 2>/dev/null || true

echo "Linking storage to ACA environment..."
az containerapp env storage set \
  --name "$ENVIRONMENT" \
  --resource-group "$RESOURCE_GROUP" \
  --storage-name "$STORAGE_NAME" \
  --azure-file-account-name "$STORAGE_ACCOUNT" \
  --azure-file-account-key "$STORAGE_KEY" \
  --azure-file-share-name "$SHARE_NAME" \
  --access-mode ReadWrite \
  --output none 2>/dev/null || true

REVISION_SUFFIX="v$(date +%s)"

if az containerapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
  echo "Updating existing container app: $APP_NAME"
  az containerapp update \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --image "$ACR_LOGIN_SERVER/$IMAGE" \
    --revision-suffix "$REVISION_SUFFIX" \
    --set-env-vars $ENV_ARGS \
    --output none
else
  echo "Creating new container app: $APP_NAME"

  cat > "/tmp/${APP_NAME}-deploy.yaml" <<DEPLOYYAML
properties:
  managedEnvironmentId: /subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.App/managedEnvironments/$ENVIRONMENT
  configuration:
    activeRevisionsMode: Single
    secrets:
      - name: acr-password
        value: "$ACR_PASSWORD"
    registries:
      - server: $ACR_LOGIN_SERVER
        username: $ACR_NAME
        passwordSecretRef: acr-password
  template:
    revisionSuffix: "$REVISION_SUFFIX"
    containers:
      - name: $APP_NAME
        image: $ACR_LOGIN_SERVER/$IMAGE
        resources:
          cpu: 1
          memory: 2Gi
        volumeMounts:
          - volumeName: claude-creds
            mountPath: /mnt/claude-creds
    scale:
      minReplicas: 1
      maxReplicas: 1
    volumes:
      - name: claude-creds
        storageName: $STORAGE_NAME
        storageType: AzureFile
DEPLOYYAML

  az containerapp create \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --yaml "/tmp/${APP_NAME}-deploy.yaml" \
    --output none

  # Set env vars separately (YAML and --set-env-vars don't mix well)
  az containerapp update \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --set-env-vars $ENV_ARGS \
    --revision-suffix "v$(date +%s)" \
    --output none

  rm -f "/tmp/${APP_NAME}-deploy.yaml"
fi

# --- Get app status ---

APP_STATUS=$(az containerapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" \
  --query '{state: properties.runningStatus, fqdn: properties.configuration.ingress.fqdn}' -o json 2>/dev/null || echo '{}')

echo ""
echo "=== $PERSONA_UPPER deployed to Azure ==="
echo "  App:           $APP_NAME"
echo "  Resource group: $RESOURCE_GROUP"
echo "  Image:         $ACR_LOGIN_SERVER/$IMAGE"
echo "  Logs:          az containerapp logs show -n $APP_NAME -g $RESOURCE_GROUP --follow"

if $AUTH_LOGIN; then
  echo ""
  echo "  AUTH REQUIRED: Watch logs for the device code URL:"
  echo "    az containerapp logs show -n $APP_NAME -g $RESOURCE_GROUP --follow"
  echo "  Then complete auth at the URL shown."
  echo ""
  echo "  To auth via exec instead:"
  echo "    az containerapp exec -n $APP_NAME -g $RESOURCE_GROUP -- claude auth login"
fi
echo ""

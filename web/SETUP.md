# Bottery Web UI — Azure Setup Guide

## 1. Azure AD App Registration

1. Go to **Azure Portal > Microsoft Entra ID > App registrations > New registration**
2. Settings:
   - Name: `Bottery Web`
   - Supported account types: **Single tenant** (Sequel Data only)
   - Redirect URI (Web): `https://<your-hostname>/api/auth/callback/microsoft-entra-id`
   - For local dev: `http://localhost:3000/api/auth/callback/microsoft-entra-id`
3. After creation, note:
   - **Application (client) ID** → `AZURE_AD_CLIENT_ID`
   - **Directory (tenant) ID** → `AZURE_AD_TENANT_ID`
4. Go to **Certificates & secrets > New client secret**
   - Set expiry (24 months recommended)
   - Copy the **Value** immediately → `AZURE_AD_CLIENT_SECRET`

### API Permissions

The app only needs the default `Microsoft.Graph / User.Read` (delegated).
No additional Graph permissions required — all Azure management uses a service principal.

## 2. Service Principal for Resource Management

Create a service principal with Contributor access to the bottery resource group:

```bash
az ad sp create-for-rbac \
  --name "bottery-web-sp" \
  --role Contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/bottery-rg
```

Output gives you:
- `appId` → `AZURE_CLIENT_ID`
- `password` → `AZURE_CLIENT_SECRET`
- `tenant` → `AZURE_TENANT_ID`

### Additional Role Assignments

```bash
# ACR push access (for image builds)
az role assignment create \
  --assignee <SP_APP_ID> \
  --role AcrPush \
  --scope /subscriptions/<SUB_ID>/resourceGroups/bottery-rg/providers/Microsoft.ContainerRegistry/registries/botteryacr

# Key Vault access (for bot credentials)
az role assignment create \
  --assignee <SP_APP_ID> \
  --role "Key Vault Secrets Officer" \
  --scope /subscriptions/<SUB_ID>/resourceGroups/bottery-rg/providers/Microsoft.KeyVault/vaults/bottery-kv
```

## 3. Key Vault Setup

```bash
az keyvault create \
  --name bottery-kv \
  --resource-group bottery-rg \
  --location centralus \
  --enable-rbac-authorization true
```

## 4. Container Apps Environment

If not already created:

```bash
az containerapp env create \
  --name bottery-env \
  --resource-group bottery-rg \
  --location centralus
```

## 5. Required Azure Resources Summary

| Resource | Name | Purpose |
|----------|------|---------|
| Resource Group | `bottery-rg` | Contains all bottery resources |
| Container Registry | `botteryacr` | Stores bot Docker images |
| Container Apps Environment | `bottery-env` | Hosts bot containers |
| Key Vault | `bottery-kv` | Stores bot credentials |
| App Registration | `Bottery Web` | Azure AD login for the web UI |
| Service Principal | `bottery-web-sp` | Azure SDK operations |

## 6. Service Principal Permissions Summary

| Role | Scope | Purpose |
|------|-------|---------|
| Contributor | `bottery-rg` | Create/update/delete Container Apps |
| AcrPush | `botteryacr` | Build and push images |
| Key Vault Secrets Officer | `bottery-kv` | Manage bot credentials |

## 7. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in all values from steps above.

## 8. Run Locally

```bash
cd web
npm install
npm run dev
```

## 9. Deploy to Azure

Build and deploy the web app as a Container App:

```bash
cd web
docker build -t botteryacr.azurecr.io/bottery-web:latest .
docker push botteryacr.azurecr.io/bottery-web:latest

az containerapp create \
  --name bottery-web \
  --resource-group bottery-rg \
  --environment bottery-env \
  --image botteryacr.azurecr.io/bottery-web:latest \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 1 \
  --env-vars \
    AZURE_AD_CLIENT_ID=<value> \
    AZURE_AD_CLIENT_SECRET=secretref:azure-ad-secret \
    AZURE_AD_TENANT_ID=<value> \
    NEXTAUTH_URL=https://<app-fqdn> \
    NEXTAUTH_SECRET=secretref:nextauth-secret \
    AZURE_TENANT_ID=<value> \
    AZURE_CLIENT_ID=<value> \
    AZURE_CLIENT_SECRET=secretref:sp-secret \
    AZURE_SUBSCRIPTION_ID=<value> \
    AZURE_RESOURCE_GROUP=bottery-rg \
    AZURE_ACR_NAME=botteryacr \
    AZURE_CONTAINER_ENV=bottery-env \
    AZURE_KEYVAULT_NAME=bottery-kv
```

After deployment, update the App Registration redirect URI to match the Container App's FQDN.

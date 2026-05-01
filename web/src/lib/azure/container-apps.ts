import { getContainerAppsClient, getAcrClient } from "./client";
import {
  AZURE_RESOURCE_GROUP,
  AZURE_ACR_NAME,
  AZURE_CONTAINER_ENV,
  AZURE_STORAGE_ACCOUNT,
  AZURE_STORAGE_KEY,
  ACR_IMAGE,
  BOT_APP_PREFIX,
} from "../bottery/config";
import { buildEnvVars } from "../bottery/env-builder";
import type { Bot, BotConfig, BotStatus } from "../bottery/types";
import {
  ShareServiceClient,
  StorageSharedKeyCredential,
} from "@azure/storage-file-share";

async function ensureBotStorage(personaName: string): Promise<string> {
  const persona = personaName.toLowerCase();
  const shareName = `${persona}-claude`;
  const storageName = `${persona}creds`;

  const cred = new StorageSharedKeyCredential(
    AZURE_STORAGE_ACCOUNT,
    AZURE_STORAGE_KEY
  );
  const serviceClient = new ShareServiceClient(
    `https://${AZURE_STORAGE_ACCOUNT}.file.core.windows.net`,
    cred
  );
  const shareClient = serviceClient.getShareClient(shareName);
  await shareClient.createIfNotExists();

  const client = getContainerAppsClient();
  await client.managedEnvironmentsStorages.createOrUpdate(
    AZURE_RESOURCE_GROUP,
    AZURE_CONTAINER_ENV,
    storageName,
    {
      properties: {
        azureFile: {
          accountName: AZURE_STORAGE_ACCOUNT,
          accountKey: AZURE_STORAGE_KEY,
          shareName,
          accessMode: "ReadWrite",
        },
      },
    }
  );

  return storageName;
}

function resolveStatus(
  provisioningState?: string,
  runningStatus?: string
): BotStatus {
  if (provisioningState === "Succeeded") {
    if (runningStatus === "Running") return "Running";
    if (runningStatus === "Stopped") return "Stopped";
    return "Running";
  }
  if (provisioningState === "InProgress") return "Provisioning";
  if (provisioningState === "Failed") return "Failed";
  return "Unknown";
}

function envValue(
  envVars: Array<{ name?: string; value?: string }> | undefined,
  name: string
): string | undefined {
  return envVars?.find((e) => e.name === name)?.value;
}

export async function listBots(): Promise<Bot[]> {
  const client = getContainerAppsClient();
  const bots: Bot[] = [];

  for await (const app of client.containerApps.listByResourceGroup(
    AZURE_RESOURCE_GROUP
  )) {
    if (!app.name?.startsWith(BOT_APP_PREFIX)) continue;

    const containers = app.template?.containers ?? [];
    const env = containers[0]?.env ?? [];

    bots.push({
      name: app.name,
      personaName: envValue(env, "PERSONA_NAME") ?? app.name,
      claudeModel: envValue(env, "CLAUDE_MODEL") ?? "unknown",
      ownerChatId: envValue(env, "OWNER_CHAT_ID") ?? "",
      authMode: envValue(env, "AUTH_MODE") ?? "api-key",
      groupChatId: envValue(env, "GROUP_CHAT_ID"),
      nellieUrl: envValue(env, "NELLIE_URL"),
      beercanUrl: envValue(env, "BEERCAN_URL"),
      status: resolveStatus(
        app.provisioningState,
        app.runningStatus as string | undefined
      ),
      createdAt: app.systemData?.createdAt?.toISOString(),
      updatedAt: app.systemData?.lastModifiedAt?.toISOString(),
    });
  }

  return bots;
}

export async function getBot(name: string): Promise<Bot | null> {
  const client = getContainerAppsClient();
  try {
    const app = await client.containerApps.get(AZURE_RESOURCE_GROUP, name);
    const containers = app.template?.containers ?? [];
    const env = containers[0]?.env ?? [];

    return {
      name: app.name!,
      personaName: envValue(env, "PERSONA_NAME") ?? app.name!,
      claudeModel: envValue(env, "CLAUDE_MODEL") ?? "unknown",
      ownerChatId: envValue(env, "OWNER_CHAT_ID") ?? "",
      authMode: envValue(env, "AUTH_MODE") ?? "api-key",
      groupChatId: envValue(env, "GROUP_CHAT_ID"),
      nellieUrl: envValue(env, "NELLIE_URL"),
      beercanUrl: envValue(env, "BEERCAN_URL"),
      status: resolveStatus(
        app.provisioningState,
        app.runningStatus as string | undefined
      ),
      createdAt: app.systemData?.createdAt?.toISOString(),
      updatedAt: app.systemData?.lastModifiedAt?.toISOString(),
    };
  } catch (e: unknown) {
    if ((e as { statusCode?: number }).statusCode === 404) return null;
    throw e;
  }
}

export async function createBot(config: BotConfig): Promise<Bot> {
  const client = getContainerAppsClient();
  const acrClient = getAcrClient();

  const appName = `${BOT_APP_PREFIX}${config.personaName.toLowerCase()}`;
  const { envVars, secrets } = buildEnvVars(config);

  const creds = await acrClient.registries.listCredentials(
    AZURE_RESOURCE_GROUP,
    AZURE_ACR_NAME
  );
  const acrUsername = creds.username!;
  const acrPassword = creds.passwords![0].value!;

  const envForContainer = envVars.map((e) =>
    e.secretRef
      ? { name: e.name, secretRef: e.secretRef }
      : { name: e.name, value: e.value }
  );

  const containerSecrets = [
    ...secrets.map((s) => ({ name: s.name, value: s.value })),
    { name: "acr-password", value: acrPassword },
  ];

  const storageName = await ensureBotStorage(config.personaName);
  const revisionSuffix = `v${Math.floor(Date.now() / 1000)}`;

  const poller = await client.containerApps.beginCreateOrUpdate(
    AZURE_RESOURCE_GROUP,
    appName,
    {
      location: "centralus",
      managedEnvironmentId: `/subscriptions/${process.env.AZURE_SUBSCRIPTION_ID}/resourceGroups/${AZURE_RESOURCE_GROUP}/providers/Microsoft.App/managedEnvironments/${AZURE_CONTAINER_ENV}`,
      configuration: {
        activeRevisionsMode: "Single",
        secrets: containerSecrets,
        registries: [
          {
            server: `${AZURE_ACR_NAME}.azurecr.io`,
            username: acrUsername,
            passwordSecretRef: "acr-password",
          },
        ],
      },
      template: {
        revisionSuffix,
        containers: [
          {
            name: appName,
            image: ACR_IMAGE,
            resources: { cpu: 1, memory: "2Gi" },
            env: envForContainer,
            volumeMounts: [
              {
                volumeName: "claude-creds",
                mountPath: "/mnt/claude-creds",
              },
            ],
          },
        ],
        scale: { minReplicas: 1, maxReplicas: 1 },
        volumes: [
          {
            name: "claude-creds",
            storageType: "AzureFile",
            storageName,
          },
        ],
      },
    }
  );

  await poller.pollUntilDone();

  return {
    name: appName,
    personaName: config.personaName,
    claudeModel: config.claudeModel,
    ownerChatId: config.ownerChatId,
    authMode: config.authMode,
    groupChatId: config.groupChatId,
    nellieUrl: config.nellieUrl,
    beercanUrl: config.beercanUrl,
    status: "Provisioning",
  };
}

export async function updateBot(
  name: string,
  config: Partial<BotConfig>
): Promise<void> {
  const client = getContainerAppsClient();

  const existing = await client.containerApps.get(AZURE_RESOURCE_GROUP, name);
  const containers = existing.template?.containers ?? [];
  const currentEnv = containers[0]?.env ?? [];
  const currentSecrets = existing.configuration?.secrets ?? [];

  const newEnv = [...currentEnv];
  const newSecrets = [...currentSecrets];

  function setEnv(key: string, value: string) {
    const idx = newEnv.findIndex((e) => e.name === key);
    if (idx >= 0) newEnv[idx] = { name: key, value };
    else newEnv.push({ name: key, value });
  }

  if (config.claudeModel) setEnv("CLAUDE_MODEL", config.claudeModel);
  if (config.personaContent) {
    setEnv(
      "PERSONA_CONTENT_B64",
      Buffer.from(config.personaContent).toString("base64")
    );
  }
  if (config.nellieUrl !== undefined) setEnv("NELLIE_URL", config.nellieUrl);
  if (config.beercanUrl !== undefined)
    setEnv("BEERCAN_URL", config.beercanUrl);
  if (config.groupChatId !== undefined)
    setEnv("GROUP_CHAT_ID", config.groupChatId);
  if (config.teamworkApiToken) {
    const secretIdx = newSecrets.findIndex((s) => s.name === "teamwork-api-token");
    if (secretIdx >= 0) newSecrets[secretIdx] = { name: "teamwork-api-token", value: config.teamworkApiToken };
    else newSecrets.push({ name: "teamwork-api-token", value: config.teamworkApiToken });
    const envIdx = newEnv.findIndex((e) => e.name === "TW_MCP_BEARER_TOKEN");
    if (envIdx >= 0) newEnv[envIdx] = { name: "TW_MCP_BEARER_TOKEN", secretRef: "teamwork-api-token" };
    else newEnv.push({ name: "TW_MCP_BEARER_TOKEN", secretRef: "teamwork-api-token" });
  }

  const revisionSuffix = `v${Math.floor(Date.now() / 1000)}`;

  const poller = await client.containerApps.beginUpdate(
    AZURE_RESOURCE_GROUP,
    name,
    {
      ...existing,
      configuration: { ...existing.configuration, secrets: newSecrets },
      template: {
        ...existing.template,
        revisionSuffix,
        containers: [
          {
            ...containers[0],
            env: newEnv,
          },
        ],
      },
    }
  );

  await poller.pollUntilDone();
}

export async function deleteBot(name: string): Promise<void> {
  const client = getContainerAppsClient();
  const persona = name.replace(BOT_APP_PREFIX, "");
  const storageName = `${persona}creds`;
  const shareName = `${persona}-claude`;

  const poller = await client.containerApps.beginDelete(
    AZURE_RESOURCE_GROUP,
    name
  );
  await poller.pollUntilDone();

  try {
    await client.managedEnvironmentsStorages.delete(
      AZURE_RESOURCE_GROUP,
      AZURE_CONTAINER_ENV,
      storageName
    );
  } catch {}

  try {
    const cred = new StorageSharedKeyCredential(
      AZURE_STORAGE_ACCOUNT,
      AZURE_STORAGE_KEY
    );
    const serviceClient = new ShareServiceClient(
      `https://${AZURE_STORAGE_ACCOUNT}.file.core.windows.net`,
      cred
    );
    await serviceClient.getShareClient(shareName).deleteIfExists();
  } catch {}
}

export async function restartBot(name: string): Promise<void> {
  const client = getContainerAppsClient();
  const existing = await client.containerApps.get(AZURE_RESOURCE_GROUP, name);
  const revisionSuffix = `v${Math.floor(Date.now() / 1000)}`;

  const poller = await client.containerApps.beginUpdate(
    AZURE_RESOURCE_GROUP,
    name,
    {
      ...existing,
      template: {
        ...existing.template,
        revisionSuffix,
      },
    }
  );
  await poller.pollUntilDone();
}

export async function getBotLogs(
  name: string,
  _tail: number = 100
): Promise<string[]> {
  return [
    `Use CLI for live logs:`,
    `  az containerapp logs show -n ${name} -g ${AZURE_RESOURCE_GROUP} --tail ${_tail}`,
    ``,
    `Or follow live:`,
    `  az containerapp logs show -n ${name} -g ${AZURE_RESOURCE_GROUP} --follow`,
  ];
}

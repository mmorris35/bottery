export const AZURE_RESOURCE_GROUP =
  process.env.AZURE_RESOURCE_GROUP || "bottery-rg";
export const AZURE_ACR_NAME = process.env.AZURE_ACR_NAME || "botteryacr";
export const AZURE_CONTAINER_ENV =
  process.env.AZURE_CONTAINER_ENV || "bottery-env";
export const AZURE_KEYVAULT_NAME =
  process.env.AZURE_KEYVAULT_NAME || "bottery-kv";
export const AZURE_SUBSCRIPTION_ID = process.env.AZURE_SUBSCRIPTION_ID || "";
export const AZURE_STORAGE_ACCOUNT =
  process.env.AZURE_STORAGE_ACCOUNT || "botterycreds";
export const AZURE_STORAGE_KEY = process.env.AZURE_STORAGE_KEY || "";

export const BOT_APP_PREFIX = "bottery-";
export const ACR_IMAGE = `${AZURE_ACR_NAME}.azurecr.io/bottery:latest`;

export const CLAUDE_MODELS = [
  { id: "claude-opus-4-6", label: "Opus 4.6" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
] as const;

export const DEFAULT_MODEL = "claude-opus-4-6";

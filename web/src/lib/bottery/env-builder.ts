import type { BotConfig } from "./types";

export interface EnvVar {
  name: string;
  value?: string;
  secretRef?: string;
}

export interface SecretEntry {
  name: string;
  value: string;
}

export function buildEnvVars(
  config: BotConfig
): { envVars: EnvVar[]; secrets: SecretEntry[] } {
  const personaUpper = config.personaName.toUpperCase();
  const personaB64 = Buffer.from(config.personaContent).toString("base64");

  const secrets: SecretEntry[] = [
    { name: "telegram-bot-token", value: config.telegramBotToken },
  ];

  const envVars: EnvVar[] = [
    { name: "TELEGRAM_BOT_TOKEN", secretRef: "telegram-bot-token" },
    { name: "OWNER_CHAT_ID", value: config.ownerChatId },
    { name: "PERSONA_NAME", value: personaUpper },
    { name: "CLAUDE_MODEL", value: config.claudeModel },
    { name: "PERSONA_CONTENT_B64", value: personaB64 },
  ];

  if (config.authMode === "login") {
    const creds = config.credentialsB64 || process.env.DEFAULT_CREDENTIALS_B64 || "";
    if (creds) {
      secrets.push({
        name: "credentials-b64",
        value: creds,
      });
      envVars.push(
        { name: "AUTH_MODE", value: "login" },
        { name: "CREDENTIALS_B64", secretRef: "credentials-b64" }
      );
    }
  } else if (config.authMode === "api-key" && config.anthropicApiKey) {
    secrets.push({
      name: "anthropic-api-key",
      value: config.anthropicApiKey,
    });
    envVars.push({
      name: "ANTHROPIC_API_KEY",
      secretRef: "anthropic-api-key",
    });
  }

  if (config.groupChatId) {
    envVars.push({ name: "GROUP_CHAT_ID", value: config.groupChatId });
  }
  if (config.nellieUrl) {
    envVars.push({ name: "NELLIE_URL", value: config.nellieUrl });
  }
  if (config.beercanUrl) {
    envVars.push({ name: "BEERCAN_URL", value: config.beercanUrl });
  }
  if (config.teamworkApiToken) {
    secrets.push({
      name: "teamwork-api-token",
      value: config.teamworkApiToken,
    });
    envVars.push({
      name: "TW_MCP_BEARER_TOKEN",
      secretRef: "teamwork-api-token",
    });
  }

  return { envVars, secrets };
}

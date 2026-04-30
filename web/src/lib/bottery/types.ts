export interface BotConfig {
  personaName: string;
  personaContent: string;
  telegramBotToken: string;
  ownerChatId: string;
  claudeModel: string;
  authMode: "api-key" | "login";
  anthropicApiKey?: string;
  credentialsB64?: string;
  groupChatId?: string;
  nellieUrl?: string;
  beercanUrl?: string;
  teamworkApiToken?: string;
}

export interface Bot {
  name: string;
  personaName: string;
  claudeModel: string;
  ownerChatId: string;
  authMode: string;
  groupChatId?: string;
  nellieUrl?: string;
  beercanUrl?: string;
  teamworkApiToken?: string;
  status: BotStatus;
  createdAt?: string;
  updatedAt?: string;
}

export type BotStatus =
  | "Running"
  | "Provisioning"
  | "Stopped"
  | "Failed"
  | "Unknown";

export interface LogEntry {
  timestamp: string;
  message: string;
}

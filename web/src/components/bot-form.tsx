"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CLAUDE_MODELS, DEFAULT_MODEL } from "@/lib/bottery/config";

interface BotFormProps {
  mode: "create" | "edit";
  initialValues?: Partial<FormValues>;
  botName?: string;
}

interface FormValues {
  personaName: string;
  personaContent: string;
  telegramBotToken: string;
  ownerChatId: string;
  claudeModel: string;
  authMode: "api-key" | "login";
  anthropicApiKey: string;
  credentialsB64: string;
  groupChatId: string;
  nellieUrl: string;
  beercanUrl: string;
  teamworkApiToken: string;
}

const SAMPLE_PERSONA = `# PersonaName — Telegram Bot Persona

You are PersonaName, a helpful AI assistant on Telegram.

## Personality

- Friendly and professional
- Concise responses (mobile-friendly)
- Gets things done without drama

## Boundaries

- Never break character in Telegram
- Keep responses concise — user reads on mobile
- Do not expose secrets, API keys, or credentials
`;

export function BotForm({ mode, initialValues, botName }: BotFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormValues>({
    personaName: initialValues?.personaName ?? "",
    personaContent: initialValues?.personaContent ?? SAMPLE_PERSONA,
    telegramBotToken: initialValues?.telegramBotToken ?? "",
    ownerChatId: initialValues?.ownerChatId ?? "",
    claudeModel: initialValues?.claudeModel ?? DEFAULT_MODEL,
    authMode: initialValues?.authMode ?? "login",
    anthropicApiKey: initialValues?.anthropicApiKey ?? "",
    credentialsB64: initialValues?.credentialsB64 ?? "",
    groupChatId: initialValues?.groupChatId ?? "",
    nellieUrl: initialValues?.nellieUrl ?? "",
    beercanUrl: initialValues?.beercanUrl ?? "",
    teamworkApiToken: initialValues?.teamworkApiToken ?? "",
  });

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const url =
        mode === "create" ? "/api/bots" : `/api/bots/${botName}`;
      const method = mode === "create" ? "POST" : "PUT";

      const body =
        mode === "create"
          ? form
          : {
              claudeModel: form.claudeModel,
              personaContent: form.personaContent,
              groupChatId: form.groupChatId,
              nellieUrl: form.nellieUrl,
              beercanUrl: form.beercanUrl,
              teamworkApiToken: form.teamworkApiToken,
            };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      router.push("/bots");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-8">
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Persona */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Persona</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Name
          </label>
          <input
            type="text"
            value={form.personaName}
            onChange={(e) => set("personaName", e.target.value)}
            disabled={mode === "edit"}
            placeholder="OPRAH"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            Uppercase, letters/numbers/hyphens only
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Persona Content (Markdown)
          </label>
          <textarea
            value={form.personaContent}
            onChange={(e) => set("personaContent", e.target.value)}
            rows={12}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>
      </section>

      {/* Telegram */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Telegram</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Bot Token
          </label>
          <input
            type="password"
            value={form.telegramBotToken}
            onChange={(e) => set("telegramBotToken", e.target.value)}
            disabled={mode === "edit"}
            placeholder="123456789:AAH..."
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
            required={mode === "create"}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Owner Chat ID
          </label>
          <input
            type="text"
            value={form.ownerChatId}
            onChange={(e) => set("ownerChatId", e.target.value)}
            disabled={mode === "edit"}
            placeholder="8204422256"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
            required={mode === "create"}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Group Chat ID (optional)
          </label>
          <input
            type="text"
            value={form.groupChatId}
            onChange={(e) => set("groupChatId", e.target.value)}
            placeholder="-100123456789"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
      </section>

      {/* Model */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Model</h2>
        <div>
          <select
            value={form.claudeModel}
            onChange={(e) => set("claudeModel", e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            {CLAUDE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Authentication */}
      {mode === "create" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Authentication
          </h2>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="login"
                checked={form.authMode === "login"}
                onChange={() => set("authMode", "login")}
              />
              <span className="text-sm">Claude Max/Team (login)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="api-key"
                checked={form.authMode === "api-key"}
                onChange={() => set("authMode", "api-key")}
              />
              <span className="text-sm">API Key</span>
            </label>
          </div>
          {form.authMode === "login" && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Credentials (base64)
              </label>
              <input
                type="password"
                value={form.credentialsB64}
                onChange={(e) => set("credentialsB64", e.target.value)}
                placeholder="Leave blank to use team credentials"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Leave blank to use the default team credentials, or paste custom: cat ~/.claude/.credentials.json | base64
              </p>
            </div>
          )}
          {form.authMode === "api-key" && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Anthropic API Key
              </label>
              <input
                type="password"
                value={form.anthropicApiKey}
                onChange={(e) => set("anthropicApiKey", e.target.value)}
                placeholder="sk-ant-..."
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          )}
        </section>
      )}

      {/* MCP */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          MCP Connections (optional)
        </h2>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Nellie URL
          </label>
          <input
            type="url"
            value={form.nellieUrl}
            onChange={(e) => set("nellieUrl", e.target.value)}
            placeholder="http://100.87.147.89:8765/sse"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Beer Can URL
          </label>
          <input
            type="url"
            value={form.beercanUrl}
            onChange={(e) => set("beercanUrl", e.target.value)}
            placeholder="http://localhost:9100/sse"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Teamwork API Token
          </label>
          <input
            type="password"
            value={form.teamworkApiToken}
            onChange={(e) => set("teamworkApiToken", e.target.value)}
            placeholder="tw_..."
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Teamwork.com bearer token — connects to mcp.ai.teamwork.com
          </p>
        </div>
      </section>

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
      >
        {loading
          ? mode === "create"
            ? "Creating..."
            : "Updating..."
          : mode === "create"
            ? "Create Bot"
            : "Update Bot"}
      </button>
    </form>
  );
}

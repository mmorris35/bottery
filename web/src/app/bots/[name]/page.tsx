"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Bot } from "@/lib/bottery/types";
import { StatusBadge } from "@/components/status-badge";

export default function BotDetailPage() {
  const { name } = useParams<{ name: string }>();
  const router = useRouter();
  const [bot, setBot] = useState<Bot | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchBot = useCallback(async () => {
    const res = await fetch(`/api/bots/${name}`);
    if (res.ok) setBot(await res.json());
  }, [name]);

  const fetchLogs = useCallback(async () => {
    const res = await fetch(`/api/bots/${name}/logs?tail=100`);
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs);
    }
  }, [name]);

  useEffect(() => {
    Promise.all([fetchBot(), fetchLogs()]).finally(() => setLoading(false));
    const interval = setInterval(() => {
      fetchBot();
      fetchLogs();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchBot, fetchLogs]);

  async function handleRestart() {
    setActionLoading("restart");
    setError(null);
    try {
      const res = await fetch(`/api/bots/${name}/restart`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      await fetchBot();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Restart failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete bot "${name}"? This cannot be undone.`)) return;
    setActionLoading("delete");
    setError(null);
    try {
      const res = await fetch(`/api/bots/${name}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      router.push("/bots");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return <p className="text-gray-500">Loading...</p>;
  }

  if (!bot) {
    return <p className="text-red-600">Bot not found.</p>;
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">
            {bot.personaName}
          </h1>
          <StatusBadge status={bot.status} />
        </div>
        <div className="flex gap-2">
          <Link
            href={`/bots/${name}/edit`}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Edit
          </Link>
          <button
            onClick={handleRestart}
            disabled={actionLoading !== null}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {actionLoading === "restart" ? "Restarting..." : "Restart"}
          </button>
          <button
            onClick={handleDelete}
            disabled={actionLoading !== null}
            className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {actionLoading === "delete" ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Configuration
        </h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-gray-500">Container</dt>
            <dd className="text-sm font-mono text-gray-900">{bot.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Model</dt>
            <dd className="text-sm text-gray-900">{bot.claudeModel}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Owner Chat ID</dt>
            <dd className="text-sm font-mono text-gray-900">
              {bot.ownerChatId}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Auth Mode</dt>
            <dd className="text-sm text-gray-900">{bot.authMode}</dd>
          </div>
          {bot.groupChatId && (
            <div>
              <dt className="text-sm text-gray-500">Group Chat ID</dt>
              <dd className="text-sm font-mono text-gray-900">
                {bot.groupChatId}
              </dd>
            </div>
          )}
          {bot.nellieUrl && (
            <div>
              <dt className="text-sm text-gray-500">Nellie</dt>
              <dd className="text-sm text-gray-900">{bot.nellieUrl}</dd>
            </div>
          )}
          {bot.beercanUrl && (
            <div>
              <dt className="text-sm text-gray-500">Beer Can</dt>
              <dd className="text-sm text-gray-900">{bot.beercanUrl}</dd>
            </div>
          )}
          {bot.createdAt && (
            <div>
              <dt className="text-sm text-gray-500">Created</dt>
              <dd className="text-sm text-gray-900">
                {new Date(bot.createdAt).toLocaleString()}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Logs</h2>
          <button
            onClick={fetchLogs}
            className="text-sm text-blue-600 hover:text-blue-500"
          >
            Refresh
          </button>
        </div>
        <pre className="max-h-96 overflow-auto rounded-md bg-gray-900 p-4 text-xs text-gray-100 font-mono">
          {logs.length > 0 ? logs.join("\n") : "No logs available."}
        </pre>
        <p className="mt-2 text-xs text-gray-400">
          CLI: az containerapp logs show -n {name} -g bottery-rg --tail 100
        </p>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import type { Bot } from "@/lib/bottery/types";
import { StatusBadge } from "./status-badge";

export function BotCard({ bot }: { bot: Bot }) {
  return (
    <Link
      href={`/bots/${bot.name}`}
      className="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {bot.personaName}
        </h3>
        <StatusBadge status={bot.status} />
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-gray-500">Model</dt>
        <dd className="text-gray-900">{bot.claudeModel}</dd>
        <dt className="text-gray-500">Owner</dt>
        <dd className="text-gray-900 font-mono">{bot.ownerChatId}</dd>
        <dt className="text-gray-500">Auth</dt>
        <dd className="text-gray-900">{bot.authMode}</dd>
        {bot.nellieUrl && (
          <>
            <dt className="text-gray-500">Nellie</dt>
            <dd className="text-green-600">Connected</dd>
          </>
        )}
        {bot.beercanUrl && (
          <>
            <dt className="text-gray-500">Beer Can</dt>
            <dd className="text-green-600">Connected</dd>
          </>
        )}
      </dl>
      {bot.updatedAt && (
        <p className="mt-4 text-xs text-gray-400">
          Updated {new Date(bot.updatedAt).toLocaleString()}
        </p>
      )}
    </Link>
  );
}

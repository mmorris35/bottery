import Link from "next/link";
import { listBots } from "@/lib/azure/container-apps";
import { BotCard } from "@/components/bot-card";

export const dynamic = "force-dynamic";

export default async function BotsPage() {
  let bots: Awaited<ReturnType<typeof listBots>> = [];
  let error: string | null = null;

  try {
    bots = await listBots();
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : "Failed to load bots";
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Bots</h1>
        <Link
          href="/bots/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
        >
          Create Bot
        </Link>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 mb-6">
          {error}
        </div>
      )}

      {bots.length === 0 && !error ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No bots deployed yet.</p>
          <Link
            href="/bots/new"
            className="text-blue-600 hover:text-blue-500 font-medium"
          >
            Create your first bot
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bots.map((bot) => (
            <BotCard key={bot.name} bot={bot} />
          ))}
        </div>
      )}
    </div>
  );
}

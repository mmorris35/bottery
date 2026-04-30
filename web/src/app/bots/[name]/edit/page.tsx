"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Bot } from "@/lib/bottery/types";
import { BotForm } from "@/components/bot-form";

export default function EditBotPage() {
  const { name } = useParams<{ name: string }>();
  const [bot, setBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/bots/${name}`)
      .then((r) => r.json())
      .then(setBot)
      .finally(() => setLoading(false));
  }, [name]);

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!bot) return <p className="text-red-600">Bot not found.</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">
        Edit {bot.personaName}
      </h1>
      <BotForm
        mode="edit"
        botName={name}
        initialValues={{
          personaName: bot.personaName,
          claudeModel: bot.claudeModel,
          ownerChatId: bot.ownerChatId,
          groupChatId: bot.groupChatId ?? "",
        }}
      />
    </div>
  );
}

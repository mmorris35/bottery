import { BotForm } from "@/components/bot-form";

export default function NewBotPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Create Bot</h1>
      <BotForm mode="create" />
    </div>
  );
}

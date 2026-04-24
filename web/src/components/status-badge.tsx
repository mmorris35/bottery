import type { BotStatus } from "@/lib/bottery/types";

const styles: Record<BotStatus, string> = {
  Running: "bg-green-100 text-green-800",
  Provisioning: "bg-yellow-100 text-yellow-800",
  Stopped: "bg-gray-100 text-gray-800",
  Failed: "bg-red-100 text-red-800",
  Unknown: "bg-gray-100 text-gray-500",
};

export function StatusBadge({ status }: { status: BotStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}

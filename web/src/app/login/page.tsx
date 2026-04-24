import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Bottery</h1>
        <p className="text-gray-500">
          Bot factory — deploy Telegram bots powered by Claude Code
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id", { redirectTo: "/bots" });
          }}
        >
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            Sign in with Microsoft
          </button>
        </form>
      </div>
    </div>
  );
}

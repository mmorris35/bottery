import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listBots, createBot } from "@/lib/azure/container-apps";
import { z } from "zod";

const CreateBotSchema = z.object({
  personaName: z.string().min(1).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  personaContent: z.string().min(1),
  telegramBotToken: z.string().min(1),
  ownerChatId: z.string().min(1),
  claudeModel: z.string().default("claude-opus-4-6"),
  authMode: z.enum(["api-key", "login"]),
  anthropicApiKey: z.string().optional(),
  credentialsB64: z.string().optional(),
  groupChatId: z.string().optional(),
  nellieUrl: z.string().url().optional().or(z.literal("")),
  beercanUrl: z.string().url().optional().or(z.literal("")),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bots = await listBots();
  return NextResponse.json(bots);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = CreateBotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const bot = await createBot(parsed.data);
    return NextResponse.json(bot, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

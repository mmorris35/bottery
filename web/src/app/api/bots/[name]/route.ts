import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBot, updateBot, deleteBot } from "@/lib/azure/container-apps";
import { z } from "zod";

const UpdateBotSchema = z.object({
  claudeModel: z.string().optional(),
  personaContent: z.string().optional(),
  groupChatId: z.string().optional(),
  nellieUrl: z.string().optional(),
  beercanUrl: z.string().optional(),
  teamworkApiToken: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await params;
  const bot = await getBot(name);
  if (!bot) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(bot);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await params;
  const body = await req.json();
  const parsed = UpdateBotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await updateBot(name, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await params;
  try {
    await deleteBot(name);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { fetchPlayerState } from "@/lib/syndicate-api";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ username: string }> },
) {
  try {
    const { username } = await context.params;
    if (!username?.trim()) {
      return NextResponse.json({ error: "Username required." }, { status: 400 });
    }

    const player = await fetchPlayerState(username.trim());
    return NextResponse.json(player);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load player.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

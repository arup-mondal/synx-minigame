import { NextResponse } from "next/server";
import { getDailyWagerUses, getNextDailyResetAt } from "@/lib/daily-wager-limit";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ username: string }> },
) {
  try {
    const { username } = await context.params;
    if (!username?.trim()) {
      return NextResponse.json({ error: "Username required." }, { status: 400 });
    }

    const usedTiers = await getDailyWagerUses(username.trim());
    return NextResponse.json(
      {
        usedTiers,
        resetAt: getNextDailyResetAt(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json({ error: "Failed to load daily limits." }, { status: 500 });
  }
}

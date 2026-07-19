import { NextResponse } from "next/server";
import { getNextDailyResetAt, resetDailyWagerUses } from "@/lib/daily-wager-limit";
import { resetDevWallet } from "@/lib/dev-wallet";
import { isLocalDev } from "@/lib/local-dev";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isLocalDev()) {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
  }

  try {
    const body = (await request.json()) as { username?: string };
    const username = body.username?.trim();
    if (!username) {
      return NextResponse.json({ error: "Username required." }, { status: 400 });
    }

    const wallet = await resetDevWallet(username);
    const usedTiers = await resetDailyWagerUses(username);

    return NextResponse.json({
      ok: true,
      wallet,
      dailyLimits: {
        usedTiers,
        resetAt: getNextDailyResetAt(),
      },
      message: "Dev wallet and daily limits reset.",
    });
  } catch {
    return NextResponse.json({ error: "Reset failed." }, { status: 500 });
  }
}

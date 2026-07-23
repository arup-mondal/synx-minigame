import { NextResponse } from "next/server";
import { getWagerTier, type DropNodeId, type WagerTier } from "@/lib/game-config";
import { isDailyWagerAvailable, recordDailyWagerUse } from "@/lib/daily-wager-limit";
import { resolveDeadDrop } from "@/lib/dead-drop-engine";
import { applyDevWalletTransaction, getDevWallet } from "@/lib/dev-wallet";
import { isLocalDev } from "@/lib/local-dev";
import { fetchPlayerState, settlePlayResult } from "@/lib/syndicate-api";
import { hasSyndicateZoneAccess, isZoneUnlocked } from "@/lib/unlocked-zones";

export const dynamic = "force-dynamic";

interface PlayRequestBody {
  username: string;
  tier: WagerTier;
  pickNode: DropNodeId;
  runId: string;
}

const processedRuns = new Set<string>();

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PlayRequestBody;
    const { username, tier, pickNode, runId } = body;

    if (!username || !tier || !pickNode || !runId) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    if (processedRuns.has(runId)) {
      return NextResponse.json({ error: "Run already processed." }, { status: 409 });
    }

    const tierConfig = getWagerTier(tier);

    let player;
    try {
      player = await fetchPlayerState(username);
    } catch {
      return NextResponse.json({ error: "Could not load player profile." }, { status: 404 });
    }

    if (!hasSyndicateZoneAccess(player.unlockedZones)) {
      return NextResponse.json(
        { error: "Unlock at least one zone in Syndicate City to play Dead Drop." },
        { status: 403 },
      );
    }

    if (!isZoneUnlocked(pickNode, player.unlockedZones)) {
      return NextResponse.json(
        { error: "Zone is locked. Unlock it in Syndicate City first." },
        { status: 403 },
      );
    }

    const wallet = isLocalDev() ? await getDevWallet(username) : null;
    const availableTokens = wallet?.tokens ?? player.tokens;

    if (availableTokens < tierConfig.costTokens) {
      return NextResponse.json({ error: "Insufficient Tokens." }, { status: 402 });
    }

    if (!(await isDailyWagerAvailable(username, tier))) {
      return NextResponse.json(
        { error: "Daily limit reached for this wager tier. Resets at midnight UTC." },
        { status: 429 },
      );
    }

    await recordDailyWagerUse(username, tier);
    processedRuns.add(runId);
    const outcome = resolveDeadDrop(tier, pickNode, runId);

    let tokenDelta = -tierConfig.costTokens;
    let synxDelta = 0;

    if (outcome.won && outcome.payoutAmount > 0) {
      if (outcome.payoutCurrency === "tokens") tokenDelta += outcome.payoutAmount;
      if (outcome.payoutCurrency === "synx") synxDelta += outcome.payoutAmount;
    }

    if (isLocalDev()) {
      await applyDevWalletTransaction(username, { tokenDelta, synxDelta });
    } else {
      // Best-effort: balances stay optimistic client-side even if this fails,
      // per the current production caveat — failure is logged, not thrown.
      await settlePlayResult({
        username,
        runId,
        tier,
        costTokens: tierConfig.costTokens,
        tokenDelta,
        synxDelta,
        won: outcome.won,
        payoutLabel: outcome.payoutLabel,
      });
    }

    return NextResponse.json({
      ...outcome,
      costTokens: tierConfig.costTokens,
      usedTier: tier,
    });
  } catch {
    return NextResponse.json({ error: "Play failed." }, { status: 500 });
  }
}

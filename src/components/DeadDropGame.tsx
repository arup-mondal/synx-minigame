"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatSynx,
  formatTokens,
  GAME_CONFIG,
  WAGER_TIERS,
  type DropNodeId,
  type WagerTier,
} from "@/lib/game-config";
import type { DropOutcome } from "@/lib/dead-drop-engine";
import { createRunId } from "@/lib/dead-drop-engine";
import type { PlayerGameState } from "@/lib/syndicate-api";
import { isZoneUnlocked, unlockedZoneCount, totalZoneCount } from "@/lib/unlocked-zones";
import { ResultModal } from "@/components/ResultModal";
import { WireNetwork } from "@/components/WireNetwork";

interface DeadDropGameProps {
  username: string;
}

type GamePhase = "idle" | "running" | "result";

interface DailyWagerLimits {
  usedTiers: WagerTier[];
  resetAt: string;
}

export function DeadDropGame({ username }: DeadDropGameProps) {
  const [player, setPlayer] = useState<PlayerGameState | null>(null);
  const [dailyLimits, setDailyLimits] = useState<DailyWagerLimits>({ usedTiers: [], resetAt: "" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<WagerTier>("street");
  const [selectedNode, setSelectedNode] = useState<DropNodeId | null>(null);
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<DropOutcome | null>(null);
  const [activeHop, setActiveHop] = useState<DropNodeId | null>(null);
  const [hopTrail, setHopTrail] = useState<DropNodeId[]>([]);

  const tierConfig = useMemo(
    () => WAGER_TIERS.find((t) => t.id === selectedTier)!,
    [selectedTier],
  );

  const refreshPlayer = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const playerUrl = `/api/player/${encodeURIComponent(username)}`;
      const limitsUrl = `/api/player/${encodeURIComponent(username)}/limits`;

      const [playerResponse, limitsResponse] = await Promise.all([
        fetch(playerUrl, { credentials: "include", cache: "no-store" }),
        fetch(limitsUrl, { credentials: "include", cache: "no-store" }),
      ]);

      const data = (await playerResponse.json()) as PlayerGameState & { error?: string };

      if (!playerResponse.ok) {
        throw new Error(data.error ?? "Failed to load player.");
      }

      if (limitsResponse.ok) {
        const limits = (await limitsResponse.json()) as DailyWagerLimits;
        setDailyLimits(limits);
      }

      setPlayer(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load player.");
      setPlayer(null);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    refreshPlayer();
  }, [refreshPlayer]);

  useEffect(() => {
    if (selectedNode && player && !isZoneUnlocked(selectedNode, player.unlockedZones)) {
      setSelectedNode(null);
    }
  }, [selectedNode, player]);

  const tierUsedToday = dailyLimits.usedTiers.includes(selectedTier);
  const canAfford = player !== null && player.tokens >= tierConfig.costTokens;
  const canRun =
    canAfford && selectedNode !== null && phase === "idle" && !loading && !tierUsedToday;

  function applyOutcomeLocally(
    current: PlayerGameState,
    costTokens: number,
    result: DropOutcome,
  ): PlayerGameState {
    let tokens = current.tokens - costTokens;
    let synx = current.synx;

    if (result.won && result.payoutAmount > 0) {
      if (result.payoutCurrency === "tokens") tokens += result.payoutAmount;
      if (result.payoutCurrency === "synx") synx += result.payoutAmount;
    }

    return { ...current, tokens: Math.max(0, tokens), synx };
  }

  async function handleIntercept() {
    if (!selectedNode || !canAfford || !player) return;

    setError(null);
    setOutcome(null);
    setPhase("running");

    const runId = createRunId(username);

    const response = await fetch("/api/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        username,
        tier: selectedTier,
        pickNode: selectedNode,
        runId,
      }),
    });

    const data = (await response.json()) as DropOutcome & {
      error?: string;
      costTokens?: number;
    };

    if (!response.ok) {
      setPhase("idle");
      setError(data.error ?? "Intercept failed.");
      return;
    }

    setHopTrail(data.hopTrail);
    await animateHops(data.hopTrail);

    setPlayer(applyOutcomeLocally(player, tierConfig.costTokens, data));
    setDailyLimits((current) => ({
      ...current,
      usedTiers: current.usedTiers.includes(selectedTier)
        ? current.usedTiers
        : [...current.usedTiers, selectedTier],
    }));
    setOutcome(data);
    setPhase("result");
  }

  async function animateHops(trail: DropNodeId[]) {
    for (const node of trail) {
      setActiveHop(node);
      await wait(220);
    }
    setActiveHop(null);
    await wait(400);
  }

  function closeResult() {
    setOutcome(null);
    setPhase("idle");
    setHopTrail([]);
    setActiveHop(null);
  }

  async function handleDevReset() {
    setError(null);
    const response = await fetch("/api/dev/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = (await response.json()) as {
      error?: string;
      wallet?: { tokens: number; synx: number };
      dailyLimits?: DailyWagerLimits;
    };
    if (!response.ok) {
      setError(data.error ?? "Dev reset failed.");
      return;
    }

    setPhase("idle");
    setOutcome(null);
    setSelectedNode(null);
    setHopTrail([]);
    setActiveHop(null);

    if (data.dailyLimits) {
      setDailyLimits(data.dailyLimits);
    } else {
      setDailyLimits({ usedTiers: [], resetAt: "" });
    }

    if (data.wallet && player) {
      setPlayer({ ...player, tokens: data.wallet.tokens, synx: data.wallet.synx });
    }

    await refreshPlayer();
  }

  if (loading && !player) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="font-label text-sm text-stone-500">Loading operative profile...</p>
      </div>
    );
  }

  if (loadError || !player) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-red-300">{loadError ?? "Player not found."}</p>
        <button
          type="button"
          onClick={refreshPlayer}
          className="rounded border border-stone-600 px-4 py-2 text-xs uppercase tracking-widest text-stone-300 hover:border-amber-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!player.canPlay) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-amber-500/80">Iron Row · Wire Tap</p>
        <h1 className="font-display text-3xl text-stone-100">{GAME_CONFIG.name}</h1>
        <p className="text-sm text-stone-400">
          Dead Drop is locked. You need at least one unlocked zone beyond Iron Row in Syndicate City.
        </p>
        <a
          href="https://syndicate-protocol.com/game"
          className="rounded-lg border border-amber-700/50 bg-amber-950/20 px-5 py-3 text-xs font-bold uppercase tracking-widest text-amber-300 hover:bg-amber-950/40"
          target="_blank"
          rel="noreferrer"
        >
          Unlock a zone in Syndicate City
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      {player.devMode && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-700/40 bg-amber-950/20 px-4 py-3">
          <p className="text-xs uppercase tracking-widest text-amber-400">
            Local dev mode · fake wallet (50k Tokens, 100 SYNX)
          </p>
          <button
            type="button"
            onClick={handleDevReset}
            disabled={phase !== "idle"}
            className="rounded border border-amber-700/50 px-3 py-1 text-xs uppercase tracking-widest text-amber-300 hover:bg-amber-950/40 disabled:opacity-40"
          >
            Reset wallet &amp; daily limits
          </button>
        </div>
      )}
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-stone-800 pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-amber-500/80">Iron Row · Wire Tap</p>
          <h1 className="font-display text-4xl text-stone-100">{GAME_CONFIG.name}</h1>
          <p className="mt-1 max-w-xl text-sm text-stone-400">{GAME_CONFIG.tagline}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-widest text-stone-500">Operative · Lv {player.level}</p>
          <p className="font-mono text-lg text-amber-400">@{player.username}</p>
          <p className="mt-1 text-sm text-stone-400">{formatTokens(player.tokens)}</p>
          <p className="text-sm text-stone-500">{formatSynx(player.synx)}</p>
          <p className="mt-1 text-xs text-stone-600">
            Zones {unlockedZoneCount(player.unlockedZones)}/{totalZoneCount()} unlocked
          </p>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
        <aside className="space-y-3">
          <p className="text-xs uppercase tracking-[0.35em] text-stone-500">Set your wager</p>
          <p className="text-xs text-stone-600">
            {GAME_CONFIG.dailyTriesPerTier} intercept per tier per UTC day
          </p>
          {WAGER_TIERS.map((tier) => {
            const usedToday = dailyLimits.usedTiers.includes(tier.id);
            return (
            <button
              key={tier.id}
              type="button"
              onClick={() => setSelectedTier(tier.id)}
              disabled={phase !== "idle"}
              className={`w-full rounded-xl border p-4 text-left transition ${
                selectedTier === tier.id
                  ? "border-amber-600/70 bg-amber-950/30 shadow-lg shadow-amber-950/20"
                  : usedToday
                    ? "border-stone-900 bg-stone-950/30 opacity-60"
                    : "border-stone-800 bg-stone-950/50 hover:border-stone-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-stone-100">{tier.label}</span>
                <span className="font-mono text-sm text-amber-400">
                  {formatTokens(tier.costTokens)}
                </span>
              </div>
              <p className="mt-1 text-xs text-stone-400">{tier.description}</p>
              <p className="mt-2 text-xs text-stone-500">
                ~{tier.interceptChancePercent}% intercept · Rare SYNX up to{" "}
                {tier.payouts.filter((p) => p.currency === "synx").at(-1)?.amount ?? 0} in-game
              </p>
              {usedToday && (
                <p className="mt-2 text-xs uppercase tracking-widest text-red-400/80">
                  Used today · resets midnight UTC
                </p>
              )}
            </button>
            );
          })}
        </aside>

        <section className="rounded-2xl border border-stone-800 bg-gradient-to-b from-stone-950 to-black p-6 shadow-2xl sm:p-8">
          <WireNetwork
            activeNode={activeHop}
            landingNode={outcome?.landingNode ?? null}
            hopTrail={hopTrail}
            playerPick={selectedNode}
            unlockedZones={player.unlockedZones}
            running={phase === "running"}
            onSelectNode={setSelectedNode}
            disabled={phase !== "idle"}
          />

          <div className="mt-6 rounded-xl border border-stone-800 bg-black/40 p-4">
            <p className="text-xs uppercase tracking-widest text-stone-500">How it works</p>
            <ol className="mt-2 space-y-1 text-sm text-stone-400">
              <li>1. Tap an unlocked zone on the wire.</li>
              <li>2. Stake {formatTokens(tierConfig.costTokens)} from your in-game balance.</li>
              <li>3. Watch the courier signal route across Syndicate City.</li>
              <li>4. If it lands on your zone, you skim Tokens or in-game SYNX.</li>
              <li>5. One intercept per wager tier per UTC day.</li>
            </ol>
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleIntercept}
            disabled={!canRun}
            className="mt-6 w-full rounded-lg bg-gradient-to-r from-amber-700 via-amber-800 to-red-950 px-6 py-4 text-sm font-bold uppercase tracking-[0.25em] text-stone-100 transition hover:from-amber-600 hover:to-red-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {phase === "running"
              ? "Routing signal..."
              : `Intercept — ${formatTokens(tierConfig.costTokens)}`}
          </button>

          {!selectedNode && phase === "idle" && (
            <p className="mt-3 text-center text-xs text-stone-500">
              Pick an unlocked zone on the wire first.
            </p>
          )}
          {selectedNode && !canAfford && !tierUsedToday && (
            <p className="mt-3 text-center text-xs text-stone-500">Not enough Tokens.</p>
          )}
          {selectedNode && tierUsedToday && phase === "idle" && (
            <p className="mt-3 text-center text-xs text-stone-500">
              {tierConfig.label} already used today. Pick another tier or come back after midnight UTC.
            </p>
          )}
        </section>
      </div>

      <ResultModal
        outcome={outcome}
        costTokens={tierConfig.costTokens}
        onClose={closeResult}
      />
    </div>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

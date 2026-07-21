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
import { ResultPanel } from "@/components/ResultPanel";
import { WireNetwork } from "@/components/WireNetwork";

interface DeadDropGameProps {
  username: string;
}

type GamePhase = "idle" | "running" | "result";

interface DailyWagerLimits {
  usedTiers: WagerTier[];
  resetAt: string;
}

const TIER_ACCENT: Record<WagerTier, string> = {
  street: "#2dd4bf",
  crew: "#38bdf8",
  boss: "#f59e0b",
  kingpin: "#f87171",
};

export function DeadDropGame({ username }: DeadDropGameProps) {
  const [player, setPlayer] = useState<PlayerGameState | null>(null);
  const [dailyLimits, setDailyLimits] = useState<DailyWagerLimits>({ usedTiers: [], resetAt: "" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<WagerTier | null>(null);
  const [selectedNode, setSelectedNode] = useState<DropNodeId | null>(null);
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<DropOutcome | null>(null);
  const [activeHop, setActiveHop] = useState<DropNodeId | null>(null);
  const [hopTrail, setHopTrail] = useState<DropNodeId[]>([]);

  const tierConfig = useMemo(
    () => (selectedTier ? WAGER_TIERS.find((t) => t.id === selectedTier)! : null),
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

  const tierUsedToday = selectedTier !== null && dailyLimits.usedTiers.includes(selectedTier);
  const canAfford = player !== null && tierConfig !== null && player.tokens >= tierConfig.costTokens;
  const canRun =
    canAfford && selectedNode !== null && phase === "idle" && !loading && !tierUsedToday;
  const stepNumber = !selectedTier ? 1 : phase === "idle" ? 2 : 3;

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
    if (!selectedNode || !canAfford || !player || !selectedTier || !tierConfig) return;

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
    setSelectedTier(null);
    setSelectedNode(null);
  }

  function handleChangeWager() {
    if (phase !== "idle") return;
    setSelectedTier(null);
    setSelectedNode(null);
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
    setSelectedTier(null);
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
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <span className="preloader-spin absolute inset-0 rounded-full border border-dashed border-amber-700/40" />
          <span className="absolute inset-1 animate-[ping_2.2s_cubic-bezier(0,0,0.2,1)_infinite] rounded-full border-2 border-amber-500/50" />
          <div
            className="h-16 w-16 overflow-hidden rounded-full border border-amber-700/50 shadow-[0_0_28px_rgba(217,119,6,0.35)]"
            style={{
              backgroundImage: "url(/syndicate.png)",
              backgroundSize: "150%",
              backgroundPosition: "center",
            }}
          />
        </div>
        <p className="font-label flex items-center gap-2 text-sm text-stone-500">
          <span className="wire-live-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Loading operative profile...
        </p>
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

      <div className="mb-8 flex items-center justify-center gap-0 overflow-x-auto rounded-xl border border-stone-800 bg-stone-950/40 px-4 py-3">
        {(["Stake", "Target", "Result"] as const).map((label, i) => {
          const n = i + 1;
          const state = n < stepNumber ? "done" : n === stepNumber ? "active" : "pending";
          return (
            <div key={label} className="flex flex-shrink-0 items-center">
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold transition-colors duration-300 ${
                    state === "done"
                      ? "border border-emerald-400 bg-emerald-400/15 text-emerald-400"
                      : state === "active"
                        ? "border border-amber-400 bg-amber-400/20 text-amber-300 shadow-[0_0_0_3px_rgba(251,191,36,0.14)]"
                        : "border border-stone-700 text-stone-500"
                  }`}
                >
                  {state === "done" ? "✓" : n}
                </span>
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.2em] transition-colors duration-300 ${
                    state === "done"
                      ? "text-emerald-400"
                      : state === "active"
                        ? "text-amber-300"
                        : "text-stone-500"
                  }`}
                >
                  {label}
                </span>
              </div>
              {n < 3 && (
                <span
                  className={`mx-3 h-px w-9 flex-shrink-0 transition-colors duration-300 ${n < stepNumber ? "bg-emerald-400/50" : "bg-stone-800"}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {!selectedTier ? (
        <div key="stake-step" className="animate-fade-up mx-auto max-w-2xl">
          <p className="mb-1 text-center text-xs uppercase tracking-[0.35em] text-stone-500">
            Set your wager
          </p>
          <p className="mb-6 text-center text-xs text-stone-600">
            {GAME_CONFIG.dailyTriesPerTier} intercept per tier per UTC day
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {WAGER_TIERS.map((tier) => {
              const usedToday = dailyLimits.usedTiers.includes(tier.id);
              const accent = TIER_ACCENT[tier.id];

              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSelectedTier(tier.id)}
                  disabled={usedToday}
                  style={{ borderColor: usedToday ? undefined : `${accent}55` }}
                  className={`wager-card group relative overflow-hidden border p-4 pt-5 text-left transition ${
                    usedToday
                      ? "border-stone-900 bg-stone-950/30"
                      : "bg-stone-950/60 hover:bg-stone-950/80"
                  }`}
                >
                  {!usedToday && (
                    <>
                      <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: accent }} />
                      <span className="wager-card-grid pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    </>
                  )}

                  {usedToday && (
                    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                      <div className="flex h-20 w-20 -rotate-12 items-center justify-center rounded-full border-2 border-red-500/70 bg-stone-950 shadow-[0_2px_14px_rgba(0,0,0,0.6)]">
                        <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full border border-dashed border-red-500/40">
                          <span className="font-mono text-[10px] font-bold uppercase leading-none tracking-wider text-red-400">
                            Used
                          </span>
                          <span className="mt-1 font-mono text-[9px] font-bold uppercase leading-none tracking-wider text-red-400/70">
                            Today
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className={usedToday ? "opacity-40" : ""}>
                    <div className="relative flex items-start justify-between gap-2">
                      <span className="font-display text-sm text-stone-100">{tier.label}</span>
                    </div>

                    <p className="relative mt-3 text-xs leading-relaxed text-stone-400">{tier.description}</p>

                    <p className="relative mt-3 font-mono text-[10px] uppercase tracking-[0.15em] text-stone-600">
                      {usedToday ? 1 : 0}/{GAME_CONFIG.dailyTriesPerTier} intercepts used today
                    </p>

                    <div className="relative mt-4 flex items-center justify-between gap-2">
                      <span
                        className="rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-wider"
                        style={{
                          borderColor: usedToday ? "#44403c" : `${accent}55`,
                          color: usedToday ? "#78716c" : accent,
                        }}
                      >
                        {usedToday ? "Locked" : formatTokens(tier.costTokens)}
                      </span>
                      {!usedToday && (
                        <span className="rounded bg-stone-800/80 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-stone-300 opacity-70 transition-opacity group-hover:opacity-100">
                          Select
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div key="target-step" className="animate-fade-up mx-auto max-w-2xl">
          <div className="mb-4 flex items-center justify-between rounded-xl border border-stone-800 bg-stone-950/40 px-4 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Wager</p>
              <p className="text-sm font-semibold text-stone-100">
                {tierConfig?.label}{" "}
                <span className="font-mono text-amber-400">
                  · {formatTokens(tierConfig?.costTokens ?? 0)}
                </span>
              </p>
            </div>
            {phase === "idle" && (
              <button
                type="button"
                onClick={handleChangeWager}
                className="text-xs uppercase tracking-widest text-stone-500 hover:text-amber-400"
              >
                Change
              </button>
            )}
          </div>

          <section className="rounded-2xl border border-stone-800 bg-gradient-to-b from-stone-950 to-black p-6 shadow-2xl sm:p-8">
            {phase === "result" && outcome ? (
              <ResultPanel outcome={outcome} costTokens={tierConfig?.costTokens ?? 0} onClose={closeResult} />
            ) : (
              <>
                <p className="mb-4 text-xs uppercase tracking-[0.35em] text-stone-500">
                  Pick intercept node
                </p>
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
                    : tierConfig
                      ? `Intercept — ${formatTokens(tierConfig.costTokens)}`
                      : "Select a wager tier"}
                </button>

                {!selectedNode && phase === "idle" && (
                  <p className="mt-3 text-center text-xs text-stone-500">
                    Pick an unlocked zone on the wire first.
                  </p>
                )}
                {selectedNode && tierConfig && !canAfford && !tierUsedToday && (
                  <p className="mt-3 text-center text-xs text-stone-500">Not enough Tokens.</p>
                )}
                {selectedNode && tierConfig && tierUsedToday && phase === "idle" && (
                  <p className="mt-3 text-center text-xs text-stone-500">
                    {tierConfig.label} already used today. Pick another tier or come back after midnight UTC.
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

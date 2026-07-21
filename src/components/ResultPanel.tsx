"use client";

import type { DropOutcome } from "@/lib/dead-drop-engine";
import { formatSynx, formatTokens } from "@/lib/game-config";

interface ResultPanelProps {
  outcome: DropOutcome;
  costTokens: number;
  onClose: () => void;
}

export function ResultPanel({ outcome, costTokens, onClose }: ResultPanelProps) {
  const payoutText =
    outcome.won && outcome.payoutCurrency === "tokens"
      ? formatTokens(outcome.payoutAmount)
      : outcome.won && outcome.payoutCurrency === "synx"
        ? formatSynx(outcome.payoutAmount)
        : formatTokens(costTokens);

  return (
    <div
      className={`animate-modal-pop relative flex aspect-[16/10] flex-col items-center justify-center overflow-hidden rounded-xl border p-6 text-center sm:p-8 ${
        outcome.won
          ? "border-amber-500/50 bg-gradient-to-b from-amber-950/60 to-stone-950"
          : "border-stone-700 bg-stone-950"
      }`}
    >
      <p className="text-xs uppercase tracking-[0.35em] text-stone-500">
        {outcome.won ? "Intercepted" : "Signal Lost"}
      </p>
      <h3 className="font-display mt-3 text-2xl text-stone-100">
        {outcome.won ? outcome.payoutLabel : "Courier Escaped"}
      </h3>
      <p className="mt-4 text-3xl font-bold tabular-nums text-amber-400">
        {outcome.won ? `+${payoutText.replace(" Tokens", "").replace(" SYNX (in-game)", "")}` : `−${costTokens}`}
        <span className="ml-2 text-lg font-normal text-stone-400">
          {outcome.won ? (outcome.payoutCurrency === "synx" ? "SYNX (in-game)" : "Tokens") : "Tokens"}
        </span>
      </p>
      <p className="mt-4 max-w-sm text-sm text-stone-400">
        {outcome.won
          ? outcome.payoutCurrency === "synx"
            ? "SYNX credited to your in-game ledger. Withdraw to Hive-Engine when ready."
            : "Tokens added to your in-game balance."
          : `Courier landed on a different node. ${costTokens} Tokens spent.`}
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-8 rounded-lg border border-stone-600 px-6 py-2 text-sm uppercase tracking-widest text-stone-200 transition hover:border-amber-600 hover:text-amber-300"
      >
        Run it back
      </button>
    </div>
  );
}

export type WagerTier = "street" | "crew" | "boss" | "kingpin";

export type DropNodeId =
  | "iron-row"
  | "velvet-square"
  | "neon-bazaar"
  | "ember-ward"
  | "glass-district"
  | "throne-heights"
  | "void-reach"
  | "apex-enclave";

export type PayoutCurrency = "tokens" | "synx";

export interface DropNode {
  id: DropNodeId;
  label: string;
  codename: string;
  heat: number;
  accent: string;
  x: number;
  y: number;
}

export interface WagerTierConfig {
  id: WagerTier;
  label: string;
  costTokens: number;
  description: string;
  /** Chance courier lands on your chosen node */
  interceptChancePercent: number;
  payouts: Array<{
    label: string;
    currency: PayoutCurrency;
    amount: number;
    weight: number;
  }>;
}

export const GAME_CONFIG = {
  name: "Dead Drop",
  tagline: "Pick the wire. Stake your Tokens. Intercept the courier before the signal dies.",
  inGameTokenName: "Tokens",
  /** In-game SYNX ledger — not on-chain until withdrawn */
  synxLedgerName: "SYNX",
  memoPrefix: "dead_drop",
  /** Production: Syndicate backend debits/credits in-game balances */
  syndicateApiUrl: process.env.NEXT_PUBLIC_SYNDICATE_API_URL ?? "",
  /** Max intercepts per wager tier per UTC day */
  dailyTriesPerTier: 1,
} as const;

export const DROP_NODES: DropNode[] = [
  { id: "iron-row", label: "Iron Row", codename: "IRON ROW", heat: 2, accent: "#9ca3af", x: 11, y: 74 },
  { id: "velvet-square", label: "Velvet Square", codename: "VELVET SQ", heat: 3, accent: "#c084fc", x: 30, y: 68 },
  { id: "neon-bazaar", label: "Neon Bazaar", codename: "NEON BZR", heat: 4, accent: "#4ade80", x: 38, y: 40 },
  { id: "ember-ward", label: "Ember Ward", codename: "EMBER", heat: 5, accent: "#fb923c", x: 50, y: 64 },
  { id: "glass-district", label: "Glass District", codename: "GLASS", heat: 6, accent: "#22d3ee", x: 54, y: 26 },
  { id: "throne-heights", label: "Throne Heights", codename: "THRONE", heat: 7, accent: "#facc15", x: 68, y: 18 },
  { id: "void-reach", label: "Void Reach", codename: "VOID", heat: 8, accent: "#60a5fa", x: 78, y: 44 },
  { id: "apex-enclave", label: "Apex Enclave", codename: "APEX", heat: 9, accent: "#f87171", x: 88, y: 66 },
];

export const WIRE_EDGES: Array<[DropNodeId, DropNodeId]> = [
  ["iron-row", "velvet-square"],
  ["iron-row", "neon-bazaar"],
  ["velvet-square", "neon-bazaar"],
  ["velvet-square", "ember-ward"],
  ["neon-bazaar", "ember-ward"],
  ["neon-bazaar", "glass-district"],
  ["ember-ward", "glass-district"],
  ["ember-ward", "void-reach"],
  ["glass-district", "throne-heights"],
  ["glass-district", "void-reach"],
  ["throne-heights", "void-reach"],
  ["void-reach", "apex-enclave"],
  ["ember-ward", "apex-enclave"],
];

export const WAGER_TIERS: WagerTierConfig[] = [
  {
    id: "street",
    label: "Street Wager",
    costTokens: 50,
    description: "Low heat. Cheap intercept, slim payout window.",
    interceptChancePercent: 14,
    payouts: [
      { label: "Token Skim", currency: "tokens", amount: 120, weight: 700 },
      { label: "Token Bundle", currency: "tokens", amount: 400, weight: 120 },
      { label: "SYNX Trace", currency: "synx", amount: 2, weight: 8 },
    ],
  },
  {
    id: "crew",
    label: "Crew Wager",
    costTokens: 200,
    description: "Standard syndicate stake. Courier routes get predictable.",
    interceptChancePercent: 18,
    payouts: [
      { label: "Token Skim", currency: "tokens", amount: 450, weight: 800 },
      { label: "Token Bundle", currency: "tokens", amount: 1500, weight: 180 },
      { label: "SYNX Trace", currency: "synx", amount: 8, weight: 15 },
      { label: "SYNX Pouch", currency: "synx", amount: 25, weight: 3 },
    ],
  },
  {
    id: "boss",
    label: "Boss Wager",
    costTokens: 500,
    description: "High stakes intercept. The wire runs hot.",
    interceptChancePercent: 22,
    payouts: [
      { label: "Token Bundle", currency: "tokens", amount: 1200, weight: 900 },
      { label: "Token Vault", currency: "tokens", amount: 4000, weight: 250 },
      { label: "SYNX Pouch", currency: "synx", amount: 20, weight: 40 },
      { label: "SYNX Lockbox", currency: "synx", amount: 75, weight: 8 },
    ],
  },
  {
    id: "kingpin",
    label: "Kingpin Wager",
    costTokens: 1500,
    description: "One shot. Wrong node and the whole block goes dark.",
    interceptChancePercent: 26,
    payouts: [
      { label: "Token Vault", currency: "tokens", amount: 3500, weight: 1000 },
      { label: "SYNX Lockbox", currency: "synx", amount: 60, weight: 120 },
      { label: "SYNX Briefcase", currency: "synx", amount: 200, weight: 25 },
      { label: "SYNX Jackpot", currency: "synx", amount: 500, weight: 4 },
    ],
  },
];

export function getWagerTier(id: WagerTier): WagerTierConfig {
  const tier = WAGER_TIERS.find((t) => t.id === id);
  if (!tier) throw new Error(`Unknown wager tier: ${id}`);
  return tier;
}

export function getDropNode(id: DropNodeId): DropNode {
  const node = DROP_NODES.find((n) => n.id === id);
  if (!node) throw new Error(`Unknown drop node: ${id}`);
  return node;
}

export function formatTokens(amount: number): string {
  return `${amount.toLocaleString()} ${GAME_CONFIG.inGameTokenName}`;
}

export function formatSynx(amount: number, inGame = true): string {
  const suffix = inGame ? " (in-game)" : "";
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 3 })} SYNX${suffix}`;
}

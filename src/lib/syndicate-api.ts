import type { DropNodeId } from "@/lib/game-config";
import { getDevWallet } from "@/lib/dev-wallet";
import { isLocalDev } from "@/lib/local-dev";
import { DEFAULT_UNLOCKED_ZONES, hasSyndicateZoneAccess } from "@/lib/unlocked-zones";

const API_BASE =
  process.env.SYNDICATE_API_URL ??
  process.env.NEXT_PUBLIC_SYNDICATE_API_URL ??
  "https://syndicate-protocol.com";

export interface SyndicatePlayerProfile {
  balance?: number;
  synx?: number;
  synxBalance?: number;
  unlockedZones?: string[];
  level?: number;
  [key: string]: unknown;
}

export interface SyndicatePlayerResponse {
  player: {
    id: string;
    username: string;
    profile: SyndicatePlayerProfile;
  };
}

export interface PlayerGameState {
  username: string;
  tokens: number;
  synx: number;
  unlockedZones: DropNodeId[];
  level: number;
  /** False when player only has Iron Row — must unlock a zone in Syndicate City first */
  canPlay: boolean;
  /** True when running with local dev wallet (NODE_ENV=development only) */
  devMode?: boolean;
}

const VALID_ZONE_IDS = new Set<string>([
  "iron-row",
  "velvet-square",
  "neon-bazaar",
  "ember-ward",
  "glass-district",
  "throne-heights",
  "void-reach",
  "apex-enclave",
]);

export function normalizeUnlockedZones(apiZones: string[] | undefined): DropNodeId[] {
  const fromApi = (apiZones ?? []).filter((z): z is DropNodeId =>
    VALID_ZONE_IDS.has(z),
  );
  const merged = new Set<DropNodeId>([...DEFAULT_UNLOCKED_ZONES, ...fromApi]);
  return Array.from(merged);
}

export function mapPlayerResponse(data: SyndicatePlayerResponse): PlayerGameState {
  const { username, profile } = data.player;
  const tokens = typeof profile.balance === "number" ? profile.balance : 0;
  const synx =
    typeof profile.synxBalance === "number"
      ? profile.synxBalance
      : typeof profile.synx === "number"
        ? profile.synx
        : 0;

  return {
    username,
    tokens,
    synx,
    unlockedZones: normalizeUnlockedZones(profile.unlockedZones),
    level: typeof profile.level === "number" ? profile.level : 1,
    canPlay: hasSyndicateZoneAccess(normalizeUnlockedZones(profile.unlockedZones)),
  };
}

export function getSyndicateApiBase(): string {
  return API_BASE.replace(/\/$/, "");
}

export function getPlayerApiUrl(username: string): string {
  return `${getSyndicateApiBase()}/api/players/${encodeURIComponent(username)}`;
}

export async function fetchPlayerState(
  username: string,
  options?: { cookie?: string | null },
): Promise<PlayerGameState> {
  const url = `${API_BASE}/api/players/${encodeURIComponent(username)}`;
  const headers: HeadersInit = { Accept: "application/json" };
  if (options?.cookie) {
    headers.Cookie = options.cookie;
  }

  const response = await fetch(url, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Player not found: @${username}`);
  }

  const data = (await response.json()) as SyndicatePlayerResponse;
  const player = mapPlayerResponse(data);

  if (isLocalDev()) {
    const wallet = await getDevWallet(username);
    return { ...player, tokens: wallet.tokens, synx: wallet.synx, devMode: true };
  }

  return player;
}

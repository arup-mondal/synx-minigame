import type { DropNodeId } from "@/lib/game-config";
import { getDevWallet } from "@/lib/dev-wallet";
import { isLocalDev } from "@/lib/local-dev";
import { DEFAULT_UNLOCKED_ZONES, hasSyndicateZoneAccess } from "@/lib/unlocked-zones";

const API_BASE =
  process.env.SYNDICATE_API_URL ??
  process.env.NEXT_PUBLIC_SYNDICATE_API_URL ??
  "https://syndicate-protocol.com";

/**
 * Server-to-server credential for the main Syndicate API. Lets Dead Drop's
 * backend fetch a player's balance directly, without depending on the
 * player's browser cookie reaching Dead Drop's origin (unreliable across a
 * cross-subdomain iframe under third-party/partitioned cookie policies).
 * Must never be exposed to the client — no NEXT_PUBLIC_ prefix.
 */
const SERVICE_API_KEY = process.env.SYNDICATE_SERVICE_API_KEY ?? "";

function serviceAuthHeaders(): HeadersInit {
  return SERVICE_API_KEY ? { Authorization: `Bearer ${SERVICE_API_KEY}` } : {};
}

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

/**
 * SYNX balance isn't on the player profile — the main game fetches it live from
 * Hive-Engine via a dedicated endpoint. Falls back to 0 (not thrown) so a
 * missing/unconfigured service key degrades to "no balance" rather than
 * failing the whole player load.
 */
async function fetchSynxBalance(username: string): Promise<number> {
  if (!SERVICE_API_KEY) return 0;

  try {
    const response = await fetch(
      `${API_BASE}/api/player/synx?username=${encodeURIComponent(username)}`,
      {
        headers: { Accept: "application/json", ...serviceAuthHeaders() },
        cache: "no-store",
      },
    );
    if (!response.ok) return 0;
    const data = (await response.json()) as { balance?: number };
    return typeof data.balance === "number" ? data.balance : 0;
  } catch {
    return 0;
  }
}

export async function fetchPlayerState(username: string): Promise<PlayerGameState> {
  const url = `${API_BASE}/api/players/${encodeURIComponent(username)}`;
  const headers: HeadersInit = { Accept: "application/json", ...serviceAuthHeaders() };

  const [response, synxBalance] = await Promise.all([
    fetch(url, { headers, cache: "no-store" }),
    fetchSynxBalance(username),
  ]);

  if (!response.ok) {
    throw new Error(`Player not found: @${username}`);
  }

  const data = (await response.json()) as SyndicatePlayerResponse;
  const player = { ...mapPlayerResponse(data), synx: synxBalance };

  if (isLocalDev()) {
    const wallet = await getDevWallet(username);
    return { ...player, tokens: wallet.tokens, synx: wallet.synx, devMode: true };
  }

  return player;
}

import {
  DROP_NODES,
  WIRE_EDGES,
  getWagerTier,
  type DropNodeId,
  type PayoutCurrency,
  type WagerTier,
} from "@/lib/game-config";

export interface DropOutcome {
  won: boolean;
  intercepted: boolean;
  landingNode: DropNodeId;
  playerPick: DropNodeId;
  payoutLabel: string | null;
  payoutAmount: number;
  payoutCurrency: PayoutCurrency | null;
  hopTrail: DropNodeId[];
  tier: WagerTier;
  runId: string;
}

export function createRunId(username: string): string {
  return `${username.slice(0, 8).toLowerCase()}-${Date.now().toString(36)}`;
}

export function resolveDeadDrop(
  tierId: WagerTier,
  playerPick: DropNodeId,
  runId: string,
  seed?: string,
): DropOutcome {
  const tier = getWagerTier(tierId);
  const roll = seed ? seededUnit(seed) : Math.random();

  const intercepted = roll < tier.interceptChancePercent / 100;
  const landingNode = intercepted
    ? playerPick
    : randomNodeExcept(playerPick, `${runId}:land`);

  const hopTrail = buildHopTrail(landingNode, `${runId}:hops`);

  if (!intercepted) {
    return {
      won: false,
      intercepted: false,
      landingNode,
      playerPick,
      payoutLabel: null,
      payoutAmount: 0,
      payoutCurrency: null,
      hopTrail,
      tier: tierId,
      runId,
    };
  }

  const payoutRoll = seed ? seededUnit(`${seed}:payout`) : Math.random();
  const totalWeight = tier.payouts.reduce((s, p) => s + p.weight, 0);
  let cursor = 0;

  for (const payout of tier.payouts) {
    cursor += payout.weight / totalWeight;
    if (payoutRoll <= cursor) {
      return {
        won: true,
        intercepted: true,
        landingNode,
        playerPick,
        payoutLabel: payout.label,
        payoutAmount: payout.amount,
        payoutCurrency: payout.currency,
        hopTrail,
        tier: tierId,
        runId,
      };
    }
  }

  const fallback = tier.payouts[0];
  return {
    won: true,
    intercepted: true,
    landingNode,
    playerPick,
    payoutLabel: fallback.label,
    payoutAmount: fallback.amount,
    payoutCurrency: fallback.currency,
    hopTrail,
    tier: tierId,
    runId,
  };
}

const WIRE_ADJACENCY = buildWireAdjacency();

function buildWireAdjacency(): Map<DropNodeId, DropNodeId[]> {
  const adj = new Map<DropNodeId, DropNodeId[]>();
  for (const node of DROP_NODES) {
    adj.set(node.id, []);
  }
  for (const [from, to] of WIRE_EDGES) {
    adj.get(from)!.push(to);
    adj.get(to)!.push(from);
  }
  return adj;
}

function buildHopTrail(landingNode: DropNodeId, seed: string): DropNodeId[] {
  const hopCount = 9;
  const path: DropNodeId[] = [landingNode];
  let current = landingNode;

  for (let i = 0; i < hopCount - 1; i += 1) {
    const neighbors = WIRE_ADJACENCY.get(current) ?? [];
    if (neighbors.length === 0) break;

    const next = pickSeeded(neighbors, `${seed}:${i}`);
    path.unshift(next);
    current = next;
  }

  return path;
}

function pickSeeded<T>(items: T[], seed: string): T {
  return items[Math.floor(seededUnit(seed) * items.length)];
}

function randomNodeExcept(except: DropNodeId, seed: string): DropNodeId {
  const pool = DROP_NODES.map((n) => n.id).filter((id) => id !== except);
  return pool[Math.floor(seededUnit(seed) * pool.length)];
}

function seededUnit(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 10000) / 10000;
}

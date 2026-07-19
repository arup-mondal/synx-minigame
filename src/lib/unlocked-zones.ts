import type { DropNodeId } from "@/lib/game-config";
import { DROP_NODES } from "@/lib/game-config";

/** Iron Row is free — always unlocked in main game */
export const DEFAULT_UNLOCKED_ZONES: DropNodeId[] = ["iron-row"];

export function hasSyndicateZoneAccess(unlocked: DropNodeId[]): boolean {
  return unlocked.some((zoneId) => !DEFAULT_UNLOCKED_ZONES.includes(zoneId));
}

export function isZoneUnlocked(zoneId: DropNodeId, unlocked: DropNodeId[]): boolean {
  return unlocked.includes(zoneId);
}

export function unlockedZoneCount(unlocked: DropNodeId[]): number {
  return unlocked.length;
}

export function totalZoneCount(): number {
  return DROP_NODES.length;
}

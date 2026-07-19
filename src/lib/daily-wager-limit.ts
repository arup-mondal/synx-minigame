import { promises as fs } from "fs";
import path from "path";
import type { WagerTier } from "@/lib/game-config";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "daily-wagers.json");

type PlayerDailyRecord = {
  date: string;
  tiers: WagerTier[];
};

type DailyWagerStore = Record<string, PlayerDailyRecord>;

export function getUtcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function getNextDailyResetAt(date = new Date()): string {
  const reset = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
  return reset.toISOString();
}

async function readStore(): Promise<DailyWagerStore> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw) as DailyWagerStore;
  } catch {
    return {};
  }
}

async function writeStore(store: DailyWagerStore): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function getRecord(store: DailyWagerStore, username: string, dateKey: string): PlayerDailyRecord {
  const key = normalizeUsername(username);
  const existing = store[key];
  if (existing?.date === dateKey) return existing;
  return { date: dateKey, tiers: [] };
}

export async function getDailyWagerUses(username: string): Promise<WagerTier[]> {
  const store = await readStore();
  const dateKey = getUtcDateKey();
  return getRecord(store, username, dateKey).tiers;
}

export async function isDailyWagerAvailable(
  username: string,
  tier: WagerTier,
): Promise<boolean> {
  const used = await getDailyWagerUses(username);
  return !used.includes(tier);
}

export async function recordDailyWagerUse(
  username: string,
  tier: WagerTier,
): Promise<void> {
  const store = await readStore();
  const dateKey = getUtcDateKey();
  const key = normalizeUsername(username);
  const record = getRecord(store, username, dateKey);

  if (record.tiers.includes(tier)) {
    throw new Error("Daily wager limit reached for this tier.");
  }

  record.tiers.push(tier);
  store[key] = record;
  await writeStore(store);
}

export async function resetDailyWagerUses(username: string): Promise<WagerTier[]> {
  const store = await readStore();
  const key = normalizeUsername(username);
  delete store[key];
  await writeStore(store);
  return [];
}

import { promises as fs } from "fs";
import path from "path";
import { LOCAL_DEV_DEFAULTS } from "@/lib/local-dev";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "dev-wallets.json");

export interface DevWallet {
  tokens: number;
  synx: number;
}

type DevWalletStore = Record<string, DevWallet>;

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

async function readStore(): Promise<DevWalletStore> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw) as DevWalletStore;
  } catch {
    return {};
  }
}

async function writeStore(store: DevWalletStore): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

export async function getDevWallet(username: string): Promise<DevWallet> {
  const store = await readStore();
  const key = normalizeUsername(username);
  return (
    store[key] ?? {
      tokens: LOCAL_DEV_DEFAULTS.tokens,
      synx: LOCAL_DEV_DEFAULTS.synx,
    }
  );
}

export async function applyDevWalletTransaction(
  username: string,
  delta: { tokenDelta: number; synxDelta: number },
): Promise<DevWallet> {
  const store = await readStore();
  const key = normalizeUsername(username);
  const current = store[key] ?? {
    tokens: LOCAL_DEV_DEFAULTS.tokens,
    synx: LOCAL_DEV_DEFAULTS.synx,
  };

  const next: DevWallet = {
    tokens: Math.max(0, current.tokens + delta.tokenDelta),
    synx: Math.max(0, current.synx + delta.synxDelta),
  };

  store[key] = next;
  await writeStore(store);
  return next;
}

export async function resetDevWallet(username: string): Promise<DevWallet> {
  const store = await readStore();
  const key = normalizeUsername(username);
  const wallet = {
    tokens: LOCAL_DEV_DEFAULTS.tokens,
    synx: LOCAL_DEV_DEFAULTS.synx,
  };
  store[key] = wallet;
  await writeStore(store);
  return wallet;
}

export function isLocalDev(): boolean {
  return process.env.NODE_ENV === "development";
}

export const LOCAL_DEV_DEFAULTS = {
  tokens: 50_000,
  synx: 100,
} as const;

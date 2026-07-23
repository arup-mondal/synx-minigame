# Dead Drop — Syndicate Protocol Gamble Mini-Game

**Dead Drop** is a wire-tap gamble mini-game for [Syndicate Protocol](https://syndicate-protocol.com/game). Pick an intercept node on the wire map, stake in-game **Tokens**, and try to catch the courier signal for a chance at **SYNX**.

## Player data

Loaded server-to-server from the Syndicate API — no login screen in this app,
and no dependency on the player's browser cookie reaching Dead Drop's origin:

```
GET https://syndicate-protocol.com/api/players/{username}
GET https://syndicate-protocol.com/api/player/synx?username={username}
```

| Field | Source |
|-------|--------|
| **Tokens** | `player.profile.balance` |
| **SYNX** | dedicated SYNX endpoint (`balance`) |
| **Unlocked zones** | `player.profile.unlockedZones` + Iron Row (always free) |

**Note:** Both calls are authenticated with `SYNDICATE_SERVICE_API_KEY` (server-only env var, sent as `Authorization: Bearer <key>`), not the player's session cookie. Cross-subdomain cookies through an iframe are unreliable under third-party/partitioned-cookie browser policies, so balance lookups don't depend on them. Without the key configured, balance/SYNX degrade to `0` rather than failing player load — zones still load either way (they aren't gated).

Proxy route: `GET /api/player/{username}`

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open **http://localhost:3000?player=herman-german**

In `npm run dev`, **local dev mode** is on automatically:
- Fake wallet: **50,000 Tokens** + **100 SYNX** (stored in `.data/dev-wallets.json`)
- Zones/level still load from the Syndicate API
- Use **Reset wallet & daily limits** in the UI to retest wagers

Production builds (`npm run build`) never use the dev wallet.

Optionally set a local-only default player in `.env.local` (not used in production — the main game passes the username):

```env
NEXT_PUBLIC_DEFAULT_PLAYER=herman-german
```

## Host under a subdomain (recommended for production)

Deploy this app as its own Next.js project, e.g.:

```
https://dead-drop.syndicate-protocol.com
```

### Service auth requirement (critical)

Token/SYNX balances only appear when `SYNDICATE_SERVICE_API_KEY` is configured on Dead Drop's deployment. This key is issued by the main-game team and lets Dead Drop's server fetch any given username's balance directly (`Authorization: Bearer`), independent of browser cookies or which subdomain the request is served from. Without it, zones still load (unauthenticated); balances stay `0`.

### Option A — iframe from the main game

```html
<iframe
  src="https://dead-drop.syndicate-protocol.com?player=herman-german&embed=1"
  title="Dead Drop"
  style="width:100%;height:900px;border:0;background:#070605"
  allow="clipboard-write"
></iframe>
```

Or pass the username via `postMessage` (no query param):

```js
const frame = document.querySelector("#dead-drop-frame");

window.addEventListener("message", (event) => {
  if (event.origin !== "https://dead-drop.syndicate-protocol.com") return;
  if (event.data?.type === "dead-drop:ready") {
    frame.contentWindow.postMessage(
      { type: "dead-drop:init", player: currentUsername },
      "https://dead-drop.syndicate-protocol.com",
    );
  }
});
```

`?embed=1` hides the footer for a tighter in-game panel.

### Option B — same-origin path

Reverse-proxy this app under the main domain:

```
https://syndicate-protocol.com/dead-drop  →  dead-drop service
```

```nginx
location /dead-drop/ {
  proxy_pass https://dead-drop.internal/;
  proxy_set_header Host $host;
}
```

Balance/SYNX work the same either way (Option A or B) since they're fetched server-to-server with `SYNDICATE_SERVICE_API_KEY`, not via the player's cookie.

### Env for embed / CORS

```env
DEAD_DROP_FRAME_ANCESTORS=https://syndicate-protocol.com https://www.syndicate-protocol.com
DEAD_DROP_CORS_ORIGINS=https://syndicate-protocol.com,https://www.syndicate-protocol.com
NEXT_PUBLIC_DEAD_DROP_PARENT_ORIGINS=https://syndicate-protocol.com,https://www.syndicate-protocol.com
NEXT_PUBLIC_SYNDICATE_API_URL=https://syndicate-protocol.com
SYNDICATE_SERVICE_API_KEY=<issued by the main-game team, server-only>
```

### Still required for real economy

A Syndicate backend endpoint to **debit/credit** Tokens & SYNX after play. Until then, production UI updates are optimistic only (local wallet in `npm run dev`).

## How it works

1. Pick an **unlocked zone** on the wire map
2. Choose a **wager tier** (Street → Kingpin)
3. Click **Intercept** — costs Tokens from `profile.balance`
4. If the courier lands on your node, win Tokens or in-game SYNX

**Daily limit:** 1 intercept per wager tier per UTC day (up to 4 total — one Street, one Crew, one Boss, one Kingpin).

**Access:** Players must have at least **one zone unlocked in Syndicate City** (beyond the free Iron Row starter zone). Default-zone-only operatives are turned away.

Courier routes follow the wired network edges only.

## Wager tiers & payouts

Each intercept costs **in-game Tokens** (debited whether you win or lose). Two rolls:

1. **Intercept roll** — does the courier land on your zone?
2. **Payout roll** — if yes, which reward?

### Street Wager — 50 Tokens · 14% intercept

| Reward | Amount | Chance if intercept succeeds |
|--------|--------|------------------------------|
| Token Skim | 120 Tokens | 84.5% |
| Token Bundle | 400 Tokens | 14.5% |
| SYNX Trace | 2 SYNX | 1.0% |

### Crew Wager — 200 Tokens · 18% intercept

| Reward | Amount | Chance if intercept succeeds |
|--------|--------|------------------------------|
| Token Skim | 450 Tokens | 80.2% |
| Token Bundle | 1,500 Tokens | 18.0% |
| SYNX Trace | 8 SYNX | 1.5% |
| SYNX Pouch | 25 SYNX | 0.3% |

### Boss Wager — 500 Tokens · 22% intercept

| Reward | Amount | Chance if intercept succeeds |
|--------|--------|------------------------------|
| Token Bundle | 1,200 Tokens | 75.1% |
| Token Vault | 4,000 Tokens | 20.9% |
| SYNX Pouch | 20 SYNX | 3.3% |
| SYNX Lockbox | 75 SYNX | 0.7% |

### Kingpin Wager — 1,500 Tokens · 26% intercept

| Reward | Amount | Chance if intercept succeeds |
|--------|--------|------------------------------|
| Token Vault | 3,500 Tokens | 87.0% |
| SYNX Lockbox | 60 SYNX | 10.4% |
| SYNX Briefcase | 200 SYNX | 2.2% |
| SYNX Jackpot | 500 SYNX | 0.35% |

Odds configurable in `src/lib/game-config.ts`.

## Production TODO

- Syndicate backend endpoint to **debit/credit** Tokens & SYNX after `/api/play`
- Until then, balances update **optimistically** in the UI after each intercept

## Tech stack

Next.js 16 · React 19 · Tailwind 4 · Geist fonts · Syndicate player API

## Project structure

```
src/
  app/page.tsx                    # ?player= query param
  app/api/player/[username]/      # Proxy to Syndicate API
  app/api/play/route.ts           # Intercept resolver
  components/DeadDropGame.tsx
  components/WireNetwork.tsx
  lib/syndicate-api.ts            # Player fetch + zone normalization
  lib/game-config.ts
  lib/dead-drop-engine.ts
```

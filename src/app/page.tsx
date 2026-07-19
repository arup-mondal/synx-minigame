"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DeadDropGame } from "@/components/DeadDropGame";

/** Optional local-dev fallback only — production gets the player from the main game. */
const LOCAL_DEFAULT_PLAYER =
  process.env.NEXT_PUBLIC_DEFAULT_PLAYER?.trim() ?? "";

const MAIN_GAME_URL =
  process.env.NEXT_PUBLIC_MAIN_GAME_URL ??
  "https://syndicate-protocol.com/game";

const PARENT_ORIGINS = new Set(
  (
    process.env.NEXT_PUBLIC_DEAD_DROP_PARENT_ORIGINS ??
    "https://syndicate-protocol.com,https://www.syndicate-protocol.com"
  )
    .split(/[\s,]+/)
    .filter(Boolean),
);

function isTrustedParent(origin: string): boolean {
  if (PARENT_ORIGINS.has(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    return host === "syndicate-protocol.com" || host.endsWith(".syndicate-protocol.com");
  } catch {
    return false;
  }
}

function isLocalHost(): boolean {
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

function DeadDropPage() {
  const searchParams = useSearchParams();
  const embed = searchParams.get("embed") === "1" || searchParams.get("embed") === "true";
  const queryPlayer = searchParams.get("player")?.trim() ?? "";
  const [playerFromParent, setPlayerFromParent] = useState("");
  const [allowed, setAllowed] = useState(false);
  const [local, setLocal] = useState(false);

  useEffect(() => {
    const embedded = window.parent !== window;
    const onLocal = isLocalHost();
    setLocal(onLocal);

    if (!embedded && !onLocal) {
      window.location.replace(MAIN_GAME_URL);
      return;
    }
    setAllowed(true);

    function onMessage(event: MessageEvent) {
      if (!isTrustedParent(event.origin)) return;

      const data = event.data as
        | { type?: string; player?: string; username?: string }
        | null;

      if (!data || data.type !== "dead-drop:init") return;

      const name = (data.player ?? data.username)?.trim();
      if (name) setPlayerFromParent(name);
    }

    window.addEventListener("message", onMessage);

    // Tell parent we're ready to receive the logged-in username
    if (embedded) {
      window.parent.postMessage({ type: "dead-drop:ready" }, "*");
    }

    return () => window.removeEventListener("message", onMessage);
  }, []);

  const username =
    playerFromParent || queryPlayer || (local ? LOCAL_DEFAULT_PLAYER : "");

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center text-stone-500">
        Redirecting to Syndicate Protocol...
      </div>
    );
  }

  if (!username) {
    return (
      <div className="flex min-h-screen items-center justify-center text-stone-500">
        Waiting for player from Syndicate Protocol...
      </div>
    );
  }

  return (
    <div
      className={`mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 ${
        embed ? "min-h-0 py-4" : "min-h-screen py-10"
      }`}
    >
      <DeadDropGame username={username} />

      {!embed && (
        <footer className="mt-16 border-t border-stone-900 pt-6 text-center text-xs text-stone-600">
          <p>
            Balances &amp; zones loaded from Syndicate Protocol ·{" "}
            <a
              href={MAIN_GAME_URL}
              className="text-amber-600/80 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              syndicate-protocol.com
            </a>
          </p>
        </footer>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-stone-500">
          Loading...
        </div>
      }
    >
      <DeadDropPage />
    </Suspense>
  );
}

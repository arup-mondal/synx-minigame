import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_ORIGINS = new Set(
  (
    process.env.DEAD_DROP_CORS_ORIGINS ??
    "https://syndicate-protocol.com,https://www.syndicate-protocol.com"
  )
    .split(/[\s,]+/)
    .filter(Boolean),
);

const MAIN_GAME_URL =
  process.env.NEXT_PUBLIC_MAIN_GAME_URL ??
  "https://syndicate-protocol.com/game";

function corsHeaders(origin: string | null): HeadersInit {
  const allow =
    origin && ALLOWED_ORIGINS.has(origin)
      ? origin
      : (ALLOWED_ORIGINS.values().next().value ??
        "https://syndicate-protocol.com");

  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
}

function isLocalHost(request: NextRequest): boolean {
  const host = (request.headers.get("host") ?? "").split(":")[0];
  return host === "localhost" || host === "127.0.0.1";
}

/** True when the main game loads Dead Drop inside an iframe. */
function isEmbeddedRequest(request: NextRequest): boolean {
  const dest = request.headers.get("sec-fetch-dest");
  return dest === "iframe" || dest === "frame" || dest === "embed";
}

function shouldRedirectToMainGame(request: NextRequest): boolean {
  if (isLocalHost(request)) return false;
  if (isEmbeddedRequest(request)) return false;

  const dest = request.headers.get("sec-fetch-dest");
  // Top-level document navigations (and missing dest → treat as direct open)
  return !dest || dest === "document";
}

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");
  const isApi = request.nextUrl.pathname.startsWith("/api/");

  if (!isApi) {
    if (shouldRedirectToMainGame(request)) {
      return NextResponse.redirect(MAIN_GAME_URL);
    }
    return NextResponse.next();
  }

  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  const response = NextResponse.next();
  const headers = corsHeaders(origin);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: [
    "/",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

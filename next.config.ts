import type { NextConfig } from "next";

const PARENT_ORIGINS = (
  process.env.DEAD_DROP_FRAME_ANCESTORS ??
  "https://syndicate-protocol.com https://www.syndicate-protocol.com"
)
  .split(/[\s,]+/)
  .filter(Boolean);

const nextConfig: NextConfig = {
  async headers() {
    const frameAncestors = ["'self'", ...PARENT_ORIGINS].join(" ");

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${frameAncestors};`,
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

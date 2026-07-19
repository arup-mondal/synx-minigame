"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DROP_NODES,
  WIRE_EDGES,
  getDropNode,
  type DropNode,
  type DropNodeId,
} from "@/lib/game-config";

interface WireNetworkProps {
  activeNode: DropNodeId | null;
  landingNode: DropNodeId | null;
  hopTrail: DropNodeId[];
  playerPick: DropNodeId | null;
  unlockedZones: DropNodeId[];
  running: boolean;
  onSelectNode: (node: DropNodeId) => void;
  disabled: boolean;
}

interface SignalPacket {
  from: DropNodeId;
  to: DropNodeId;
  progress: number;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function nodePos(node: DropNode) {
  return { x: node.x, y: node.y };
}

export function WireNetwork({
  activeNode,
  landingNode,
  hopTrail,
  playerPick,
  unlockedZones,
  running,
  onSelectNode,
  disabled,
}: WireNetworkProps) {
  const [signalPacket, setSignalPacket] = useState<SignalPacket | null>(null);
  const [hoveredNode, setHoveredNode] = useState<DropNodeId | null>(null);
  const unlockedSet = useMemo(() => new Set(unlockedZones), [unlockedZones]);

  useEffect(() => {
    if (!running || hopTrail.length < 2) {
      setSignalPacket(null);
      return;
    }

    let hopIndex = 0;
    let frame = 0;
    const framesPerHop = 11;

    const interval = setInterval(() => {
      frame += 1;
      const progress = Math.min(frame / framesPerHop, 1);

      if (hopIndex >= hopTrail.length - 1) {
        setSignalPacket(null);
        clearInterval(interval);
        return;
      }

      setSignalPacket({
        from: hopTrail[hopIndex],
        to: hopTrail[hopIndex + 1],
        progress,
      });

      if (frame >= framesPerHop) {
        frame = 0;
        hopIndex += 1;
      }
    }, 20);

    return () => clearInterval(interval);
  }, [running, hopTrail]);

  const packetCoords = useMemo(() => {
    if (!signalPacket) return null;
    const a = nodePos(getDropNode(signalPacket.from));
    const b = nodePos(getDropNode(signalPacket.to));
    const t = signalPacket.progress;
    return {
      x: lerp(a.x, b.x, t),
      y: lerp(a.y, b.y, t),
    };
  }, [signalPacket]);

  const activeEdgeKey = signalPacket
    ? `${signalPacket.from}-${signalPacket.to}`
    : null;

  return (
    <div className="wire-map relative aspect-[16/10] overflow-hidden rounded-xl border border-stone-700/80 shadow-[inset_0_0_60px_rgba(0,0,0,0.8)]">
      <div className="wire-scanlines pointer-events-none absolute inset-0 z-20" />
      <div className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.55)_100%)]" />

      <div className="pointer-events-none absolute left-3 top-3 z-30 font-mono text-[9px] uppercase tracking-[0.2em] text-stone-600">
        <span className="text-amber-700/80">◈</span> Iron Row Grid
      </div>
      <div className="pointer-events-none absolute right-3 top-3 z-30 font-mono text-[9px] uppercase tracking-[0.2em] text-stone-600">
        Secure Channel <span className="wire-live-dot ml-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </div>

      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <pattern id="wireGrid" width="5" height="5" patternUnits="userSpaceOnUse">
            <path
              d="M 5 0 L 0 0 0 5"
              fill="none"
              stroke="rgba(68,64,60,0.35)"
              strokeWidth="0.08"
            />
          </pattern>

          <radialGradient id="mapGlow" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="rgba(217,119,6,0.14)" />
            <stop offset="55%" stopColor="rgba(28,25,23,0.4)" />
            <stop offset="100%" stopColor="rgba(5,4,3,0.95)" />
          </radialGradient>

          <linearGradient id="edgeIdle" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#57534e" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#78716c" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#57534e" stopOpacity="0.3" />
          </linearGradient>

          <linearGradient id="edgeHot" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#fbbf24" stopOpacity="1" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.2" />
          </linearGradient>

          <filter id="nodeGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="signalGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width="100" height="100" fill="#050403" />
        <rect width="100" height="100" fill="url(#wireGrid)" opacity="0.7" />
        <rect width="100" height="100" fill="url(#mapGlow)" />

        {[
          [8, 18, 14, 10],
          [22, 8, 18, 8],
          [62, 12, 16, 12],
          [78, 72, 14, 14],
          [10, 82, 20, 8],
        ].map(([x, y, w, h], i) => (
          <rect
            key={i}
            x={x}
            y={y}
            width={w}
            height={h}
            fill="rgba(28,25,23,0.55)"
            stroke="rgba(68,64,60,0.25)"
            strokeWidth="0.15"
            rx="0.4"
          />
        ))}

        {WIRE_EDGES.map(([from, to]) => {
          const a = getDropNode(from);
          const b = getDropNode(to);
          const edgeKey = `${from}-${to}`;
          const reverseKey = `${to}-${from}`;
          const isHot =
            activeEdgeKey === edgeKey || activeEdgeKey === reverseKey;

          return (
            <g key={`${from}-${to}`}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="rgba(28,25,23,0.9)"
                strokeWidth="1.1"
                strokeLinecap="round"
              />
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={isHot ? "url(#edgeHot)" : "url(#edgeIdle)"}
                strokeWidth={isHot ? 0.55 : 0.28}
                strokeLinecap="round"
                className={!isHot && !running ? "wire-edge-flow" : undefined}
                strokeDasharray={isHot ? "none" : "1.2 1.8"}
              />
            </g>
          );
        })}

        {hopTrail.length > 1 &&
          hopTrail.slice(0, -1).map((from, i) => {
            const to = hopTrail[i + 1];
            const a = getDropNode(from);
            const b = getDropNode(to);
            return (
              <line
                key={`trail-${from}-${to}-${i}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="rgba(245,158,11,0.15)"
                strokeWidth="0.6"
                strokeLinecap="round"
              />
            );
          })}

        {packetCoords && (
          <g filter="url(#signalGlow)">
            <circle cx={packetCoords.x} cy={packetCoords.y} r="2.2" fill="rgba(251,191,36,0.25)" />
            <circle cx={packetCoords.x} cy={packetCoords.y} r="1.1" fill="#fde68a" />
            <circle cx={packetCoords.x} cy={packetCoords.y} r="0.45" fill="#fffbeb" />
          </g>
        )}

        {!running && (
          <g transform="translate(50, 50)" className="wire-radar">
            <path
              d="M 0 0 L 0 -42 A 42 42 0 0 1 42 0 Z"
              fill="rgba(217,119,6,0.08)"
            />
          </g>
        )}

        {DROP_NODES.map((node) => {
          const isUnlocked = unlockedSet.has(node.id);
          const isPick = playerPick === node.id;
          const isActive = activeNode === node.id;
          const isLanding = landingNode === node.id;
          const isHovered = hoveredNode === node.id;
          const showDetail = isPick || isHovered || isLanding;
          const showLockedDetail = !isUnlocked && isHovered;
          const canInteract = isUnlocked && !disabled && !running;

          const ringColor = node.accent;

          const coreFill = !isUnlocked
            ? node.accent
            : isLanding
              ? "rgba(245,158,11,0.45)"
              : isActive
                ? "rgba(217,119,6,0.5)"
                : node.accent;

          const hexFillOpacity = !isUnlocked
            ? isHovered
              ? 0.14
              : 0.09
            : isPick
              ? 0.62
              : isLanding
                ? 0.5
                : isActive
                  ? 0.45
                  : isHovered
                    ? 0.28
                    : 0.16;

          const hexStrokeOpacity = !isUnlocked ? (isHovered ? 0.65 : 0.42) : 1;

          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              filter={isPick || isActive || isLanding ? "url(#nodeGlow)" : undefined}
              className={canInteract ? "cursor-pointer" : "cursor-not-allowed"}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => {
                if (canInteract) onSelectNode(node.id);
              }}
            >
              <circle r="5.5" fill="transparent" pointerEvents="auto" />

              {!isUnlocked && (
                <polygon
                  points="0,-4.5 3.9,-2.25 3.9,2.25 0,4.5 -3.9,2.25 -3.9,-2.25"
                  fill="none"
                  stroke={node.accent}
                  strokeWidth="0.18"
                  strokeOpacity="0.22"
                  strokeDasharray="0.5 0.6"
                />
              )}

              {isLanding && isUnlocked && (
                <>
                  <circle r="6.5" fill="none" stroke="#fbbf24" strokeWidth="0.2" opacity="0.5" className="wire-burst-ring" />
                  <circle r="5" fill="none" stroke="#f59e0b" strokeWidth="0.25" opacity="0.7" className="wire-burst-ring wire-burst-ring-delay" />
                </>
              )}

              {(isActive || isLanding) && isUnlocked && (
                <polygon
                  points="0,-5.5 4.75,-2.75 4.75,2.75 0,5.5 -4.75,2.75 -4.75,-2.75"
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="0.22"
                  strokeDasharray="2 1.5"
                  className="wire-ring-spin"
                  opacity="0.85"
                />
              )}

              {isPick && !isLanding && isUnlocked && (
                <polygon
                  points="0,-4.8 4.15,-2.4 4.15,2.4 0,4.8 -4.15,2.4 -4.15,-2.4"
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="0.3"
                  className="wire-node-pulse"
                />
              )}

              <polygon
                points="0,-3.8 3.3,-1.9 3.3,1.9 0,3.8 -3.3,1.9 -3.3,-1.9"
                fill={coreFill}
                fillOpacity={hexFillOpacity}
                stroke={ringColor}
                strokeOpacity={hexStrokeOpacity}
                strokeWidth={isPick ? 0.4 : isHovered ? 0.32 : 0.28}
                strokeDasharray={isUnlocked ? "none" : "0.55 0.45"}
              />

              <circle
                r="1"
                fill={isPick ? "#fafaf9" : isUnlocked ? node.accent : node.accent}
                opacity={isPick ? 0.95 : isUnlocked ? 0.75 : isHovered ? 0.55 : 0.35}
              />

              {!isUnlocked && (
                <>
                  <rect
                    x="-1.1"
                    y="-2.2"
                    width="2.2"
                    height="1.8"
                    rx="0.2"
                    fill="rgba(9,9,9,0.55)"
                    stroke={node.accent}
                    strokeWidth="0.22"
                    strokeOpacity="0.55"
                  />
                  <path
                    d="M -0.7 -2.2 L -0.7 -2.8 A 0.7 0.7 0 0 1 0.7 -2.8 L 0.7 -2.2"
                    fill="none"
                    stroke={node.accent}
                    strokeWidth="0.25"
                    strokeOpacity="0.7"
                  />
                </>
              )}

              <text
                y="7.2"
                textAnchor="middle"
                fill={isPick ? "#fafaf9" : node.accent}
                fontSize="1.85"
                fontFamily="var(--font-geist-mono, monospace)"
                fontWeight="600"
                letterSpacing="0.04em"
                opacity={isPick ? 1 : isUnlocked ? 0.85 : isHovered ? 0.72 : 0.52}
              >
                {node.codename}
              </text>

              {showLockedDetail && (
                <>
                  <text
                    y="-6.2"
                    textAnchor="middle"
                    fill={node.accent}
                    fontSize="2.2"
                    fontFamily="var(--font-geist-sans), system-ui, sans-serif"
                    fontWeight="600"
                    opacity="0.85"
                  >
                    {node.label}
                  </text>
                  <text
                    y="-8.8"
                    textAnchor="middle"
                    fill="#a8a29e"
                    fontSize="1.6"
                    fontFamily="var(--font-geist-mono, monospace)"
                    letterSpacing="0.08em"
                  >
                    LOCKED
                  </text>
                </>
              )}

              {showDetail && isUnlocked && (
                <>
                  <text
                    y="9.5"
                    textAnchor="middle"
                    fill={isPick ? "#e7e5e4" : "#78716c"}
                    fontSize="1.6"
                    fontFamily="var(--font-geist-mono, monospace)"
                  >
                    HEAT {node.heat}
                  </text>
                  <text
                    y="-6.2"
                    textAnchor="middle"
                    fill={isLanding ? "#fcd34d" : isPick ? "#fafaf9" : "#a8a29e"}
                    fontSize="2.5"
                    fontFamily="var(--font-geist-sans), system-ui, sans-serif"
                    fontWeight="600"
                  >
                    {node.label}
                  </text>
                </>
              )}

              {!isUnlocked && isHovered && (
                <text
                  y="9.5"
                  textAnchor="middle"
                  fill="#78716c"
                  fontSize="1.5"
                  fontFamily="var(--font-geist-mono, monospace)"
                >
                  Unlock in Syndicate City
                </text>
              )}

              {!isUnlocked && !isHovered && (
                <text
                  y="9.5"
                  textAnchor="middle"
                  fill={node.accent}
                  fontSize="1.4"
                  fontFamily="var(--font-geist-mono, monospace)"
                  opacity="0.35"
                >
                  HEAT {node.heat}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black via-black/90 to-transparent px-4 pb-3 pt-10">
        <p className="text-center text-[10px] uppercase tracking-[0.35em] text-stone-500">
          {running ? "◈ Signal routing — do not break channel" : "◈ Select intercept node"}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-1">
          {DROP_NODES.map((node) => {
            const isUnlocked = unlockedSet.has(node.id);
            const state =
              !isUnlocked
                ? "locked"
                : landingNode === node.id
                  ? "landing"
                  : playerPick === node.id
                    ? "pick"
                    : activeNode === node.id
                      ? "active"
                      : "idle";

            return (
              <span
                key={node.id}
                style={
                  state === "idle" || state === "pick" || state === "locked"
                    ? {
                        borderColor:
                          state === "pick"
                            ? "#34d399"
                            : state === "locked"
                              ? `${node.accent}44`
                              : `${node.accent}55`,
                        color: node.accent,
                        opacity: state === "locked" ? 0.55 : 1,
                      }
                    : undefined
                }
                className={`rounded-sm border px-1.5 py-0.5 font-mono text-[9px] transition ${
                  state === "locked"
                    ? "border-dashed bg-zinc-950/70"
                    : state === "landing"
                      ? "border-amber-600/60 bg-amber-950/70 text-amber-300"
                      : state === "pick"
                        ? "border-emerald-500/70 bg-emerald-950/30"
                        : state === "active"
                          ? "border-amber-700/50 bg-amber-950/40 text-amber-400"
                          : "bg-stone-950/40 opacity-90"
                }`}
              >
                {state === "locked" ? node.codename : node.codename}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

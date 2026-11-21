import { fromUnixTime } from "date-fns";

export function fromNanoseconds(timestamp: bigint): Date {
  return fromUnixTime(Number(timestamp) / 1_000_000_000);
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const NODE_TYPE_NAMES: Record<string, string> = {
  curation: "Curation",
  swarm: "Swarm",
  location: "Location",
  lawEntity: "LawToken",
  interpEntity: "InterpToken",
};

/** Human label for a graph node type: "interpEntity" -> "InterpToken". */
export function formatNodeType(type: string): string {
  return NODE_TYPE_NAMES[type] ?? type;
}

/** Compact relative time for tight spaces: 12s, 4m, 3h, 2d, 1w. */
export function formatShortAgo(timestamp: bigint): string {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - fromNanoseconds(timestamp).getTime()) / 1000),
  );
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

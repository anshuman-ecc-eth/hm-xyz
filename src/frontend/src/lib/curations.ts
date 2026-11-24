import type { GraphMeta } from "./hyvmind";

export const CURATIONS_PREFIX = "/curations";

/** A URL-safe slug for a curation name: "Indian Securities Law". */
export function slugifyGraphName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isCurationPath(pathname: string): boolean {
  return (
    pathname === CURATIONS_PREFIX || pathname.startsWith(`${CURATIONS_PREFIX}/`)
  );
}

/** The decoded slug from `/curations/<slug>`, or null for any other path. */
export function parseCurationSlug(pathname: string): string | null {
  const match = /^\/curations\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Resolve a slug to a published graph. A graph id always wins, so a stale
 * curated name never dead-ends. Otherwise the slug maps to the newest graph
 * with that name — the same order the app's public list uses, since a curation
 * can have several published snapshots.
 */
export function resolveCuration(
  graphs: GraphMeta[],
  slug: string,
  pinnedId?: string | null,
): GraphMeta | null {
  if (pinnedId) {
    const pinned = graphs.find((graph) => graph.id === pinnedId);
    if (pinned) return pinned;
  }
  const byId = graphs.find((graph) => graph.id === slug);
  if (byId) return byId;

  const target = slugifyGraphName(slug);
  if (target.length === 0) return null;
  const matches = graphs.filter(
    (graph) => slugifyGraphName(graph.name) === target,
  );
  if (matches.length === 0) return null;
  return matches.reduce((newest, graph) =>
    graph.publishedAt > newest.publishedAt ? graph : newest,
  );
}

/**
 * The shareable link for a graph. `?graph=` pins the exact snapshot so a post
 * keeps pointing at the graph it cites even if the curation is re-published.
 */
export function curationHref(
  graph: { id: string; name: string },
  nodeId?: string | null,
): string {
  const slug = slugifyGraphName(graph.name) || graph.id;
  const params = new URLSearchParams({ graph: graph.id });
  if (nodeId) params.set("node", nodeId);
  return `${CURATIONS_PREFIX}/${slug}?${params.toString()}`;
}

export function curationHrefById(
  graphName: string,
  graphId: string,
  nodeId?: string | null,
): string {
  return curationHref({ id: graphId, name: graphName }, nodeId);
}

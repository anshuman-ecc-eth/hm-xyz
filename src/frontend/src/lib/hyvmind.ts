/**
 * Read-only client for the Hyvmind app's public HTTP API.
 *
 * Two hard rules, both learned the hard way against the live canister:
 *  1. Node ids are opaque. Never parse them, never synthesise one; send back
 *     exactly the `id` field from /api/nodes.
 *  2. The API emits raw control characters inside node content, which makes
 *     `JSON.parse` throw. Every body is stripped of [\u0000-\u001f] first.
 */

const FALLBACK_BACKEND = "4p5ty-yyaaa-aaaam-qfana-cai";
const APP_ORIGIN = "https://hyvmind.app";

export type NodeType =
  | "curation"
  | "swarm"
  | "location"
  | "lawEntity"
  | "interpEntity";

/** One contributor to a published graph, with their accumulated app trust. */
export interface GraphAuthorDetail {
  principal: string;
  name: string;
  /**
   * Whole tokens with 7 decimals. The deployed API sends a number; the canister
   * source builds the same figure as a decimal string, so accept both.
   */
  trustScore: string | number;
  profileUrl?: string | null;
  affiliation?: string | null;
  identifier?: string | null;
}

export interface GraphMeta {
  id: string;
  name: string;
  creator: string;
  creatorName: string;
  publishedAt: number;
  revision: number;
  nodeCount: number;
  edgeCount: number;
  xyzWriteCount?: number;
  /** Creator plus every extender; the only public per-principal trust source. */
  authorDetails?: GraphAuthorDetail[];
}

/**
 * Whole TRUST units from the app's 7-decimal figure, floored. Returns null for
 * missing or malformed values so callers can omit the label instead of showing
 * a wrong number.
 */
export function trustUnits(
  score: string | number | null | undefined,
): number | null {
  if (score === null || score === undefined) return null;
  const value = typeof score === "number" ? score : Number(score);
  if (!Number.isFinite(value)) return null;
  const whole = Math.trunc(value);
  return whole < 0 ? null : whole;
}

/**
 * Whole TRUST units summed across every contributor (creator plus extenders).
 * Floors once after summing, so two 0.9s read as 1, not 0. Returns null when
 * there is nothing to sum, so an unknown total is never shown as 0.
 */
export function totalTrustUnits(
  details: GraphAuthorDetail[] | undefined,
): number | null {
  if (!details || details.length === 0) return null;
  let total = 0;
  let seen = false;
  for (const detail of details) {
    const raw = detail.trustScore;
    const value = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(value) || value < 0) continue;
    total += value;
    seen = true;
  }
  if (!seen) return null;
  return Math.trunc(total);
}

export interface ApiNode {
  id: string;
  name: string;
  type: NodeType;
  parentId?: string;
  content?: string;
  creator?: string;
  /** u64 nanoseconds since the epoch. */
  createdAt?: number;
  sources?: { name: string; url: string }[];
  attributes?: {
    key: string;
    weightedValues: { value: string; weight: number }[];
  }[];
}

/** A node with its display path resolved by walking parentId. */
export interface ResolvedNode extends ApiNode {
  graphId: string;
  graphName: string;
  path: string;
  segments: string[];
  /**
   * The swarm this node hangs from — itself, for a swarm. Write permission is
   * scoped to that swarm's community, so every citation carries it. Null only
   * for a curation, which has no swarm above it.
   */
  swarmNodeId: string | null;
  swarmCreator: string | null;
  /** "Curation > Swarm", the community's display name. */
  swarmLabel: string | null;
}

export const NODE_TYPE_LABEL: Record<NodeType, string> = {
  curation: "curation",
  swarm: "swarm",
  location: "location",
  lawEntity: "lawEntity",
  interpEntity: "interpEntity",
};

/** Only these can anchor a citation: a token must hang off a law token. */
export const CITABLE_TYPES: NodeType[] = ["lawEntity", "interpEntity"];

export function isCitable(node: { type: NodeType }): boolean {
  return CITABLE_TYPES.includes(node.type);
}

let backendPromise: Promise<string> | null = null;

async function backendId(): Promise<string> {
  if (!backendPromise) {
    backendPromise = (async () => {
      try {
        const res = await fetch(`${APP_ORIGIN}/env.json`, {
          cache: "no-store",
        });
        if (res.ok) {
          const env = await res.json();
          const id = env?.backend_canister_id;
          if (typeof id === "string" && id !== "undefined" && id.length > 0) {
            return id;
          }
        }
      } catch {
        // fall through to the pinned id
      }
      return FALLBACK_BACKEND;
    })();
  }
  return backendPromise;
}

function sanitize(body: string): string {
  // The API emits raw control characters inside node content, which makes
  // JSON.parse throw. Strip Unicode category Cc (C0 and C1 controls).
  return body.replace(/\p{Cc}/gu, "");
}

async function apiGet(
  path: string,
): Promise<{ body: unknown; revision?: string }> {
  const id = await backendId();
  const res = await fetch(`https://${id}.raw.icp0.io${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`hyvmind API ${res.status} for ${path}`);
  }
  const revision = res.headers.get("x-hyvmind-revision") ?? undefined;
  const body = JSON.parse(sanitize(await res.text()));
  return { body, revision };
}

export async function fetchGraphs(): Promise<GraphMeta[]> {
  const { body } = await apiGet("/api/graphs");
  return (body as GraphMeta[]).map((g) => ({
    ...g,
    revision: typeof g.revision === "number" ? g.revision : 0,
  }));
}

export async function fetchNodes(
  graphId: string,
): Promise<{ nodes: ApiNode[]; revision: number | null }> {
  const { body, revision } = await apiGet(
    `/api/nodes/${encodeURIComponent(graphId)}`,
  );
  const parsed = typeof revision === "string" ? Number(revision) : Number.NaN;
  return {
    nodes: body as ApiNode[],
    revision: Number.isFinite(parsed) ? parsed : null,
  };
}

export interface ApiGraphEdge {
  source: string;
  target: string;
  label?: string;
  bidirectional?: boolean;
}

/**
 * The whole published graph. Unlike `/api/graphs`, this includes the nodes and
 * edges themselves; the per-type arrays are how the app serialises them.
 */
export interface ApiGraphData {
  curations: ApiNode[];
  swarms: ApiNode[];
  locations: ApiNode[];
  lawTokens: ApiNode[];
  interpretationTokens: ApiNode[];
  edges: ApiGraphEdge[];
  revision?: number;
}

export async function fetchGraphData(graphId: string): Promise<ApiGraphData> {
  const { body } = await apiGet(`/api/graphs/${encodeURIComponent(graphId)}`);
  return body as ApiGraphData;
}

/**
 * Builds display paths by walking `parentId`. This is presentation only — the
 * resulting string is never sent back to the app and never used to resolve a
 * node. `id` remains the only identifier.
 */
export function resolveNodes(
  graph: GraphMeta,
  nodes: ApiNode[],
): ResolvedNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const cache = new Map<string, { segments: string[]; complete: boolean }>();

  function resolve(
    id: string,
    depth: number,
  ): { segments: string[]; complete: boolean } {
    const hit = cache.get(id);
    if (hit) return hit;
    const node = byId.get(id);
    if (!node || depth > 12) {
      return { segments: [], complete: false };
    }
    // Guard against a cycle in malformed data.
    cache.set(id, { segments: [node.name], complete: false });
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    const result = parent
      ? (() => {
          const p = resolve(parent.id, depth + 1);
          return { segments: [...p.segments, node.name], complete: p.complete };
        })()
      : { segments: [node.name], complete: true };
    cache.set(id, result);
    return result;
  }

  return nodes.map((node) => {
    const { segments, complete } = resolve(node.id, 0);
    // Walk up to the nearest swarm, including the node itself. Ids are opaque,
    // so this is the only way to know which community governs a write.
    let swarm: ApiNode | undefined;
    let cursor: ApiNode | undefined = node;
    let guard = 0;
    while (cursor && guard < 12) {
      guard += 1;
      if (cursor.type === "swarm") {
        swarm = cursor;
        break;
      }
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    const curation = segments.length > 0 ? segments[0] : node.name;
    return {
      ...node,
      graphId: graph.id,
      graphName: graph.name,
      segments,
      path: (complete ? segments : [...segments, "…"]).join(" › "),
      swarmNodeId: swarm?.id ?? null,
      swarmCreator: swarm?.creator ?? null,
      swarmLabel: swarm ? `${curation} > ${swarm.name}` : null,
    };
  });
}

export interface NodeSearchResult extends ResolvedNode {
  score: number;
}

/**
 * Small substring scorer. Avoids a dependency, and beats fuzzy matching for the
 * case that matters: exact provision names, which users paste from a document.
 */
export function searchNodes(
  nodes: ResolvedNode[],
  query: string,
  limit = 12,
): NodeSearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  const results: NodeSearchResult[] = [];
  for (const node of nodes) {
    const name = node.name.toLowerCase();
    const path = node.path.toLowerCase();
    const content = (node.content ?? "").toLowerCase();
    let score = 0;
    if (name === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (name.includes(q)) score = 60;
    else if (path.includes(q)) score = 40;
    else if (content.includes(q)) score = 20;
    else continue;
    // Shorter names are more specific.
    score -= Math.min(10, Math.floor(name.length / 20));
    results.push({ ...node, score });
  }
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.path.localeCompare(b.path);
  });
  return results.slice(0, limit);
}

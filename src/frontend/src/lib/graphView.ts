import type { ApiGraphData, ApiNode, GraphMeta, NodeType } from "./hyvmind";

export interface SourceRef {
  name: string;
  url: string;
}

export interface SourceNode {
  id: string;
  name: string;
  nodeType: NodeType;
  content?: string;
  parentId?: string;
  parentName?: string;
  attributes?: Record<string, string>;
  tags?: string[];
  sources?: SourceRef[];
}

export interface SourceEdge {
  source: string;
  target: string;
  label?: string;
  bidirectional?: boolean;
  edgeType: "hierarchy" | "cross-ref";
}

export interface SourceGraph {
  id: string;
  name: string;
  nodes: SourceNode[];
  edges: SourceEdge[];
  revision: number;
}

/** Buckets in the order the app's published graph lists them. */
const BUCKETS = [
  "curations",
  "swarms",
  "locations",
  "lawTokens",
  "interpretationTokens",
] as const;

/**
 * Ids are paths, so a location and an interpretation token can share one. The
 * more specific node wins the type, which keeps the interpretation's content.
 */
const PRECEDENCE: Record<NodeType, number> = {
  curation: 0,
  swarm: 1,
  location: 2,
  lawEntity: 3,
  interpEntity: 4,
};

function dedupeSources(
  sources: SourceRef[] | undefined,
): SourceRef[] | undefined {
  if (!sources || sources.length === 0) return undefined;
  const seen = new Set<string>();
  const out: SourceRef[] = [];
  for (const source of sources) {
    const key = `${source.name}\u0000${source.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(source);
  }
  return out;
}

function attributesToRecord(
  attributes: ApiNode["attributes"],
): Record<string, string> | undefined {
  if (!attributes || attributes.length === 0) return undefined;
  const byKey = new Map<string, string[]>();
  const seen = new Map<string, Set<string>>();
  for (const attribute of attributes) {
    const values = byKey.get(attribute.key) ?? [];
    const known = seen.get(attribute.key) ?? new Set<string>();
    for (const weighted of attribute.weightedValues) {
      if (known.has(weighted.value)) continue;
      known.add(weighted.value);
      values.push(
        weighted.weight > 1
          ? `${weighted.value} (×${weighted.weight})`
          : weighted.value,
      );
    }
    byKey.set(attribute.key, values);
    seen.set(attribute.key, known);
  }
  return Object.fromEntries(
    [...byKey.entries()].map(([key, values]) => [key, values.join(", ")]),
  );
}

function tagsOf(attributes: ApiNode["attributes"]): string[] | undefined {
  const tags = attributes?.find((attribute) => attribute.key === "tags");
  if (!tags) return undefined;
  const values = tags.weightedValues
    .map((weighted) => weighted.value.trim())
    .filter(Boolean);
  return values.length > 0 ? values : undefined;
}

function mergeNodes(previous: ApiNode, next: ApiNode): ApiNode {
  const nextWins = PRECEDENCE[next.type] >= PRECEDENCE[previous.type];
  const win = nextWins ? next : previous;
  const lose = nextWins ? previous : next;
  // Keep the structural parent when the merge crosses from a structural node
  // (location/swarm) to a semantic one (law/interp). The id is the path, and
  // the tree is built from the structural parent.
  const structuralParent =
    PRECEDENCE[next.type] <= PRECEDENCE.location
      ? next.parentId
      : PRECEDENCE[previous.type] <= PRECEDENCE.location
        ? previous.parentId
        : undefined;
  return {
    ...lose,
    ...win,
    parentId: structuralParent ?? win.parentId ?? lose.parentId,
    content: win.content ?? lose.content,
    attributes: [...(lose.attributes ?? []), ...(win.attributes ?? [])],
    sources: [...(lose.sources ?? []), ...(win.sources ?? [])],
  };
}

/**
 * Convert the app's published graph payload into the renderer's shape.
 *
 * Hierarchy edges are derived from `parentId`; the payload's `edges` are the
 * cross-references. Counts are computed here rather than read from the graph
 * metadata, which goes stale: a published graph's meta can disagree with the
 * nodes the API actually returns.
 */
export function toSourceGraph(
  data: ApiGraphData,
  graph: Pick<GraphMeta, "id" | "name">,
): SourceGraph {
  const byId = new Map<string, ApiNode>();
  for (const bucket of BUCKETS) {
    for (const node of data[bucket] ?? []) {
      const previous = byId.get(node.id);
      byId.set(node.id, previous ? mergeNodes(previous, node) : node);
    }
  }

  const nodes: SourceNode[] = [];
  for (const node of byId.values()) {
    nodes.push({
      id: node.id,
      name: node.name,
      nodeType: node.type,
      content: node.content,
      parentId: node.parentId,
      parentName: node.parentId ? byId.get(node.parentId)?.name : undefined,
      attributes: attributesToRecord(node.attributes),
      tags: tagsOf(node.attributes),
      sources: dedupeSources(node.sources),
    });
  }

  const edges: SourceEdge[] = [];
  const seen = new Set<string>();
  const add = (edge: SourceEdge) => {
    const key = `${edge.edgeType}\u0000${edge.source}\u0000${edge.target}\u0000${edge.label ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push(edge);
  };

  for (const node of nodes) {
    if (node.parentId && byId.has(node.parentId)) {
      add({ source: node.parentId, target: node.id, edgeType: "hierarchy" });
    }
  }
  for (const edge of data.edges ?? []) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
    add({
      source: edge.source,
      target: edge.target,
      label: edge.label?.trim() || undefined,
      bidirectional: !!edge.bidirectional,
      edgeType: "cross-ref",
    });
  }

  return {
    id: graph.id,
    name: graph.name,
    nodes,
    edges,
    revision: data.revision ?? 0,
  };
}

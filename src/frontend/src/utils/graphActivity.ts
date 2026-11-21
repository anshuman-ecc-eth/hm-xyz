import type { ResolvedNode } from "../lib/hyvmind";
import type { Post } from "./types";

/**
 * One line in the right-rail activity feed: an interpretation that someone
 * actually published to the graph. Derived from posts, so it is limited to
 * activity that went through this app's publish flow.
 */
export interface GraphActivityEvent {
  /** Post id as a string, for stable React keys. */
  id: string;
  postId: bigint;
  at: bigint;
  actorName: string;
  actorUsername: string;
  isSelf: boolean;
  graphId: string;
  graphName: string;
  nodeId: string;
  nodeName: string;
  path: string;
  /** What the post did: interpretation, extension, or a new graph. */
  verb: string;
  /** Nearest location ancestor of the cited node, when the graph resolves. */
  locationName?: string;
  /** Nearest swarm ancestor of the cited node, when the graph resolves. */
  swarmName?: string;
}

const isPublishedOrigin = (post: Post) =>
  "original" in post.postType && !!post.graphRef?.tokenNodeId;

/**
 * Walks up from the cited node to the nearest location and swarm. The graph's
 * parent chain is the only place those types live; the post only snapshots the
 * leaf name.
 */
function resolveContext(
  nodeId: string,
  nodes: ResolvedNode[] | undefined,
): { locationName?: string; swarmName?: string } {
  if (!nodes || nodes.length === 0) return {};

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const cited = byId.get(nodeId);
  if (!cited) return {};

  let locationName: string | undefined;
  let swarmName: string | undefined;

  if (cited.type === "location") locationName = cited.name;
  if (cited.type === "swarm") swarmName = cited.name;

  const seen = new Set<string>([cited.id]);
  let parent = cited.parentId ? byId.get(cited.parentId) : undefined;
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id);
    if (parent.type === "location" && !locationName) locationName = parent.name;
    if (parent.type === "swarm" && !swarmName) swarmName = parent.name;
    if (locationName && swarmName) break;
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }

  return { locationName, swarmName };
}

/** Published interpretations from the home feed, newest first. */
export function buildGraphActivity({
  posts,
  nodesByGraph,
  selfUsername,
}: {
  posts: Post[];
  nodesByGraph: Map<string, ResolvedNode[]>;
  selfUsername?: string;
}): GraphActivityEvent[] {
  const events: GraphActivityEvent[] = [];
  const seenTokens = new Set<string>();

  for (const post of posts) {
    if (!isPublishedOrigin(post)) continue;
    const ref = post.graphRef;
    if (!ref?.tokenNodeId || seenTokens.has(ref.tokenNodeId)) continue;
    seenTokens.add(ref.tokenNodeId);

    const context = resolveContext(ref.nodeId, nodesByGraph.get(ref.graphId));
    events.push({
      id: post.id.toString(),
      postId: post.id,
      at: post.createdAt,
      actorName: post.authorDisplayName,
      actorUsername: post.authorUsername,
      isSelf: selfUsername != null && post.authorUsername === selfUsername,
      graphId: ref.graphId,
      graphName: ref.graphName,
      nodeId: ref.nodeId,
      nodeName: ref.nodeName,
      path: ref.path,
      verb: post.chain
        ? post.chain.start
          ? "extended a chain"
          : "created a new graph"
        : "published an interpretation",
      ...context,
    });
  }

  events.sort((a, b) => Number(b.at - a.at));
  return events;
}

/** "section 2(1)(z) in SARFAESI Act, 2002", with graceful fallbacks. */
export function activityContext(event: GraphActivityEvent): string {
  const location = event.locationName ?? event.nodeName;
  if (event.swarmName) return `${location} in ${event.swarmName}`;
  return location || event.graphName;
}

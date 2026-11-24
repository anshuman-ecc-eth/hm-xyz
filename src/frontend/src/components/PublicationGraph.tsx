import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useHyvmindGraphs, useHyvmindNodes } from "../hooks/useHyvmind";
import { type ResolvedNode, trustUnits } from "../lib/hyvmind";
import { formatNodeType, getInitials } from "../utils/formatting";
import type { GraphRef, Post } from "../utils/types";

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

const firstLine = (text: string, max: number) => {
  const line = text
    .split("\n")
    .map((part) => part.trim())
    .find((part) => part.length > 0);
  return clip(line || "interpretation", max);
};

interface ChainNode {
  name: string;
  type: string;
}

/**
 * A static, one-depth view of a published interpretation: the author on the
 * left, the new token circled in the middle, and its parent law token plus
 * location/swarm ancestors on the right.
 */
export function PublicationGraph({ post }: { post: Post }) {
  const graphRef: GraphRef | undefined = post.graphRef;
  const chainSpec = post.chain;
  const published = !!graphRef?.tokenNodeId;
  const graphs = useHyvmindGraphs();
  const nodes = useHyvmindNodes(graphRef?.graphId ?? null);

  const ancestors = useMemo<ChainNode[]>(() => {
    // A chain post already knows its own path, so it works before publication.
    if (chainSpec) {
      const created = chainSpec.levels
        .map((level) => ({ name: level.name, type: level.nodeType }))
        .reverse();
      const start = chainSpec.start
        ? [{ name: chainSpec.start.nodeName, type: chainSpec.start.nodeType }]
        : [];
      return [...created, ...start];
    }
    if (!graphRef) return [];
    const data = nodes.data;
    if (!data || data.length === 0) return [];
    const byId = new Map<string, ResolvedNode>(
      data.map((node) => [node.id, node]),
    );
    const out: ChainNode[] = [];
    let cursor = byId.get(graphRef.nodeId);
    while (cursor && out.length < 3) {
      out.push({ name: cursor.name, type: cursor.type });
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    return out;
  }, [chainSpec, graphRef, nodes.data]);

  // The publisher's app trust. xyz writes record `creator = writerApp` on the
  // token they create, and `/api/graphs` lists that principal's score in
  // authorDetails — so the published token is the join key.
  const trust = useMemo<number | null>(() => {
    const tokenId = graphRef?.tokenNodeId;
    if (!tokenId || !nodes.data || !graphs.data) return null;
    const creator = nodes.data.find((node) => node.id === tokenId)?.creator;
    if (!creator) return null;
    const graph = graphs.data.find((g) => g.id === graphRef?.graphId);
    const author = graph?.authorDetails?.find((a) => a.principal === creator);
    return trustUnits(author?.trustScore);
  }, [graphRef?.tokenNodeId, graphRef?.graphId, nodes.data, graphs.data]);

  // Additional inline cross-references, excluding the anchor (which has its own
  // chip/diagram) and its enclosing law (a hierarchy edge, not a citation), and
  // duplicate markers for the same node.
  const anchorParentId = useMemo(() => {
    const anchorId = graphRef?.nodeId;
    if (!anchorId || !nodes.data) return null;
    return nodes.data.find((node) => node.id === anchorId)?.parentId ?? null;
  }, [graphRef?.nodeId, nodes.data]);

  const crossRefs = useMemo(() => {
    const seen = new Set<string>();
    return (post.citations ?? []).filter((citation) => {
      if (
        citation.nodeId === graphRef?.nodeId ||
        citation.nodeId === anchorParentId ||
        seen.has(citation.nodeId)
      ) {
        return false;
      }
      seen.add(citation.nodeId);
      return true;
    });
  }, [post.citations, graphRef?.nodeId, anchorParentId]);

  if (!graphRef?.tokenNodeId && !chainSpec) return null;

  const cited = ancestors[0] ?? {
    name: graphRef?.nodeName ?? "interpretation",
    type: graphRef?.nodeType ?? "interpEntity",
  };
  const parent = ancestors[1];
  const grandparent = ancestors[2];
  const tokenName = firstLine(post.text, 20);
  const graphName = chainSpec
    ? (chainSpec.start?.graphName ?? chainSpec.levels[0]?.name ?? "new graph")
    : (graphRef?.graphName ?? "");
  const avatarUrl = post.authorProfilePictureHash?.getDirectURL();
  const avatarClip = `publication-avatar-${post.id}`;

  return (
    <div className="mt-2 border border-border">
      <div className="flex items-baseline justify-between gap-2 border-b border-border px-2.5 py-1.5 font-mono">
        <span className="shrink-0 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
          {published ? "in the graph" : "proposed"}
        </span>
        <span className="min-w-0 truncate text-[9px] text-muted-foreground">
          {graphName}
        </span>
      </div>

      <svg
        viewBox="0 0 640 210"
        className="block w-full font-mono"
        role="img"
        aria-label={`${post.authorDisplayName} ${published ? "published" : "proposes"} an interpretation of ${cited.name} in ${graphName}${trust !== null ? `, ${trust} trust` : ""}`}
      >
        <defs>
          <clipPath id={avatarClip}>
            <circle cx="58" cy="96" r="21" />
          </clipPath>
        </defs>

        {/* Trust sits in the otherwise empty band above the avatar. */}
        {trust !== null && (
          <text
            x="58"
            y="67"
            textAnchor="middle"
            fontSize="9"
            letterSpacing="0.06em"
            className="fill-foreground"
          >
            {trust} TRUST
          </text>
        )}

        {/* Social side: the author */}
        {avatarUrl ? (
          <image
            href={avatarUrl}
            x="37"
            y="75"
            width="42"
            height="42"
            clipPath={`url(#${avatarClip})`}
            preserveAspectRatio="xMidYMid slice"
          />
        ) : (
          <>
            <circle
              cx="58"
              cy="96"
              r="21"
              className="fill-none stroke-border"
            />
            <text
              x="58"
              y="100"
              textAnchor="middle"
              fontSize="11"
              className="fill-foreground"
            >
              {getInitials(post.authorDisplayName)}
            </text>
          </>
        )}
        <text
          x="58"
          y="132"
          textAnchor="middle"
          fontSize="9.5"
          className="fill-foreground"
        >
          {clip(post.authorDisplayName, 14)}
        </text>
        <text
          x="58"
          y="144"
          textAnchor="middle"
          fontSize="7.5"
          className="fill-muted-foreground"
        >
          @{clip(post.authorUsername, 14)}
        </text>

        <line x1="79" y1="96" x2="136" y2="96" className="stroke-border" />
        <circle cx="136" cy="96" r="2" className="fill-muted-foreground" />

        {/* The interpretation token, circled */}
        <ellipse
          cx="224"
          cy="96"
          rx="82"
          ry="35"
          fill="none"
          className="stroke-foreground"
          strokeDasharray="4 3"
          transform="rotate(-2 224 96)"
        />
        <ellipse
          cx="224"
          cy="96"
          rx="85"
          ry="38"
          fill="none"
          className="stroke-foreground"
          strokeOpacity="0.35"
          strokeDasharray="4 3"
          transform="rotate(1 224 96)"
        />
        <rect
          x="154"
          y="72"
          width="140"
          height="48"
          rx="2"
          className="fill-none stroke-foreground"
        />
        <text
          x="164"
          y="90"
          fontSize="7"
          letterSpacing="0.08em"
          className="fill-muted-foreground"
        >
          {formatNodeType("interpEntity")}
        </text>
        <text x="164" y="107" fontSize="10" className="fill-foreground">
          {tokenName}
        </text>

        {/* Knowledge side: cited law token and its nearest ancestors */}
        <line x1="312" y1="96" x2="354" y2="96" className="stroke-border" />
        <circle cx="354" cy="96" r="2" className="fill-muted-foreground" />
        <NodeBox
          x={354}
          y={72}
          width={130}
          height={48}
          type={formatNodeType(cited.type)}
          name={clip(cited.name, 15)}
          strong
        />

        {parent && (
          <g>
            <path
              d="M484 84 H492 V42 H500"
              fill="none"
              className="stroke-border"
            />
            <NodeBox
              x={500}
              y={20}
              width={130}
              height={44}
              type={formatNodeType(parent.type)}
              name={clip(parent.name, 16)}
            />
          </g>
        )}

        {grandparent && (
          <g>
            <path
              d="M484 108 H492 V168 H500"
              fill="none"
              className="stroke-border"
            />
            <NodeBox
              x={500}
              y={146}
              width={130}
              height={44}
              type={formatNodeType(grandparent.type)}
              name={clip(grandparent.name, 16)}
            />
          </g>
        )}
      </svg>

      {crossRefs.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-border px-2.5 py-1.5 font-mono">
          <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
            cites
          </span>
          {crossRefs.map((citation) => (
            <Link
              key={citation.nodeId}
              to="/node/$graphId"
              params={{ graphId: citation.graphId }}
              search={{ node: citation.nodeId }}
              className="text-[10px] text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid"
              title={citation.path}
              onClick={(e) => e.stopPropagation()}
            >
              [[{citation.nodeName}]]
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function NodeBox({
  x,
  y,
  width,
  height,
  type,
  name,
  strong,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
  name: string;
  strong?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={2}
        className={
          strong ? "fill-none stroke-foreground" : "fill-none stroke-border"
        }
      />
      <text
        x={x + 9}
        y={y + 16}
        fontSize="7"
        letterSpacing="0.08em"
        className="fill-muted-foreground"
      >
        {type}
      </text>
      <text x={x + 9} y={y + 33} fontSize="9.5" className="fill-foreground">
        {name}
      </text>
    </g>
  );
}

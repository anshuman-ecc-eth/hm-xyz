import ForceGraph from "force-graph";
import type { LinkObject, NodeObject } from "force-graph";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { SourceGraph, SourceNode } from "../../lib/graphView";
import { computeVisibleNodeIds, isAllVisible } from "../../lib/graphVisibility";

interface FGNode extends NodeObject {
  id: string;
  name: string;
  nodeType: SourceNode["nodeType"];
  content?: string;
  parentId?: string;
  parentName?: string;
  attributes?: Record<string, string>;
  tags?: string[];
  sources?: SourceNode["sources"];
}

interface FGLink extends LinkObject<FGNode> {
  label?: string;
  edgeType?: "hierarchy" | "cross-ref";
}

type FGInstance = InstanceType<typeof ForceGraph<FGNode, FGLink>>;

/** Same palette as hyvmind.app, so the graph reads the same on both sites. */
const NODE_COLORS: Record<string, string> = {
  curation: "#4a9eff",
  swarm: "#ff7f50",
  location: "#90EE90",
  lawEntity: "#FFD700",
  interpEntity: "#DA70D6",
};

const BG_DARK = "#0a0a0a";
const BG_LIGHT = "#f5f5f5";

interface GraphCanvasProps {
  graph: SourceGraph;
  onNodeClick?: (node: SourceNode) => void;
  searchText?: string;
  visibleNodeTypes?: Set<string>;
  attributeFilterText?: string;
  onFitToVisible?: (fitFn: () => void) => void;
  /** Centres this node once the layout settles, and opens its panel. */
  focusNodeId?: string | null;
}

/**
 * The full published graph, rendered with the same force-graph build the app
 * uses. Ported from hyvmind.app's SourceGraphDiagram so the two sites show the
 * same thing; only the theme lookup and the data types differ.
 */
export function GraphCanvas({
  graph,
  onNodeClick,
  searchText,
  visibleNodeTypes,
  attributeFilterText,
  onFitToVisible,
  focusNodeId,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<FGInstance | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const positionCacheRef = useRef<
    Map<string, Map<string, { x: number; y: number }>>
  >(new Map());
  const currentGraphIdRef = useRef<string>("");
  const neighborIdsRef = useRef<Set<string>>(new Set());
  const visibleIdsRef = useRef<Set<string>>(new Set());
  const allVisibleRef = useRef(true);
  const hasAutoFittedRef = useRef(false);
  const focusHandledRef = useRef(false);

  const onNodeClickRef = useRef(onNodeClick);
  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  }, [onNodeClick]);

  const isDarkRef = useRef(isDark);
  useEffect(() => {
    isDarkRef.current = isDark;
    fgRef.current?.backgroundColor(isDark ? BG_DARK : BG_LIGHT);
  }, [isDark]);

  const graphIdRef = useRef(graph.id);
  useEffect(() => {
    graphIdRef.current = graph.id;
  }, [graph.id]);

  const graphRef = useRef(graph);
  useEffect(() => {
    graphRef.current = graph;
  }, [graph]);

  const focusNodeRef = useRef(focusNodeId);
  useEffect(() => {
    focusNodeRef.current = focusNodeId;
  }, [focusNodeId]);

  const onFitToVisibleRef = useRef(onFitToVisible);
  useEffect(() => {
    onFitToVisibleRef.current = onFitToVisible;
  }, [onFitToVisible]);

  const fitVisible = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return;
    if (allVisibleRef.current) {
      fg.zoomToFit(400, 30);
    } else {
      fg.zoomToFit(400, 30, (node) =>
        visibleIdsRef.current.has((node as FGNode).id),
      );
    }
  }, []);

  const graphData = useMemo(() => {
    const nodes: FGNode[] = graph.nodes.map((node) => ({
      id: node.id,
      name: node.name,
      nodeType: node.nodeType,
      content: node.content,
      parentId: node.parentId,
      parentName: node.parentName,
      attributes: node.attributes,
      tags: node.tags,
      sources: node.sources,
    }));

    // Reuse the settled layout when the same graph remounts.
    const cached = positionCacheRef.current.get(graph.id);
    if (cached) {
      for (const node of nodes) {
        const position = cached.get(node.id);
        if (position) {
          node.x = position.x;
          node.y = position.y;
        }
      }
    }

    const ids = new Set(nodes.map((node) => node.id));
    const links: FGLink[] = graph.edges
      .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
      .map((edge) => ({
        source: edge.source,
        target: edge.target,
        label: edge.label,
        edgeType: edge.edgeType,
      }));

    return { nodes, links };
  }, [graph]);

  const graphDataRef = useRef(graphData);
  useEffect(() => {
    graphDataRef.current = graphData;
  }, [graphData]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount once — refs carry updates
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const fg = new ForceGraph<FGNode, FGLink>(el);
    fgRef.current = fg;

    fg.backgroundColor(isDarkRef.current ? BG_DARK : BG_LIGHT);
    // Settle quickly: the page opens into the fitted graph rather than sitting
    // at default zoom while a 15s simulation runs.
    fg.cooldownTicks(90).cooldownTime(3500);
    fg.autoPauseRedraw(false)
      .nodeId("id")
      .nodeLabel("name")
      .linkLabel("label")
      .linkDirectionalArrowLength(6)
      .linkDirectionalArrowRelPos(1)
      .linkLineDash((link) => (link.edgeType === "cross-ref" ? [5, 4] : null))
      .linkColor((link) => {
        const neighbors = neighborIdsRef.current;
        if (neighbors.size === 0) return "#888888";
        const sourceId = String(
          typeof link.source === "object" ? link.source.id : link.source,
        );
        const targetId = String(
          typeof link.target === "object" ? link.target.id : link.target,
        );
        return neighbors.has(sourceId) && neighbors.has(targetId)
          ? "#888888"
          : "rgba(136,136,136,0.08)";
      })
      .linkDirectionalArrowColor((link) => {
        const neighbors = neighborIdsRef.current;
        if (neighbors.size === 0) return "#888888";
        const sourceId = String(
          typeof link.source === "object" ? link.source.id : link.source,
        );
        const targetId = String(
          typeof link.target === "object" ? link.target.id : link.target,
        );
        return neighbors.has(sourceId) && neighbors.has(targetId)
          ? "#888888"
          : "rgba(136,136,136,0.08)";
      })
      .nodeColor((node) => NODE_COLORS[node.nodeType] ?? "#888888")
      .nodeCanvasObject((node, ctx, globalScale) => {
        const label = node.name ?? "";
        const radius = 6;
        const neighbors = neighborIdsRef.current;
        const dimmed = neighbors.size > 0 && !neighbors.has(node.id);
        ctx.globalAlpha = dimmed ? 0.15 : 1;
        ctx.beginPath();
        ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, 2 * Math.PI);
        ctx.fillStyle = NODE_COLORS[node.nodeType] ?? "#888888";
        ctx.fill();
        if (globalScale >= 0.6) {
          const fontSize = Math.max(10 / globalScale, 2);
          ctx.font = `${fontSize}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = isDarkRef.current
            ? "rgba(255,255,255,0.8)"
            : "rgba(0,0,0,0.8)";
          ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + radius + 2);
        }
        ctx.globalAlpha = 1;
      })
      .nodeCanvasObjectMode(() => "replace")
      .onNodeHover((node) => {
        if (!node) {
          neighborIdsRef.current = new Set();
          return;
        }
        const neighbors = new Set<string>([node.id]);
        for (const link of graphDataRef.current.links) {
          const sourceId = String(
            typeof link.source === "object" ? link.source.id : link.source,
          );
          const targetId = String(
            typeof link.target === "object" ? link.target.id : link.target,
          );
          if (sourceId === node.id) neighbors.add(targetId);
          if (targetId === node.id) neighbors.add(sourceId);
        }
        neighborIdsRef.current = neighbors;
      })
      .onNodeClick((node) => {
        onNodeClickRef.current?.({
          id: node.id,
          name: node.name,
          nodeType: node.nodeType,
          content: node.content,
          parentId: node.parentId,
          parentName: node.parentName,
          attributes: node.attributes,
          tags: node.tags,
          sources: node.sources,
        });
      });

    fg.onEngineStop(() => {
      const id = graphIdRef.current;
      if (id !== currentGraphIdRef.current) {
        const positions = new Map<string, { x: number; y: number }>();
        const nodes = fg.graphData().nodes;
        for (const node of nodes) {
          if (node.x !== undefined && node.y !== undefined) {
            positions.set(node.id, { x: node.x, y: node.y });
          }
        }
        positionCacheRef.current.set(id, positions);
        currentGraphIdRef.current = id;
      }

      onFitToVisibleRef.current?.(fitVisible);

      const focusId = focusNodeRef.current;
      if (focusId && !focusHandledRef.current) {
        const target = fg.graphData().nodes.find((node) => node.id === focusId);
        if (target?.x !== undefined && target.y !== undefined) {
          focusHandledRef.current = true;
          fg.centerAt(target.x, target.y, 600);
          fg.zoom(1.6, 600);
          return;
        }
      }

      if (!hasAutoFittedRef.current) {
        hasAutoFittedRef.current = true;
        fitVisible();
      }
    });

    const width = el.clientWidth;
    const height = el.clientHeight;
    if (width > 0 && height > 0) fg.width(width).height(height);

    return () => {
      fg._destructor();
      fgRef.current = null;
    };
  }, []);

  useEffect(() => {
    fgRef.current?.graphData(graphData);
  }, [graphData]);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;

    const filters = { searchText, visibleNodeTypes, attributeFilterText };
    const allVisible = isAllVisible(filters);
    const visibleIds = computeVisibleNodeIds(graphRef.current, filters);

    allVisibleRef.current = allVisible;
    visibleIdsRef.current = visibleIds;

    if (allVisible) {
      fg.nodeVisibility(true);
      fg.linkVisibility(true);
      return;
    }
    const isVisible = (node: FGNode) => visibleIds.has(node.id);
    fg.nodeVisibility(isVisible);
    fg.linkVisibility((link) => {
      if (typeof link.source === "object" && typeof link.target === "object") {
        return (
          isVisible(link.source as unknown as FGNode) &&
          isVisible(link.target as unknown as FGNode)
        );
      }
      return true;
    });
  }, [searchText, visibleNodeTypes, attributeFilterText]);

  useEffect(() => {
    if (fgRef.current && onFitToVisible) onFitToVisible(fitVisible);
  }, [onFitToVisible, fitVisible]);

  const updateSize = useCallback(() => {
    const el = containerRef.current;
    if (!el || !fgRef.current) return;
    const width = el.clientWidth;
    const height = el.clientHeight;
    if (width > 0 && height > 0) fgRef.current.width(width).height(height);
  }, []);

  useEffect(() => {
    updateSize();
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateSize]);

  const visibleNodeCount = useMemo(() => {
    const filters = { searchText, visibleNodeTypes, attributeFilterText };
    if (isAllVisible(filters)) return graph.nodes.length;
    return computeVisibleNodeIds(graph, filters).size;
  }, [graph, searchText, visibleNodeTypes, attributeFilterText]);

  const hierarchyCount = graph.edges.filter(
    (edge) => edge.edgeType === "hierarchy",
  ).length;
  const crossRefCount = graph.edges.length - hierarchyCount;

  return (
    <div className="relative flex h-full w-full flex-col border border-dashed border-border font-mono">
      <div
        ref={containerRef}
        className="min-h-0 w-full flex-1 overflow-hidden"
        aria-label={`${graph.name} graph`}
      />
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-dashed border-border bg-background px-3 py-1">
        <span className="truncate font-mono text-xs text-muted-foreground">
          {visibleNodeCount !== graph.nodes.length ? (
            <>
              <span className="text-foreground">{visibleNodeCount}</span>
              {" / "}
              {graph.nodes.length} nodes
            </>
          ) : (
            <>{graph.nodes.length} nodes</>
          )}
          {" · "}
          {crossRefCount} cross-ref, {hierarchyCount} hierarchy
        </span>
        <span className="truncate font-mono text-xs text-muted-foreground">
          {graph.name}
        </span>
      </div>
    </div>
  );
}

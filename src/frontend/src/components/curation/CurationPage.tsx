import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useHyvmindGraphData, useHyvmindGraphs } from "../../hooks/useHyvmind";
import { resolveCuration } from "../../lib/curations";
import { type SourceNode, toSourceGraph } from "../../lib/graphView";
import {
  ALL_NODE_TYPES,
  computeVisibleNodeIds,
  isAllVisible,
} from "../../lib/graphVisibility";
import { totalTrustUnits } from "../../lib/hyvmind";
import { GraphCanvas } from "./GraphCanvas";
import { GraphFilters } from "./GraphFilters";
import { NodeDetailsPanel } from "./NodeDetailsPanel";

interface CurationPageProps {
  slug: string;
  pinnedGraphId?: string | null;
  focusNodeId?: string | null;
}

const defaultVisibleTypes = () => new Set(ALL_NODE_TYPES);

function useCompactFilters() {
  const [collapsed, setCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setCollapsed(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return [collapsed, setCollapsed] as const;
}

/**
 * A shareable page for one published curation. Public: it reads only the app's
 * HTTP API, so it works signed out and without the router (the app itself is
 * hash-routed behind the identity gate).
 */
export function CurationPage({
  slug,
  pinnedGraphId,
  focusNodeId,
}: CurationPageProps) {
  const graphs = useHyvmindGraphs();
  const graph = useMemo(
    () => resolveCuration(graphs.data ?? [], slug, pinnedGraphId),
    [graphs.data, slug, pinnedGraphId],
  );
  // A pinned id (every post link has one) lets the graph payload load in
  // parallel with the metadata list instead of waiting for it.
  const data = useHyvmindGraphData(graph?.id ?? pinnedGraphId ?? null);
  const sourceGraph = useMemo(
    () => (graph && data.data ? toSourceGraph(data.data, graph) : null),
    [graph, data.data],
  );

  const { identity } = useInternetIdentity();
  const [searchText, setSearchText] = useState("");
  const [attributeFilterText, setAttributeFilterText] = useState("");
  const [visibleNodeTypes, setVisibleNodeTypes] =
    useState<Set<string>>(defaultVisibleTypes);
  const [selectedNode, setSelectedNode] = useState<SourceNode | null>(null);
  const [collapsed, setCollapsed] = useCompactFilters();
  const fitRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!sourceGraph || !focusNodeId) return;
    const node = sourceGraph.nodes.find((entry) => entry.id === focusNodeId);
    if (node) setSelectedNode(node);
  }, [sourceGraph, focusNodeId]);

  useEffect(() => {
    if (!graph) {
      if (graphs.isLoading) return;
      document.title = "Graph not found · hyvmind.xyz";
      return;
    }
    const previous = graph.name;
    document.title = `${graph.name} · hyvmind.xyz`;
    return () => {
      document.title = `${previous} · hyvmind.xyz`;
    };
  }, [graph, graphs.isLoading]);

  const visibleCount = useMemo(() => {
    if (!sourceGraph) return 0;
    const filters = { searchText, visibleNodeTypes, attributeFilterText };
    if (isAllVisible(filters)) return sourceGraph.nodes.length;
    return computeVisibleNodeIds(sourceGraph, filters).size;
  }, [sourceGraph, searchText, visibleNodeTypes, attributeFilterText]);

  const resetFilters = () => {
    setSearchText("");
    setAttributeFilterText("");
    setVisibleNodeTypes(defaultVisibleTypes());
  };

  const trust = graph ? totalTrustUnits(graph.authorDetails) : null;
  const contributors = graph?.authorDetails?.length ?? 0;

  const contributionsHref =
    selectedNode && graph && identity
      ? `/#/node/${encodeURIComponent(graph.id)}?node=${encodeURIComponent(selectedNode.id)}`
      : null;

  const loading = graphs.isLoading || (!!graph && data.isLoading);

  return (
    <div className="flex h-[100dvh] flex-col bg-background text-foreground">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-dashed border-border bg-card px-3 font-mono md:px-4">
        <a
          href="/"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          hyvmind.xyz
        </a>
        <span className="text-muted-foreground">/</span>
        <span className="min-w-0 truncate text-sm font-semibold">
          {graph?.name ?? slug}
        </span>

        <span className="ml-auto flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
          {trust !== null && (
            <span
              className="text-foreground"
              title={`Total trust across ${contributors} contributor${contributors === 1 ? "" : "s"}`}
            >
              {trust} TRUST
              {contributors > 1 && (
                <span className="hidden text-muted-foreground sm:inline">
                  {" · "}
                  {contributors} contributors
                </span>
              )}
            </span>
          )}
          {sourceGraph && (
            <span className="hidden md:inline">
              {sourceGraph.nodes.length} nodes · {sourceGraph.edges.length}{" "}
              edges · rev {sourceGraph.revision}
            </span>
          )}
          <a
            href="https://hyvmind.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
          >
            hyvmind.app
            <ArrowUpRight className="h-3 w-3" />
          </a>
        </span>
      </header>

      {loading && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && (!graph || graphs.isError) && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center font-mono">
          <p className="text-sm text-foreground">This graph isn't here.</p>
          <p className="max-w-md text-xs text-muted-foreground">
            {graphs.isError
              ? "Couldn't reach hyvmind.app. Reload to try again."
              : `No published curation matches “${slug}”.`}
          </p>
          <a href="/" className="text-xs underline hover:text-foreground">
            go to hyvmind.xyz
          </a>
        </div>
      )}

      {!loading && graph && data.isError && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center font-mono">
          <p className="text-sm text-foreground">Couldn't load this graph.</p>
          <p className="max-w-md text-xs text-muted-foreground">
            hyvmind.app didn't return the nodes. Reload to try again.
          </p>
        </div>
      )}

      {!loading && graph && sourceGraph && (
        <div className="flex min-h-0 flex-1">
          <div className="min-h-0 min-w-0 flex-1">
            <GraphCanvas
              graph={sourceGraph}
              onNodeClick={setSelectedNode}
              searchText={searchText}
              visibleNodeTypes={visibleNodeTypes}
              attributeFilterText={attributeFilterText}
              focusNodeId={focusNodeId}
              onFitToVisible={(fit) => {
                fitRef.current = fit;
              }}
            />
          </div>
          <GraphFilters
            searchText={searchText}
            onSearchChange={setSearchText}
            visibleNodeTypes={visibleNodeTypes}
            onNodeTypesChange={setVisibleNodeTypes}
            attributeFilterText={attributeFilterText}
            onAttributeFilterChange={setAttributeFilterText}
            totalNodes={sourceGraph.nodes.length}
            visibleNodes={visibleCount}
            onReset={resetFilters}
            onFitToVisible={() => fitRef.current?.()}
            isCollapsed={collapsed}
            onToggleCollapsed={() => setCollapsed((value) => !value)}
          />
        </div>
      )}

      {selectedNode && (
        <NodeDetailsPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          contributionsHref={contributionsHref}
        />
      )}
    </div>
  );
}

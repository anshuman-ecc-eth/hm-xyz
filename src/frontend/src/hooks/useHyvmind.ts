import { useQueries, useQuery } from "@tanstack/react-query";
import {
  type GraphMeta,
  type ResolvedNode,
  fetchGraphData,
  fetchGraphs,
  fetchNodes,
  resolveNodes,
} from "../lib/hyvmind";

const STALE_MS = 60_000;

export function useHyvmindGraphs() {
  return useQuery({
    queryKey: ["hyvmind", "graphs"],
    queryFn: fetchGraphs,
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

async function loadGraphNodes(graph: GraphMeta): Promise<ResolvedNode[]> {
  const { nodes } = await fetchNodes(graph.id);
  return resolveNodes(graph, nodes);
}

export function useHyvmindNodes(graphId: string | null) {
  const graphs = useHyvmindGraphs();

  return useQuery({
    queryKey: ["hyvmind", "nodes", graphId],
    queryFn: async () => {
      const graph = graphs.data?.find((g) => g.id === graphId);
      if (!graph) throw new Error("Unknown graph");
      return loadGraphNodes(graph);
    },
    enabled: !!graphId && !!graphs.data,
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/**
 * The whole published graph (all node types plus cross-reference edges), for
 * the curation page. Counts come from the payload, not from graph metadata.
 */
export function useHyvmindGraphData(graphId: string | null) {
  return useQuery({
    queryKey: ["hyvmind", "graphData", graphId],
    queryFn: () => fetchGraphData(graphId as string),
    enabled: !!graphId,
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/**
 * Loads several graphs' nodes in parallel. Used by the activity rail, where the
 * cited graphs are known only at runtime; keys match `useHyvmindNodes`, so the
 * cache is shared with the node page.
 */
export function useHyvmindNodesMany(graphIds: string[]) {
  const graphs = useHyvmindGraphs();

  return useQueries({
    queries: graphIds.map((graphId) => ({
      queryKey: ["hyvmind", "nodes", graphId],
      queryFn: async () => {
        const graph = graphs.data?.find((g) => g.id === graphId);
        if (!graph) throw new Error("Unknown graph");
        return loadGraphNodes(graph);
      },
      enabled: !!graphs.data,
      staleTime: STALE_MS,
      refetchOnWindowFocus: false,
      retry: 1,
    })),
  });
}

/** Fans out over every published graph. ~10 graphs, one call each. */
export function useAllHyvmindNodes(enabled: boolean) {
  const graphs = useHyvmindGraphs();

  return useQuery({
    queryKey: ["hyvmind", "allNodes"],
    queryFn: async () => {
      const list = graphs.data ?? [];
      const pages = await Promise.all(
        list.map(async (graph) => {
          try {
            return await loadGraphNodes(graph);
          } catch {
            return [];
          }
        }),
      );
      return pages.flat();
    },
    enabled: enabled && !!graphs.data,
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
    retry: 0,
  });
}

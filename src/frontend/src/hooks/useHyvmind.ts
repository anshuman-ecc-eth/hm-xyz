import { useQueries, useQuery } from "@tanstack/react-query";
import {
  type GraphMeta,
  type ResolvedNode,
  fetchGraphData,
  fetchGraphs,
  fetchNodes,
  resolveNodes,
  trustUnits,
} from "../lib/hyvmind";

const STALE_MS = 60_000;

export function useHyvmindGraphs(enabled = true) {
  return useQuery({
    queryKey: ["hyvmind", "graphs"],
    queryFn: fetchGraphs,
    enabled,
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/**
 * The linked app principal's public trust, read from the published graphs'
 * `authorDetails`. Trust is global in the app, so any graph that lists the
 * principal carries the same score; taking the max is defensive against stale
 * duplicates.
 */
export function useLinkedTrust(appPrincipal: string | null, enabled = true) {
  const graphs = useHyvmindGraphs(enabled);

  return useQuery({
    queryKey: ["hyvmind", "linkedTrust", appPrincipal],
    queryFn: () => {
      if (!appPrincipal) return null;
      let trust: number | null = null;
      for (const graph of graphs.data ?? []) {
        for (const author of graph.authorDetails ?? []) {
          if (author.principal !== appPrincipal) continue;
          const units = trustUnits(author.trustScore);
          if (units === null) continue;
          trust = trust === null ? units : Math.max(trust, units);
        }
      }
      return trust;
    },
    enabled: enabled && !!appPrincipal && !!graphs.data,
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

import { useMemo } from "react";
import type { ResolvedNode } from "../lib/hyvmind";
import {
  type GraphActivityEvent,
  buildGraphActivity,
} from "../utils/graphActivity";
import type { Post } from "../utils/types";
import { useHyvmindNodesMany } from "./useHyvmind";
import { useHomeFeed, useProfile } from "./useQueries";

export interface GraphActivityResult {
  events: GraphActivityEvent[];
  isLoading: boolean;
  isError: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
}

/**
 * Published interpretations from the home feed (self + people you follow),
 * enriched with the nearest location/swarm from the live graph.
 */
export function useGraphActivity(): GraphActivityResult {
  const home = useHomeFeed();
  const profile = useProfile();

  const posts = useMemo(
    () =>
      (home.data?.pages.flatMap((page) => page.posts) ??
        []) as unknown as Post[],
    [home.data],
  );

  // Only published originals need a graph lookup.
  const graphIds = useMemo(() => {
    const ids = new Set<string>();
    for (const post of posts) {
      if ("original" in post.postType && post.graphRef?.tokenNodeId) {
        ids.add(post.graphRef.graphId);
      }
    }
    return [...ids].sort();
  }, [posts]);

  const nodeQueries = useHyvmindNodesMany(graphIds);

  const events = useMemo(() => {
    const nodesByGraph = new Map<string, ResolvedNode[]>();
    graphIds.forEach((graphId, index) => {
      const data = nodeQueries[index]?.data;
      if (data) nodesByGraph.set(graphId, data);
    });
    return buildGraphActivity({
      posts,
      nodesByGraph,
      selfUsername: profile.data?.username,
    });
  }, [posts, graphIds, nodeQueries, profile.data?.username]);

  return {
    events,
    isLoading: home.isLoading,
    isError: home.isError,
    hasNextPage: !!home.hasNextPage,
    fetchNextPage: () => {
      void home.fetchNextPage();
    },
    isFetchingNextPage: home.isFetchingNextPage,
  };
}

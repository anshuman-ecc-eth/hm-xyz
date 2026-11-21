import { create } from "zustand";

interface AppState {
  composeMode: "new" | "reply" | "quote" | null;
  composeQuotedPostId: bigint | null;
  composeReplyToId: bigint | null;
  /** Set after a citation post is created, so its publish dialog opens itself. */
  pendingPublishPostId: bigint | null;

  startReply: (postId: bigint) => void;
  startQuote: (postId: bigint) => void;
  clearCompose: () => void;
  setPendingPublishPostId: (postId: bigint | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  composeMode: null,
  composeQuotedPostId: null,
  composeReplyToId: null,
  pendingPublishPostId: null,

  startReply: (postId) =>
    set({ composeMode: "reply", composeReplyToId: postId }),

  startQuote: (postId) =>
    set({ composeMode: "quote", composeQuotedPostId: postId }),

  clearCompose: () =>
    set({
      composeMode: null,
      composeQuotedPostId: null,
      composeReplyToId: null,
      pendingPublishPostId: null,
    }),

  setPendingPublishPostId: (postId) => set({ pendingPublishPostId: postId }),
}));

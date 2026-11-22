import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Link2, Loader2, Paperclip, X } from "lucide-react";
import type React from "react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  ChainInput,
  ExternalBlob,
  GraphRefInput,
  UserProfileResponse,
  XyzCommitOutcome,
  XyzPreviewResult,
} from "../backend";
import { useDebounce } from "../hooks/useDebounce";
import { useMediaUpload } from "../hooks/useMediaUpload";
import {
  useCommitXyzWrite,
  useCreateChainPost,
  useCreateGraphPost,
  useCreatePost,
  useCreateReply,
  useLinkedBuzzBalance,
  usePost,
  usePreviewXyzWrite,
  useQuotePost,
  useSearchUsers,
} from "../hooks/useQueries";
import { useAppStore } from "../stores/useAppStore";
import { fromNanoseconds, getInitials } from "../utils/formatting";
import { NodeCitationPicker } from "./NodeCitationPicker";
import { PostText } from "./PostText";

interface ComposePostProps {
  replyToId?: bigint | null;
  quotedPostId?: bigint | null;
}

/**
 * The mention being typed at the caret: `start` is the index of the `@`, and
 * `query` is what follows it up to the caret. Emails (word char before @) and
 * anything containing whitespace are not mentions.
 */
function mentionAt(
  value: string,
  caret: number,
): { start: number; query: string } | null {
  const before = value.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0 && /[\w@]/.test(value[at - 1])) return null;
  const query = before.slice(at + 1);
  if (!/^[a-zA-Z0-9_]{0,20}$/.test(query)) return null;
  return { start: at, query };
}

const CHAIN_NODE_COST: Record<string, number> = {
  curation: 10,
  swarm: 20,
  location: 30,
  lawEntity: 40,
};

function chainCostTenths(chain: ChainInput): number {
  return (
    50 +
    chain.levels.reduce(
      (total, level) => total + (CHAIN_NODE_COST[level.nodeType] ?? 0),
      0,
    )
  );
}

const withBuzz = (text: string) =>
  /\bbuzz\b/i.test(text) ? text : `${text} BUZZ`;

export function ComposePost({ replyToId, quotedPostId }: ComposePostProps) {
  const isReplyMode = replyToId != null;
  const isQuoteMode = quotedPostId != null;
  const clearCompose = useAppStore((s) => s.clearCompose);
  const setPendingPublishPostId = useAppStore((s) => s.setPendingPublishPostId);
  const [text, setText] = useState("");
  const { mutate: createPost, isPending: isPostPending } = useCreatePost();
  const { mutate: createGraphPost, isPending: isGraphPostPending } =
    useCreateGraphPost();
  const { mutate: createReply, isPending: isReplyPending } = useCreateReply();
  const { mutate: quotePost, isPending: isQuotePending } = useQuotePost();
  const { data: quotedPost } = usePost(quotedPostId ?? null);
  const { data: replyToPost } = usePost(replyToId ?? null);

  const [citation, setCitation] = useState<GraphRefInput | null>(null);
  const [chain, setChain] = useState<ChainInput | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [directPublishing, setDirectPublishing] = useState(false);

  const { mutate: createChainPost, isPending: isChainPostPending } =
    useCreateChainPost();
  const previewXyzWrite = usePreviewXyzWrite();
  const commitXyzWrite = useCommitXyzWrite();
  const { data: buzz } = useLinkedBuzzBalance(pickerOpen || chain != null);

  // Mention autocomplete. The dropdown follows the `@` under the caret.
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionListId = useId();
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [activeMention, setActiveMention] = useState(0);
  const debouncedMentionQuery = useDebounce(mentionQuery, 200);
  const mentionResults = useSearchUsers(
    mentionStart != null ? debouncedMentionQuery : "",
  );
  const suggestions: UserProfileResponse[] =
    mentionResults.data?.slice(0, 6) ?? [];
  const mentionOpen = mentionStart != null && mentionQuery.length > 0;
  const activeSuggestion = Math.min(
    activeMention,
    Math.max(0, suggestions.length - 1),
  );

  // A reply or quote of a token inherits its node on the server; the composer
  // only shows it, and never lets the user change it.
  const inheritedRef = isReplyMode
    ? replyToPost?.graphRef
    : isQuoteMode
      ? quotedPost?.graphRef
      : undefined;

  const isPending = isReplyMode
    ? isReplyPending
    : isQuoteMode
      ? isQuotePending
      : chain
        ? isChainPostPending
        : citation
          ? isGraphPostPending
          : isPostPending;
  const {
    file,
    previewUrl,
    error: mediaError,
    mediaType,
    selectMedia,
    removeMedia,
    createBlob,
    MediaInput,
  } = useMediaUpload();
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const isEmpty = text.trim().length === 0 && !file;
  const isTextEmpty = text.trim().length === 0;

  // One click: create the post, preview its plan, and commit it. If anything
  // fails, the post survives as an unpublished proposal; nothing is charged.
  const publishChain = async (postId: bigint) => {
    setDirectPublishing(true);
    try {
      let preview: XyzPreviewResult;
      try {
        preview = await previewXyzWrite.mutateAsync(postId);
        if (preview.__kind__ === "throttled") {
          const retryAfterMs = Number(preview.throttled.retryAfterMs);
          await new Promise((resolve) =>
            setTimeout(resolve, retryAfterMs + 75),
          );
          preview = await previewXyzWrite.mutateAsync(postId);
        }
      } catch {
        toast.error(
          "Posted, but hyvmind.app could not be reached. Publish from the card.",
        );
        return;
      }

      switch (preview.__kind__) {
        case "ready":
          break;
        case "insufficient":
          toast.error("Not enough BUZZ. The chain is saved as unpublished.");
          return;
        case "blocked":
          toast.error(preview.blocked.message);
          return;
        case "notLinked":
          toast.error(
            "Link your hyvmind.app account to publish. The chain is saved as unpublished.",
          );
          return;
        case "gate":
          toast.error(preview.gate.message);
          return;
        case "throttled":
          toast.error(
            "hyvmind.app is rate limiting previews. Publish from the card in a moment.",
          );
          return;
        case "err":
          toast.error(preview.err.message);
          return;
      }

      try {
        const outcome: XyzCommitOutcome = await commitXyzWrite.mutateAsync({
          postId,
          digest: preview.ready.plan.digest,
        });
        switch (outcome.__kind__) {
          case "ok":
            toast.success(`Published for ${withBuzz(outcome.ok.costText)}`);
            break;
          case "stale":
            toast.error("The graph changed. Review the new plan on the post.");
            break;
          case "insufficient":
            toast.error("Not enough BUZZ. The chain is saved as unpublished.");
            break;
          case "blocked":
            toast.error(outcome.blocked.message);
            break;
          case "notLinked":
            toast.error("Link your hyvmind.app account to publish.");
            break;
          case "gate":
            toast.error(outcome.gate.message);
            break;
          case "unknown":
            toast.error("The app did not confirm. Check status on the post.");
            break;
          case "busy":
            toast.error("A publish for this post is already in progress.");
            break;
          case "conflict":
            toast.error(outcome.conflict.message);
            break;
          case "alreadyPublished":
            toast.success("This post is already published");
            break;
          case "err":
            toast.error(outcome.err.message);
            break;
        }
      } catch {
        toast.error("The app did not confirm. Check status on the post.");
      }
    } finally {
      setDirectPublishing(false);
    }
  };

  const handleSubmit = async () => {
    if (isTextEmpty && !file) return;

    let mediaHash: ExternalBlob | null = null;
    if (file) {
      try {
        setUploadProgress(0);
        mediaHash = await createBlob((pct) => setUploadProgress(pct));
      } catch {
        toast.error("Failed to upload media");
        setUploadProgress(null);
        return;
      }
    }

    const hadCitation = citation != null;
    const onSuccess = (created?: {
      id: bigint;
      graphRef?: { tokenNodeId?: string };
    }) => {
      setText("");
      removeMedia();
      setUploadProgress(null);
      setCitation(null);
      setChain(null);
      setMentionStart(null);
      setMentionQuery("");
      if (isQuoteMode) {
        clearCompose();
        toast.success("Quote posted");
      } else if (isReplyMode) {
        toast.success("Reply posted");
      } else if (hadCitation) {
        toast.success("Posted with citation");
        // The post is only an anchor until the graph write is committed, so
        // hand its id to the card so the publish dialog can open itself.
        if (created?.graphRef && !created.graphRef.tokenNodeId) {
          setPendingPublishPostId(created.id);
        }
      } else {
        toast.success("Post published");
      }
    };

    const onError = (error: Error) => {
      setUploadProgress(null);
      toast.error(error.message || "Failed to create post");
    };

    if (isQuoteMode) {
      quotePost(
        { postId: quotedPostId, text: text.trim(), mediaHash, mediaType },
        { onSuccess, onError },
      );
    } else if (isReplyMode) {
      createReply(
        { parentPostId: replyToId, text: text.trim(), mediaHash, mediaType },
        { onSuccess, onError },
      );
    } else if (chain) {
      createChainPost(
        { chain, text: text.trim(), mediaHash, mediaType },
        {
          onSuccess: (created) => {
            setText("");
            removeMedia();
            setUploadProgress(null);
            setChain(null);
            setCitation(null);
            setMentionStart(null);
            setMentionQuery("");
            toast.success("Chain posted — publishing…");
            void publishChain(created.id);
          },
          onError,
        },
      );
    } else if (citation) {
      createGraphPost(
        { ref: citation, text: text.trim(), mediaHash, mediaType },
        { onSuccess, onError },
      );
    } else {
      createPost(
        { text: text.trim(), mediaHash, mediaType },
        { onSuccess, onError },
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
      return;
    }

    if (!mentionOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveMention((index) =>
        suggestions.length > 0 ? (index + 1) % suggestions.length : 0,
      );
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveMention((index) =>
        suggestions.length > 0
          ? (index - 1 + suggestions.length) % suggestions.length
          : 0,
      );
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setMentionStart(null);
      return;
    }
    if ((e.key === "Enter" || e.key === "Tab") && suggestions.length > 0) {
      e.preventDefault();
      applyMention(suggestions[activeSuggestion]);
    }
  };

  const syncMention = (value: string, caret: number) => {
    const context = mentionAt(value, caret);
    if (!context) {
      setMentionStart(null);
      setMentionQuery("");
      setActiveMention(0);
      return;
    }
    if (context.query !== mentionQuery) setActiveMention(0);
    setMentionStart(context.start);
    setMentionQuery(context.query);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    syncMention(e.target.value, e.target.selectionStart ?? 0);
  };

  const handleTextSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    syncMention(e.currentTarget.value, e.currentTarget.selectionStart ?? 0);
  };

  const applyMention = (user: UserProfileResponse) => {
    if (mentionStart == null) return;
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? text.length;
    const next = `${text.slice(0, mentionStart)}@${user.username} ${text.slice(caret)}`;
    const position = mentionStart + user.username.length + 2;

    setText(next);
    setMentionStart(null);
    setMentionQuery("");
    setActiveMention(0);

    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(position, position);
    });
  };

  const handleDismissQuote = () => {
    clearCompose();
  };

  const isSubmitting = isPending || directPublishing || uploadProgress !== null;

  const chainPriceTenths = chain ? chainCostTenths(chain) : 0;
  const chainUnaffordable =
    chain != null && buzz != null && buzz.units < BigInt(chainPriceTenths);

  const placeholder = isQuoteMode
    ? "Add a comment..."
    : isReplyMode
      ? "Post your reply"
      : "What's happening?";

  const buttonLabel = isSubmitting
    ? isQuoteMode
      ? "Quoting..."
      : isReplyMode
        ? "Replying..."
        : chain
          ? "Publishing…"
          : "Posting..."
    : isQuoteMode
      ? "Quote"
      : isReplyMode
        ? "Reply"
        : chain
          ? `Post & publish · ${(chainPriceTenths / 10).toFixed(1)} BUZZ`
          : "Post";

  return (
    <div className="border-b border-border px-4 py-3 font-mono">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          id={isReplyMode ? "reply-textarea" : undefined}
          placeholder={placeholder}
          value={text}
          onChange={handleTextChange}
          onSelect={handleTextSelect}
          onKeyDown={handleKeyDown}
          onBlur={() => setMentionStart(null)}
          disabled={isSubmitting}
          maxLength={20000}
          aria-autocomplete="list"
          aria-expanded={mentionOpen}
          aria-controls={mentionOpen ? mentionListId : undefined}
          className={cn(
            "resize-none rounded-none border-0 bg-transparent p-0 font-sans shadow-none placeholder:text-muted-foreground focus-visible:ring-0",
            isReplyMode ? "min-h-[60px] text-sm" : "min-h-[80px] text-[15px]",
          )}
        />

        {mentionOpen && (
          <div
            id={mentionListId}
            aria-label="Mention suggestions"
            className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto border border-border bg-background shadow-md"
          >
            {mentionResults.isLoading || mentionResults.isFetching ? (
              <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> searching…
              </div>
            ) : suggestions.length === 0 ? (
              <p className="px-3 py-2 text-[11px] text-muted-foreground">
                No people found
              </p>
            ) : (
              suggestions.map((user, index) => (
                <button
                  key={user.principal.toText()}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveMention(index)}
                  onClick={() => applyMention(user)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors",
                    index === activeSuggestion
                      ? "bg-accent"
                      : "hover:bg-accent",
                  )}
                >
                  <Avatar className="h-7 w-7">
                    {user.profilePictureHash && (
                      <AvatarImage
                        src={user.profilePictureHash.getDirectURL()}
                        alt=""
                        className="object-cover"
                      />
                    )}
                    <AvatarFallback className="text-[10px]">
                      {getInitials(user.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px]">
                    {user.displayName}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    @{user.username}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      {inheritedRef && (
        <div className="mt-2 flex items-center gap-2 border border-border px-2 py-1.5">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
            {inheritedRef.path}
          </span>
          <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
            inherited
          </span>
        </div>
      )}
      {!inheritedRef && citation && (
        <div className="mt-2 border border-border">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-[11px]">
              {citation.path}
            </span>
            <button
              type="button"
              onClick={() => setCitation(null)}
              disabled={isSubmitting}
              aria-label="Remove citation"
              className="shrink-0 p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="border-t px-2 py-1 text-[10px] text-muted-foreground">
            Graph posts can't be edited or deleted, and replies attach to the
            same node.
          </p>
        </div>
      )}
      {!inheritedRef && chain && (
        <div className="mt-2 border border-border">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-[11px]">
              {[
                ...(chain.start ? [chain.start.nodeName] : []),
                ...chain.levels.map((level) => level.name),
              ].join(" › ")}
            </span>
            <button
              type="button"
              onClick={() => setChain(null)}
              disabled={isSubmitting}
              aria-label="Remove chain"
              className="shrink-0 p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 border-t px-2 py-1 text-[10px] text-muted-foreground">
            <span>
              {chain.levels.length + 1} new nodes ·{" "}
              {(chainPriceTenths / 10).toFixed(1)} BUZZ
            </span>
            <span className={cn(chainUnaffordable && "text-destructive")}>
              {buzz ? `you have ${buzz.text}` : "account not linked"}
            </span>
          </div>
          <p className="border-t px-2 py-1 text-[10px] text-muted-foreground">
            One write, one charge. The post is the interpretation token and
            can't be edited or deleted.{" "}
            {chain && isTextEmpty
              ? "A chain needs text: it becomes the interpretation token."
              : chainUnaffordable
                ? "Not enough BUZZ: this will be saved as unpublished."
                : ""}
          </p>
        </div>
      )}
      {isQuoteMode && quotedPost && (
        <div className="relative mt-2 border border-border p-3">
          <button
            type="button"
            className="absolute right-2 top-2 rounded-none p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={handleDismissQuote}
            aria-label="Dismiss quote"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              {quotedPost.authorProfilePictureHash && (
                <AvatarImage
                  src={quotedPost.authorProfilePictureHash.getDirectURL()}
                  alt={quotedPost.authorDisplayName}
                  className="object-cover"
                />
              )}
              <AvatarFallback className="text-[10px]">
                {getInitials(quotedPost.authorDisplayName)}
              </AvatarFallback>
            </Avatar>
            <span className="text-[12px] font-medium">
              {quotedPost.authorDisplayName}
            </span>
            <span className="text-[11px] text-muted-foreground">
              @{quotedPost.authorUsername}
            </span>
            <span className="text-[11px] text-muted-foreground">·</span>
            <span className="text-[11px] text-muted-foreground">
              {formatDistanceToNow(fromNanoseconds(quotedPost.createdAt), {
                addSuffix: true,
              })}
            </span>
          </div>
          <PostText
            text={quotedPost.text}
            className="mt-1 line-clamp-3 text-sm text-muted-foreground"
          />
        </div>
      )}
      {previewUrl && (
        <div className="relative mt-2 max-w-xs">
          <AspectRatio ratio={16 / 9}>
            {mediaType === "video" ? (
              // biome-ignore lint/a11y/useMediaCaption: media element
              <video
                src={previewUrl}
                controls
                className="h-full w-full rounded-md object-cover"
              />
            ) : (
              <img
                src={previewUrl}
                alt="Attachment preview"
                className="h-full w-full object-cover"
              />
            )}
          </AspectRatio>
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-1 top-1 h-6 w-6 rounded-none"
            onClick={removeMedia}
            disabled={isSubmitting}
            aria-label="Remove media"
          >
            <X className="h-3 w-3" />
          </Button>
          {uploadProgress !== null && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="text-sm font-medium text-white">
                {Math.round(uploadProgress)}%
              </span>
            </div>
          )}
        </div>
      )}
      {mediaError && (
        <p className="mt-1 text-sm text-destructive">{mediaError}</p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isReplyMode && !isQuoteMode && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-[11px]"
              onClick={() => setPickerOpen(true)}
              disabled={isSubmitting || !!citation || !!chain}
              aria-label="Cite a node"
            >
              <Link2 className="h-3.5 w-3.5" />
              Cite
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={selectMedia}
            disabled={isSubmitting || !!file}
            aria-label="Add media"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={
            isEmpty ||
            isSubmitting ||
            chainUnaffordable ||
            (!!chain && isTextEmpty)
          }
          size="sm"
          className="rounded-none border border-foreground bg-foreground text-[11px] tracking-[0.08em] text-background hover:bg-foreground/90"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {buttonLabel}
        </Button>
      </div>
      <MediaInput />
      <NodeCitationPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(ref) => {
          setChain(null);
          setCitation(ref);
        }}
        onSelectChain={(next) => {
          setCitation(null);
          setChain(next);
        }}
      />
    </div>
  );
}

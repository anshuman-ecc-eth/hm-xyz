import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { Repeat2 } from "lucide-react";
import { usePost } from "../../hooks/useQueries";
import { postPath } from "../../lib/posts";
import { fromNanoseconds, getInitials } from "../../utils/formatting";
import type { Post } from "../../utils/types";
import { PostText } from "../PostText";
import { PublicationGraph } from "../PublicationGraph";
import { SharePostButton } from "../SharePostButton";

interface PublicPostViewProps {
  post: Post;
  /** The repost envelope, when the URL was a repost. */
  repostedBy?: Post | null;
  compact?: boolean;
}

/**
 * Read-only post rendering for the public page. It fetches its own reply parent
 * and quoted post so the same component can render the main post and replies.
 */
export function PublicPostView({
  post,
  repostedBy,
  compact = false,
}: PublicPostViewProps) {
  const parentId = "reply" in post.postType ? post.postType.reply : null;
  const quoteId = "quote" in post.postType ? post.postType.quote : null;
  const { data: parentData } = usePost(parentId);
  const { data: quotedData, isLoading: isQuoteLoading } = usePost(quoteId);
  const parent = parentData ?? null;
  const quoted = quotedData ?? null;

  const avatarUrl = post.authorProfilePictureHash?.getDirectURL();
  const mediaUrl = post.mediaHash?.getDirectURL();
  const createdDate = fromNanoseconds(post.createdAt);

  return (
    <article
      className={compact ? "border-b px-4 py-3" : "border-b px-4 py-4"}
      aria-label={`Post by @${post.authorUsername}`}
    >
      {repostedBy && (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Repeat2 className="h-3.5 w-3.5" />
          <span>
            Reposted by{" "}
            <a
              href={postPath(repostedBy.id)}
              className="text-foreground hover:underline"
            >
              @{repostedBy.authorUsername}
            </a>
          </span>
        </div>
      )}

      {parentId && (
        <p className="mb-2 text-xs text-muted-foreground">
          Replying to{" "}
          {parent ? (
            <a
              href={postPath(parent.id)}
              className="text-foreground hover:underline"
            >
              @{parent.authorUsername}
            </a>
          ) : (
            <span className="text-foreground">a post</span>
          )}
        </p>
      )}

      <header className="flex items-start gap-3">
        <Avatar className={compact ? "h-8 w-8" : "h-10 w-10"}>
          {avatarUrl && (
            <AvatarImage
              src={avatarUrl}
              alt={post.authorDisplayName}
              className="object-cover"
            />
          )}
          <AvatarFallback className="text-[10px]">
            {getInitials(post.authorDisplayName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span
              className={
                compact
                  ? "truncate font-semibold text-sm"
                  : "truncate font-semibold"
              }
            >
              {post.authorDisplayName}
            </span>
            <span className="truncate font-mono text-xs text-muted-foreground">
              @{post.authorUsername}
            </span>
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">
            {formatDistanceToNow(createdDate, { addSuffix: true })}
            {post.editedAt != null && " · edited"}
          </p>
        </div>
      </header>

      {post.text && (
        <PostText
          text={post.text}
          citations={post.citations}
          mode="public"
          className={
            compact
              ? "mt-2 whitespace-pre-wrap break-words font-sans text-sm leading-[1.55]"
              : "mt-3 whitespace-pre-wrap break-words font-sans text-[15px] leading-[1.55]"
          }
        />
      )}

      {mediaUrl && post.mediaType === "video" && (
        // biome-ignore lint/a11y/useMediaCaption: user-uploaded media has no captions
        <video
          src={mediaUrl}
          controls
          preload="metadata"
          className="mt-2 max-h-[70vh] w-full border border-border bg-black"
        />
      )}
      {mediaUrl && post.mediaType !== "video" && (
        <img
          src={mediaUrl}
          alt="Post attachment"
          className="mt-2 max-h-[70vh] w-full border border-border object-contain"
        />
      )}

      {(post.graphRef || post.chain) && (
        <PublicationGraph post={post} linkMode="public" />
      )}

      {quoteId &&
        (isQuoteLoading ? (
          <Skeleton className="mt-2 h-16 w-full" />
        ) : quoted ? (
          <div className="mt-2 border border-border">
            <a
              href={postPath(quoted.id)}
              className="flex items-baseline gap-1.5 border-b border-border px-3 py-1.5 text-xs hover:underline"
            >
              <span className="truncate font-semibold">
                {quoted.authorDisplayName}
              </span>
              <span className="truncate font-mono text-muted-foreground">
                @{quoted.authorUsername}
              </span>
            </a>
            <PostText
              text={quoted.text}
              citations={quoted.citations}
              mode="public"
              className="line-clamp-3 whitespace-pre-wrap break-words px-3 py-2 text-sm text-muted-foreground"
            />
          </div>
        ) : (
          <p className="mt-2 border border-border px-3 py-2 text-xs text-muted-foreground">
            Quoted post unavailable.
          </p>
        ))}

      <footer className="mt-3 flex items-center gap-4 font-mono text-[11px] text-muted-foreground">
        <span>{post.replyCount.toString()} replies</span>
        <span>{post.repostCount.toString()} reposts</span>
        <span>{post.likeCount.toString()} likes</span>
        <SharePostButton postId={post.id} className="ml-auto" />
      </footer>
    </article>
  );
}

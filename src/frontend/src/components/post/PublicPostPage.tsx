import { ArrowUpRight, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { usePost, useReplies } from "../../hooks/useQueries";
import type { Post } from "../../utils/types";
import { SharePostButton } from "../SharePostButton";
import { PublicPostView } from "./PublicPostView";

interface PublicPostPageProps {
  postId: string;
}

/**
 * `/post/<id>` — the public, shareable post page. It reads through the same
 * anonymous actor the app uses signed out and never mounts the router, so a
 * shared link works without a profile.
 */
export function PublicPostPage({ postId }: PublicPostPageProps) {
  const numericId = /^\d+$/.test(postId) ? BigInt(postId) : null;

  const envelopeQuery = usePost(numericId);
  const envelope = (envelopeQuery.data ?? null) as Post | null;
  const repostId =
    envelope && "repost" in envelope.postType ? envelope.postType.repost : null;

  const originalQuery = usePost(repostId);
  const original = (originalQuery.data ?? null) as Post | null;
  const content = repostId ? original : envelope;

  const repliesQuery = useReplies(content?.id ?? null);
  const replies = repliesQuery.data?.pages.flatMap((page) => page.posts) ?? [];

  const loading =
    numericId !== null &&
    (envelopeQuery.isLoading || (repostId !== null && originalQuery.isLoading));
  const error = envelopeQuery.isError || originalQuery.isError;

  useEffect(() => {
    if (loading) return;
    if (!content) {
      document.title = "Post not found · hyvmind.xyz";
      return;
    }
    const firstLine =
      content.text
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.length > 0) ?? "";
    document.title = firstLine
      ? `${firstLine.slice(0, 60)} · hyvmind.xyz`
      : `@${content.authorUsername} · hyvmind.xyz`;
  }, [loading, content]);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-10 flex h-11 items-center gap-2 border-b border-dashed border-border bg-background/95 px-4 font-mono backdrop-blur">
        <a
          href="/"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          hyvmind.xyz
        </a>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-semibold">post</span>
        <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          {content && <SharePostButton postId={content.id} />}
          <a
            href={`/#/post/${postId}`}
            className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
          >
            open in app
            <ArrowUpRight className="h-3 w-3" />
          </a>
        </span>
      </header>

      <main className="mx-auto w-full max-w-2xl">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-2 px-6 py-24 text-center font-mono">
            <p className="text-sm">Couldn't load this post.</p>
            <p className="text-xs text-muted-foreground">
              The backend didn't answer. Reload to try again.
            </p>
          </div>
        )}

        {!loading && !error && !content && (
          <div className="flex flex-col items-center gap-2 px-6 py-24 text-center font-mono">
            <p className="text-sm">This post isn't here.</p>
            <p className="text-xs text-muted-foreground">
              It may have been deleted, or the link is wrong.
            </p>
            <a href="/" className="text-xs underline hover:text-foreground">
              go to hyvmind.xyz
            </a>
          </div>
        )}

        {!loading && !error && content && (
          <>
            <PublicPostView
              post={content}
              repostedBy={repostId ? envelope : null}
            />

            <section aria-label="Replies">
              {repliesQuery.isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}

              {!repliesQuery.isLoading &&
                !repliesQuery.isError &&
                replies.length === 0 && (
                  <p className="border-b px-4 py-8 text-center font-mono text-xs text-muted-foreground">
                    No replies yet.
                  </p>
                )}

              {replies.map((reply) => (
                <PublicPostView
                  key={reply.id.toString()}
                  post={reply}
                  compact
                />
              ))}

              {repliesQuery.hasNextPage && (
                <div className="flex justify-center border-b px-4 py-3">
                  <button
                    type="button"
                    onClick={() => repliesQuery.fetchNextPage()}
                    disabled={repliesQuery.isFetchingNextPage}
                    className="border border-border px-3 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                  >
                    {repliesQuery.isFetchingNextPage ? "loading…" : "load more"}
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

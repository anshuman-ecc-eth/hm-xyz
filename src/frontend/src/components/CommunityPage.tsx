import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getRouteApi } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Send, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import {
  useAcceptCommunityInvite,
  useCommunity,
  useCommunityMessages,
  useSendCommunityMessage,
} from "../hooks/useQueries";
import { fromNanoseconds, getInitials } from "../utils/formatting";
import { BackButton } from "./BackButton";

const routeApi = getRouteApi("/community/$id");

export function CommunityPage() {
  const { id } = routeApi.useParams();
  const community = useCommunity(id);
  const messages = useCommunityMessages(id);
  const { mutate: send, isPending: isSending } = useSendCommunityMessage(id);
  const { mutate: accept, isPending: isAccepting } = useAcceptCommunityInvite();
  const [text, setText] = useState("");

  const isMember = community.data?.isMember ?? false;
  const hasInvite = community.data?.hasInvite ?? false;

  const pages = messages.data?.pages ?? [];
  const all = pages.flatMap((page) => page.messages);

  const sentinelRef = useInfiniteScroll({
    hasNextPage: messages.hasNextPage,
    isFetchingNextPage: messages.isFetchingNextPage,
    fetchNextPage: messages.fetchNextPage,
  });

  const submit = () => {
    const body = text.trim();
    if (body.length === 0) return;
    send(body, {
      onSuccess: (result) => {
        if (result.__kind__ === "err") {
          toast.error(result.err);
          return;
        }
        setText("");
      },
      onError: () => toast.error("Could not send message"),
    });
  };

  return (
    <div className="pb-16">
      <div className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="flex items-center gap-2 px-4 py-3">
          <BackButton className="shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-mono text-[15px] font-semibold">
              {community.data?.name ?? "Community"}
            </h1>
            {community.data && (
              <p className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {community.data.memberCount.toString()} members · writing here
                grants no permissions beyond this swarm
              </p>
            )}
          </div>
        </div>
      </div>

      {community.isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable list
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !community.data ? (
        <div className="flex flex-col items-center px-8 py-16 text-center">
          <Users className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            This community is not visible to you. Membership is required.
          </p>
        </div>
      ) : (
        <>
          {!isMember && (
            <div className="border-b border-border bg-primary/5 px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {hasInvite
                  ? "You were invited to this community."
                  : "You are not a member of this community."}
              </p>
              {hasInvite && (
                <Button
                  size="sm"
                  className="mt-2 h-7 px-3 text-xs"
                  disabled={isAccepting}
                  onClick={() =>
                    accept(id, {
                      onError: () => toast.error("Could not join community"),
                    })
                  }
                >
                  {isAccepting && (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  )}
                  Join community
                </Button>
              )}
            </div>
          )}

          {isMember && (
            <div className="border-b border-border px-4 py-3">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Message the community. Mention @username to invite someone."
                rows={2}
                maxLength={2000}
                className="resize-none rounded-none font-mono text-[13px]"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {text.length}/2000
                </span>
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs"
                  disabled={isSending || text.trim().length === 0}
                  onClick={submit}
                >
                  {isSending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Send
                </Button>
              </div>
            </div>
          )}

          {messages.isLoading ? (
            <div className="flex justify-center p-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : all.length === 0 ? (
            <p className="p-6 text-center text-xs text-muted-foreground">
              No messages yet. {isMember ? "Start the conversation." : ""}
            </p>
          ) : (
            <ul>
              {all.map((message) => (
                <li
                  key={message.id.toString()}
                  className="flex items-start gap-3 border-b px-4 py-3"
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-[10px]">
                      {getInitials(message.authorUsername)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs">
                      <span className="font-semibold">
                        {message.authorDisplayName || message.authorUsername}
                      </span>{" "}
                      <span className="text-muted-foreground">
                        @{message.authorUsername} ·{" "}
                        {formatDistanceToNow(
                          fromNanoseconds(message.createdAt),
                          { addSuffix: true },
                        )}
                      </span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-[13px]">
                      {message.text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div ref={sentinelRef} className="h-1" />
          {messages.isFetchingNextPage && (
            <div className="flex justify-center p-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { toast } from "sonner";
import {
  useAcceptCommunityInvite,
  useDeclineCommunityInvite,
  useMyCommunities,
  useMyCommunityInvites,
} from "../hooks/useQueries";
import { BackButton } from "./BackButton";

function memberLabel(count: bigint): string {
  return count === 1n ? "1 member" : `${count} members`;
}

export function CommunitiesPage() {
  const { data: communities, isLoading, isError } = useMyCommunities();
  const { data: invites } = useMyCommunityInvites();
  const { mutate: accept, isPending: isAccepting } = useAcceptCommunityInvite();
  const { mutate: decline } = useDeclineCommunityInvite();

  const pending = invites ?? [];

  return (
    <div className="pb-16">
      <div className="sticky top-0 z-10 border-b border-border bg-background font-mono">
        <div className="flex items-center gap-2 px-4 py-3">
          <BackButton className="shrink-0" />
          <h1 className="flex-1 text-lg font-semibold">Communities</h1>
        </div>
      </div>

      {pending.length > 0 && (
        <section className="border-b border-border">
          <p className="px-4 pt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Invitations
          </p>
          {pending.map((invite) => (
            <div
              key={invite.id}
              className="flex items-start gap-3 border-b border-border/60 px-4 py-3 last:border-b-0"
            >
              <Users className="mt-1 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{invite.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {memberLabel(invite.memberCount)} · you were mentioned
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() =>
                    decline(invite.id, {
                      onError: () => toast.error("Could not decline invite"),
                    })
                  }
                >
                  Decline
                </Button>
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={isAccepting}
                  onClick={() =>
                    accept(invite.id, {
                      onError: () => toast.error("Could not join community"),
                    })
                  }
                >
                  Join
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}

      {isLoading ? (
        <div className="space-y-1">
          {Array.from({ length: 3 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable list
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-none" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <p className="p-4 text-center text-destructive">
          Failed to load communities.
        </p>
      ) : !communities || communities.length === 0 ? (
        <div className="flex flex-col items-center px-8 py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center bg-primary/10">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <p className="text-lg font-semibold">No communities yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Every swarm in a Hyvmind graph has a community named after it. You
            join when you create a swarm, or when a member mentions you in its
            chat.
          </p>
        </div>
      ) : (
        <ul>
          {communities.map((community) => (
            <li key={community.id}>
              <Link
                to="/community/$id"
                params={{ id: community.id }}
                className={cn(
                  "flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted/50",
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-primary/10 text-[11px] font-semibold uppercase text-primary">
                  {community.name.slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {community.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {memberLabel(community.memberCount)}
                    {community.isCreator ? " · you created this swarm" : ""}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

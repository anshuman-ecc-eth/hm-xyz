import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Check, Copy, ExternalLink, Loader2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { XyzPathCreator, XyzPlan } from "../backend";
import {
  useCommitXyzWrite,
  usePreviewXyzWrite,
  useReconcileXyzWrite,
  useXyzWriteDraft,
} from "../hooks/useQueries";
import { useAppStore } from "../stores/useAppStore";
import { formatNodeType } from "../utils/formatting";
import type { Post } from "../utils/types";

const TOP_UP_URL = "https://hyvmind.app/?settings=wallet&redeem=1";

/**
 * The app may or may not include the unit in its money strings. Normalise so
 * the dialog never prints "12 BUZZ BUZZ".
 */
const withBuzz = (text: string) =>
  /\bbuzz\b/i.test(text) ? text : `${text} BUZZ`;

type Blocked = {
  message: string;
  reason: string;
  pathCreators: XyzPathCreator[];
  plan: XyzPlan;
};

function CopyId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex shrink-0 items-center gap-1 bg-muted px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      node id
    </button>
  );
}

function PlanSummary({ plan }: { plan: XyzPlan }) {
  return (
    <div className="border">
      <div className="flex items-baseline justify-between border-b px-3 py-2">
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          this write
        </span>
        <span className="text-[12px]">
          {withBuzz(plan.costText)}{" "}
          <span className="text-muted-foreground">
            · you have {withBuzz(plan.balanceText)}
          </span>
        </span>
      </div>
      <ul className="space-y-1 px-3 py-2">
        {plan.lines.map((line) => (
          <li
            key={line}
            className="text-[11px] leading-relaxed text-muted-foreground"
          >
            {line}
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between border-t px-3 py-1.5 text-[10px] text-muted-foreground">
        <span>graph revision {plan.revision.toString()}</span>
        <span>{plan.creates.toString()} new</span>
      </div>
    </div>
  );
}

function BlockedBy({ blocked }: { blocked: Blocked }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-relaxed">{blocked.message}</p>
      {blocked.pathCreators.length > 0 ? (
        <ul className="space-y-1.5 border px-3 py-2">
          {blocked.pathCreators.map((creator) => (
            <li key={creator.appPrincipal.toText()} className="text-[11px]">
              <span className="font-medium">
                {creator.displayName ?? "unnamed"}
              </span>
              <span className="text-muted-foreground">
                {creator.linked
                  ? " — you and they don't follow each other yet."
                  : " — hasn't linked a hyvmind.xyz account."}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-1 border px-3 py-2">
          {blocked.plan.lines.slice(0, 4).map((line) => (
            <li
              key={line}
              className="text-[11px] leading-relaxed text-muted-foreground"
            >
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PublishToGraph({ post }: { post: Post }) {
  const graphRef = post.graphRef;
  const chain = post.chain;
  const publishedId = graphRef?.tokenNodeId;
  const [open, setOpen] = useState(false);

  const draft = useXyzWriteDraft(post.id, open && !publishedId);
  const preview = usePreviewXyzWrite();
  const commit = useCommitXyzWrite();
  const reconcile = useReconcileXyzWrite();

  const pendingPublishPostId = useAppStore((s) => s.pendingPublishPostId);
  const setPendingPublishPostId = useAppStore((s) => s.setPendingPublishPostId);

  const [plan, setPlan] = useState<XyzPlan | null>(null);
  const [blocked, setBlocked] = useState<Blocked | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsReconcile, setNeedsReconcile] = useState(false);
  const [insufficient, setInsufficient] = useState(false);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [pendingDigest, setPendingDigest] = useState<string | null>(null);
  const autoPreviewed = useRef(false);

  useEffect(() => {
    if (retryAt == null) return;
    const ms = retryAt - Date.now();
    if (ms <= 0) {
      setRetryAt(null);
      return;
    }
    const t = setTimeout(() => setRetryAt(null), ms);
    return () => clearTimeout(t);
  }, [retryAt]);

  // A just-created citation post asks its card to open this dialog. Clear the
  // request either way so it cannot re-open on the next render.
  useEffect(() => {
    if (pendingPublishPostId == null || pendingPublishPostId !== post.id) {
      return;
    }
    setPendingPublishPostId(null);
    if (!publishedId) setOpen(true);
  }, [pendingPublishPostId, post.id, publishedId, setPendingPublishPostId]);

  const runPreview = useCallback(() => {
    preview.mutate(post.id, {
      onSuccess: (res) => {
        switch (res.__kind__) {
          case "ready":
            setPlan(res.ready.plan);
            break;
          case "blocked":
            setBlocked(res.blocked);
            break;
          case "insufficient":
            setPlan(res.insufficient.plan);
            setInsufficient(true);
            setNotice(res.insufficient.message);
            break;
          case "throttled":
            setRetryAt(Date.now() + Number(res.throttled.retryAfterMs));
            setNotice("The app is rate limiting previews. Try again shortly.");
            break;
          case "notLinked":
            setNotice(res.notLinked.message);
            break;
          case "err":
            setNotice(res.err.message);
            break;
        }
      },
      onError: () => setNotice("Could not reach hyvmind.app."),
    });
  }, [post.id, preview.mutate]);

  // Opening the dialog is enough: the preview is read-only, so fetch the cost
  // once per opening and show a single confirm.
  useEffect(() => {
    if (!open || publishedId) return;
    if (autoPreviewed.current) return;
    if (!draft.data?.canPublish) return;
    if (plan || blocked || notice) return;
    autoPreviewed.current = true;
    runPreview();
  }, [open, publishedId, draft.data, plan, blocked, notice, runPreview]);

  if (!graphRef && !chain) return null;

  if (publishedId) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
        <span className="uppercase tracking-[0.12em]">published</span>
        <code className="max-w-[16rem] truncate border px-1.5 py-0.5">
          {publishedId}
        </code>
        <CopyId value={publishedId} />
      </div>
    );
  }

  const reset = () => {
    setPlan(null);
    setBlocked(null);
    setNotice(null);
    setNeedsReconcile(false);
    setInsufficient(false);
    setPendingDigest(null);
    setRetryAt(null);
  };

  const handlePreview = () => {
    reset();
    autoPreviewed.current = true;
    runPreview();
  };

  const handleCommit = (digest: string) => {
    setPendingDigest(digest);
    commit.mutate(
      { postId: post.id, digest },
      {
        onSuccess: (res) => {
          setPendingDigest(null);
          switch (res.__kind__) {
            case "ok":
              toast.success(`Published for ${withBuzz(res.ok.costText)}`);
              setOpen(false);
              reset();
              break;
            case "stale":
              // The graph moved under us. Show the new plan and ask again.
              setPlan(res.stale.plan);
              setNotice(res.stale.message);
              break;
            case "blocked":
              setPlan(null);
              setBlocked(res.blocked);
              break;
            case "insufficient":
              setPlan(res.insufficient.plan);
              setInsufficient(true);
              setNotice(res.insufficient.message);
              break;
            case "unknown":
              setNotice(res.unknown.message);
              setNeedsReconcile(true);
              break;
            case "busy":
              setNotice(res.busy.message);
              break;
            case "conflict":
              setNotice(res.conflict.message);
              break;
            case "alreadyPublished":
              toast.success("This post is already published");
              setOpen(false);
              reset();
              break;
            case "notLinked":
              setNotice(res.notLinked.message);
              break;
            case "err":
              setNotice(res.err.message);
              break;
          }
        },
        onError: () => {
          setNotice(
            "The app did not confirm. Check status before trying again.",
          );
          setNeedsReconcile(true);
        },
      },
    );
  };

  const handleReconcile = () => {
    reconcile.mutate(post.id, {
      onSuccess: (res) => {
        switch (res.__kind__) {
          case "ok":
            toast.success(`Published for ${withBuzz(res.ok.costText)}`);
            setOpen(false);
            reset();
            break;
          case "notFound":
            setNotice(res.notFound.message);
            setNeedsReconcile(false);
            break;
          case "alreadyPublished":
            setOpen(false);
            reset();
            break;
          default:
            setNotice("Still unconfirmed. Try again in a moment.");
        }
      },
      onError: () => setNotice("Could not reach hyvmind.app."),
    });
  };

  const draftBlocked = draft.data != null && !draft.data.canPublish;
  const canRetry =
    notice != null && !blocked && !insufficient && !needsReconcile;
  const busy =
    preview.isPending ||
    commit.isPending ||
    reconcile.isPending ||
    (retryAt != null && retryAt > Date.now());

  return (
    <div className="mt-2">
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            reset();
            autoPreviewed.current = false;
          }
        }}
      >
        <DialogTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          >
            <Upload className="h-3 w-3" />
            publish to graph
          </button>
        </DialogTrigger>
        <DialogContent
          className="font-mono sm:max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="text-[13px] font-normal">
              {chain ? "Publish this chain" : "Publish this interpretation"}
            </DialogTitle>
            <DialogDescription className="text-[11px] leading-relaxed">
              {chain
                ? `This creates ${chain.levels.length + 1} new nodes in one permanent write. It cannot be edited or removed afterwards.`
                : "This writes a permanent token into the graph. It cannot be edited or removed afterwards."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {chain && (
              <div className="space-y-1 border px-3 py-2">
                <div className="flex items-baseline gap-2">
                  <span className="w-16 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                    chain
                  </span>
                  <span className="min-w-0 flex-1 break-words text-[11px] text-muted-foreground">
                    {[
                      ...(chain.start ? [chain.start.nodeName] : []),
                      ...chain.levels.map((level) => `new ${level.name}`),
                    ].join(" › ")}
                  </span>
                </div>
              </div>
            )}
            {draft.isLoading && (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> reading post…
              </div>
            )}

            {draft.data && (
              <div className="space-y-1.5 border px-3 py-2">
                <div className="flex items-baseline gap-2">
                  <span className="w-16 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                    type
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px]">
                    {formatNodeType(draft.data.nodeType)}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="w-16 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                    title
                  </span>
                  <span className="min-w-0 flex-1 text-[11px] text-muted-foreground">
                    {draft.data.title ?? "—"}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="w-16 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                    cost
                  </span>
                  <span className="text-[11px]">
                    about {withBuzz(draft.data.costText)}
                  </span>
                </div>
              </div>
            )}

            {draftBlocked && (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {draft.data?.reason}
              </p>
            )}

            {plan && <PlanSummary plan={plan} />}
            {blocked && <BlockedBy blocked={blocked} />}

            {notice && (
              <div className="border border-dashed px-3 py-2">
                <p className="text-[11px] leading-relaxed">{notice}</p>
                {insufficient && (
                  <a
                    href={TOP_UP_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-[10px] underline underline-offset-2"
                  >
                    redeem a Buzz code
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}

            <p className="text-[10px] leading-relaxed text-muted-foreground">
              BUZZ is earned by finding secret codes in the hyvmind text game.
              There is no card or wallet top-up.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            {plan ? (
              <Button
                size="sm"
                className="h-8 rounded-none px-3 text-[11px]"
                onClick={() => handleCommit(plan.digest)}
                disabled={busy}
              >
                {commit.isPending && (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                )}
                Publish for {withBuzz(plan.costText)}
              </Button>
            ) : blocked || draftBlocked ? null : canRetry ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-none px-3 text-[11px]"
                onClick={handlePreview}
                disabled={busy}
              >
                Try again
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8 rounded-none px-3 text-[11px]"
                disabled
              >
                {(preview.isPending || draft.isLoading) && (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                )}
                Checking cost…
              </Button>
            )}
            {needsReconcile && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-none px-3 text-[11px]"
                onClick={handleReconcile}
                disabled={reconcile.isPending}
              >
                {reconcile.isPending && (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                )}
                Check status
              </Button>
            )}
            {pendingDigest && commit.isPending && (
              <span className="self-center text-[10px] text-muted-foreground">
                confirming…
              </span>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

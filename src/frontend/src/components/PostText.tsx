import { Link } from "@tanstack/react-router";
import type { CitationRef } from "../backend";
import { markerTarget, matchCitation } from "../lib/citations";

// Common TLDs for bare domain matching
const TLDS =
  "com|org|net|io|ai|dev|app|co|me|info|biz|xyz|tech|online|site|" +
  "store|cloud|design|page|link|world|live|pro|space|fun|blog|shop|" +
  "gg|tv|fm|so|to|cc|ly|sh|is|it|de|uk|ca|au|fr|jp|kr|br|in|ru|nl|" +
  "se|no|fi|ch|at|be|pl|cz|pt|es|mx|ar|cl|za|nz|sg|hk|tw|ph|id|th|" +
  "vn|my|edu|gov|mil|int";

const BARE_DOMAIN = `[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\\.(?:${TLDS})(?:[/][^\\s<>"')\\]]*)?`;

const TOKEN_SPLIT = new RegExp(
  `(!?\\[\\[[^\\]\\n]+\\]\\]|#[a-zA-Z]\\w*|@[a-zA-Z0-9_]{3,20}|https?://[^\\s<>"')\\]]+|${BARE_DOMAIN})`,
  "gi",
);
const CITATION_TEST = /^(!?)\[\[([^\]\n]+)\]\]$/;
const HASHTAG_TEST = /^#[a-zA-Z]\w*$/;
const MENTION_TEST = /^@[a-zA-Z0-9_]{3,20}$/;
const URL_TEST = /^https?:\/\//;
const BARE_DOMAIN_TEST = new RegExp(`^${BARE_DOMAIN}$`, "i");

// Strip trailing punctuation that's likely not part of the URL
function cleanUrl(url: string): string {
  return url.replace(/[.,;:!?)]+$/, "");
}

interface PostTextProps {
  text: string;
  className?: string;
  /** The refs stored on the post; markers without one stay plain text. */
  citations?: CitationRef[];
  /**
   * "app" keeps router links (node page, hashtag, profile). "public" is for the
   * standalone post page: citations open the public curation page, while
   * hashtags and mentions stay plain text so signed-out readers never hit the
   * app's sign-in wall.
   */
  mode?: "app" | "public";
}

export function PostText({
  text,
  className,
  citations,
  mode = "app",
}: PostTextProps) {
  const parts = text.split(TOKEN_SPLIT);
  const used = new Set<number>();

  return (
    <p className={className}>
      {parts.map((part, i) => {
        const marker = CITATION_TEST.exec(part);
        if (marker) {
          // `![[...]]` is an Obsidian embed, not a citation. Leave it as text.
          if (marker[1]) return part;
          const target = markerTarget(marker[2]);
          const citation = citations
            ? matchCitation(target, citations, used)
            : null;
          if (!citation) return part;
          const pipe = marker[2].indexOf("|");
          const label =
            (pipe >= 0 ? marker[2].slice(pipe + 1).trim() : "") || target;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable list
            <span key={i}>
              <span className="text-muted-foreground">[[</span>
              {mode === "public" ? (
                <a
                  href={`/curations/${encodeURIComponent(citation.graphId)}?node=${encodeURIComponent(citation.nodeId)}`}
                  className="text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid"
                  title={citation.path}
                  onClick={(e) => e.stopPropagation()}
                >
                  {label}
                </a>
              ) : (
                <Link
                  to="/node/$graphId"
                  params={{ graphId: citation.graphId }}
                  search={{ node: citation.nodeId }}
                  className="text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid"
                  title={citation.path}
                  onClick={(e) => e.stopPropagation()}
                >
                  {label}
                </Link>
              )}
              <span className="text-muted-foreground">]]</span>
            </span>
          );
        }
        if (HASHTAG_TEST.test(part)) {
          if (mode === "public") {
            // biome-ignore lint/suspicious/noArrayIndexKey: stable list
            return <span key={i}>{part}</span>;
          }
          return (
            <Link
              // biome-ignore lint/suspicious/noArrayIndexKey: stable list
              key={i}
              to="/hashtag/$tag"
              params={{ tag: part.slice(1) }}
              className="text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </Link>
          );
        }
        if (MENTION_TEST.test(part)) {
          if (mode === "public") {
            // biome-ignore lint/suspicious/noArrayIndexKey: stable list
            return <span key={i}>{part}</span>;
          }
          return (
            <Link
              // biome-ignore lint/suspicious/noArrayIndexKey: stable list
              key={i}
              to="/$username"
              params={{ username: part.slice(1) }}
              className="text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </Link>
          );
        }
        if (URL_TEST.test(part)) {
          const href = cleanUrl(part);
          const trailing = part.slice(href.length);
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable list
            <span key={i}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {href}
              </a>
              {trailing}
            </span>
          );
        }
        if (BARE_DOMAIN_TEST.test(part)) {
          const cleaned = cleanUrl(part);
          const trailing = part.slice(cleaned.length);
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable list
            <span key={i}>
              <a
                href={`https://${cleaned}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {cleaned}
              </a>
              {trailing}
            </span>
          );
        }
        return part;
      })}
    </p>
  );
}

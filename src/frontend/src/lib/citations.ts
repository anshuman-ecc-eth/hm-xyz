import { Principal } from "@icp-sdk/core/principal";
import type { CitationRef, GraphRefInput } from "../backend";
import { type ResolvedNode, isCitable } from "./hyvmind";

/** A marker the user picked, with the exact text inserted between `[[` and `]]`. */
export interface PickedCitation {
  label: string;
  ref: GraphRefInput;
}

const MARKER = /(!?)\[\[([^\]\n]+)\]\]/g;

/** Matches the backend's `maxInlineCitations`. */
export const MAX_INLINE_CITATIONS = 8;

/**
 * Normalize a marker label for matching: the marker syntax forbids `]`, `|`,
 * `#`, `@`, and newlines, so replace them the same way on both sides.
 */
export function normalizeLabel(value: string): string {
  return value
    .replace(/[\]\[|#@\n\r]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The open `[[...` trigger before the caret. `![[` is an Obsidian embed, not a
 * citation, so it never opens the picker. A closing `]]` or newline ends it.
 */
export function citationAt(
  value: string,
  caret: number,
): { start: number; query: string } | null {
  const before = value.slice(0, caret);
  const start = before.lastIndexOf("[[");
  if (start < 0) return null;
  if (start > 0 && before[start - 1] === "!") return null;
  const query = before.slice(start + 2);
  if (query.includes("]]") || query.includes("\n")) return null;
  return { start, query };
}

/** Resolve `[[target|alias]]` / `[[target#heading]]` to the target text. */
export function markerTarget(raw: string): string {
  const pipe = raw.indexOf("|");
  const withoutAlias = pipe >= 0 ? raw.slice(0, pipe) : raw;
  const hash = withoutAlias.indexOf("#");
  return (hash >= 0 ? withoutAlias.slice(0, hash) : withoutAlias).trim();
}

/**
 * Insert the short name when it is unique among the loaded citable nodes, and
 * the path otherwise. Characters that would terminate or alias the marker are
 * replaced with spaces.
 */
export function citationLabel(node: ResolvedNode, all: ResolvedNode[]): string {
  const ambiguous = all.some(
    (other) =>
      other.id !== node.id && other.name === node.name && isCitable(other),
  );
  const raw = ambiguous ? node.path : node.name;
  return normalizeLabel(raw) || normalizeLabel(node.name) || node.id;
}

export function toGraphRefInput(node: ResolvedNode): GraphRefInput {
  return {
    graphId: node.graphId,
    graphName: node.graphName,
    nodeId: node.id,
    nodeName: node.name,
    nodeType: node.type,
    path: node.path,
    swarmNodeId: node.swarmNodeId ?? undefined,
    swarmCreator: node.swarmCreator
      ? Principal.fromText(node.swarmCreator)
      : undefined,
    communityName: node.swarmLabel ?? undefined,
  };
}

export function toCitationRef(node: ResolvedNode): CitationRef {
  return {
    graphId: node.graphId,
    nodeId: node.id,
    nodeName: node.name,
    nodeType: node.type,
    path: node.path,
  };
}

/**
 * Keep only the picked refs whose markers are still in `text`, in text order.
 * The first result is the anchor when no explicit Cite/chain selection exists.
 */
export function citationsForText(
  text: string,
  picked: PickedCitation[],
): PickedCitation[] {
  const used = new Set<number>();
  const out: PickedCitation[] = [];
  for (const match of text.matchAll(MARKER)) {
    if (match[1]) continue; // ![[embed]]
    const target = normalizeLabel(markerTarget(match[2]));
    const index = picked.findIndex(
      (entry, i) =>
        !used.has(i) &&
        (normalizeLabel(entry.label) === target ||
          normalizeLabel(entry.ref.nodeName) === target ||
          normalizeLabel(entry.ref.path) === target),
    );
    if (index < 0) continue;
    used.add(index);
    out.push(picked[index]);
  }
  return out;
}

/**
 * Find the stored citation for a marker target, consuming it once so duplicate
 * labels pair with duplicate markers in order.
 */
export function matchCitation(
  target: string,
  citations: CitationRef[],
  used: Set<number>,
): CitationRef | null {
  const normalized = normalizeLabel(target);
  const index = citations.findIndex(
    (citation, i) =>
      !used.has(i) &&
      (normalizeLabel(citation.nodeName) === normalized ||
        normalizeLabel(citation.path) === normalized),
  );
  if (index < 0) return null;
  used.add(index);
  return citations[index];
}

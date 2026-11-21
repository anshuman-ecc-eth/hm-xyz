import { useEffect, useMemo, useRef, useState } from "react";

/**
 * A small force-directed knowledge graph for the landing hero.
 *
 * The hierarchy is real: the hub is the Constitution of India, the three
 * anchors are Parts of it, and every leaf is an Article *belonging to that
 * Part* — so a cluster reads as one Part and its articles. Leaves are picked
 * at random (seeded, so the picture is stable) from the correct article list.
 *
 * No dependency: springs on edges, inverse-square repulsion, pinned anchors.
 * The layout is settled before first paint and only fades in, so nothing
 * wobbles on load.
 */

const WIDTH = 560;
const HEIGHT = 400;
const PER_CLUSTER = 8;

// Node labels are specified in rendered CSS pixels, so they can be matched to
// the 12px @handle in the feed. The viewBox letterboxes to fit its box, so the
// drawn size is LABEL_PX / scale user units.
const LABEL_PX = 12;

/** Hyvmind's five node types, from collection down to argument. */
export type NodeType =
  | "curation"
  | "swarm"
  | "location"
  | "lawEntity"
  | "interpEntity";

export type GraphNode = {
  id: string;
  label?: string;
  title?: string;
  hub?: boolean;
  anchor?: boolean;
  /** "article" (default), "contributor", "follower" or "interpretation". */
  kind?: "article" | "contributor" | "follower" | "interpretation";
  /** Hyvmind node type; it sets the node's colour. */
  type?: NodeType;
  /** Small caption shown with the label, e.g. "contributor". */
  tag?: string;
  /** Put the label under the dot instead of over it. */
  labelBelow?: boolean;
  /** Put the label beside the dot instead of above or below it. */
  labelSide?: "left" | "right";
  /** Target position for anchors. */
  tx?: number;
  ty?: number;
  /** Pin strength override; the worked example is held firmer than the rest. */
  stiff?: number;
  /** Frame padding override, in user units. */
  pad?: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export type GraphEdge = {
  a: number;
  b: number;
  dashed?: boolean;
  rest?: number;
  /** The level that owns the relation; it sets the relation's colour. */
  tone?: NodeType;
};

// Hyvmind's own palette: a node takes its type's colour, and a relation borrows
// the colour of the level that owns it.
const TYPE_COLOUR: Record<NodeType, { fill: string; line: string }> = {
  curation: { fill: "fill-[#4a9eff]", line: "text-[#4a9eff]" },
  swarm: { fill: "fill-[#ff7f50]", line: "text-[#ff7f50]" },
  location: { fill: "fill-[#90EE90]", line: "text-[#90EE90]" },
  lawEntity: { fill: "fill-[#FFD700]", line: "text-[#FFD700]" },
  interpEntity: { fill: "fill-[#DA70D6]", line: "text-[#DA70D6]" },
};

type Article = { n: string; title: string };
type Branch = { id: string; label: string; short: string; articles: Article[] };

const HIERARCHY: { hub: string; branches: Branch[] } = {
  hub: "Constitution of India",
  branches: [
    {
      id: "part-iii",
      label: "Part III · Fundamental Rights",
      short: "Part III",
      articles: [
        { n: "12", title: "Definition of “State”" },
        { n: "13", title: "Laws inconsistent with fundamental rights" },
        { n: "14", title: "Equality before law" },
        { n: "15", title: "Prohibition of discrimination" },
        { n: "16", title: "Equality of opportunity in public employment" },
        { n: "17", title: "Abolition of Untouchability" },
        { n: "18", title: "Abolition of titles" },
        { n: "19", title: "Freedom of speech and expression" },
        { n: "20", title: "Protection in respect of conviction for offences" },
        { n: "21", title: "Protection of life and personal liberty" },
        { n: "21A", title: "Right to education" },
        { n: "22", title: "Protection against arrest and detention" },
        {
          n: "23",
          title: "Prohibition of traffic in human beings and forced labour",
        },
        { n: "24", title: "Prohibition of child employment in factories" },
        { n: "25", title: "Freedom of conscience and religion" },
        { n: "26", title: "Freedom to manage religious affairs" },
        { n: "29", title: "Protection of interests of minorities" },
        { n: "30", title: "Rights of minorities to educational institutions" },
        { n: "32", title: "Remedies for enforcement of rights (writs)" },
        {
          n: "33",
          title: "Power of Parliament to modify rights for the Forces",
        },
        { n: "35", title: "Legislation to give effect to this Part" },
      ],
    },
    {
      id: "part-iv",
      label: "Part IV · Directive Principles",
      short: "Part IV",
      articles: [
        { n: "36", title: "Definition" },
        { n: "37", title: "Application of the principles" },
        { n: "38", title: "Social order for the welfare of the people" },
        { n: "39", title: "Certain principles of policy" },
        { n: "39A", title: "Equal justice and free legal aid" },
        { n: "40", title: "Organisation of village panchayats" },
        { n: "41", title: "Right to work, education and public assistance" },
        { n: "42", title: "Just and humane conditions of work" },
        { n: "43", title: "Living wage for workers" },
        { n: "43A", title: "Participation of workers in management" },
        { n: "44", title: "Uniform civil code" },
        { n: "45", title: "Free and compulsory education for children" },
        {
          n: "46",
          title: "Interests of Scheduled Castes, Tribes and weaker sections",
        },
        { n: "47", title: "Nutrition, standard of living and public health" },
        { n: "48", title: "Organisation of agriculture and animal husbandry" },
        { n: "48A", title: "Environment, forests and wildlife" },
        { n: "49", title: "Protection of monuments of national importance" },
        { n: "50", title: "Separation of judiciary from the executive" },
        { n: "51", title: "Promotion of international peace and security" },
      ],
    },
    {
      id: "part-xxi",
      label: "Part XXI · Temporary, Transitional and Special Provisions",
      short: "Part XXI",
      articles: [
        {
          n: "371J",
          title: "Special provision with respect to the State of Karnataka",
        },
      ],
    },
    {
      id: "part-v",
      label: "Part V · The Union",
      short: "Part V",
      articles: [
        { n: "52", title: "The President of India" },
        { n: "53", title: "Executive power of the Union" },
        { n: "54", title: "Election of President" },
        { n: "55", title: "Manner of election of President" },
        { n: "56", title: "Term of office of President" },
        { n: "58", title: "Qualifications for election as President" },
        { n: "61", title: "Procedure for impeachment of the President" },
        { n: "63", title: "The Vice-President of India" },
        {
          n: "64",
          title:
            "Vice-President as ex officio Chairman of the Council of States",
        },
        { n: "65", title: "Vice-President acting as President" },
        { n: "66", title: "Election of Vice-President" },
        { n: "67", title: "Term of office of Vice-President" },
        { n: "72", title: "Power of President to grant pardons" },
        {
          n: "74",
          title: "Council of Ministers to aid and advise the President",
        },
        { n: "75", title: "Other provisions as to Ministers" },
        { n: "76", title: "Attorney-General for India" },
        { n: "77", title: "Conduct of business of the Government of India" },
        { n: "78", title: "Duties of the Prime Minister" },
      ],
    },
  ],
};

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: T[], count: number, rand: () => number) {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export function buildGraph() {
  const rand = mulberry32(20261118);
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;
  const ring = Math.min(WIDTH, HEIGHT) * 0.3;
  const angles = [-Math.PI / 2, -0.3, 2.85, 1.1];

  nodes.push({
    id: "constitution",
    label: HIERARCHY.hub,
    title: HIERARCHY.hub,
    hub: true,
    type: "curation",
    tx: cx,
    ty: cy,
    x: cx,
    y: cy,
    vx: 0,
    vy: 0,
  });

  HIERARCHY.branches.forEach((branch, c) => {
    const angle =
      angles[c] ?? (c / HIERARCHY.branches.length) * Math.PI * 2 - Math.PI / 2;
    const ax = cx + Math.cos(angle) * ring;
    const ay = cy + Math.sin(angle) * ring;
    const anchorIndex = nodes.length;

    nodes.push({
      id: branch.id,
      label: branch.short,
      title: branch.label,
      anchor: true,
      type: "swarm",
      tx: ax,
      ty: ay,
      x: ax,
      y: ay,
      vx: 0,
      vy: 0,
    });
    edges.push({ a: 0, b: anchorIndex, tone: "curation" });

    const articles = pick(branch.articles, PER_CLUSTER, rand);
    const leafStart = nodes.length;

    articles.forEach((article, i) => {
      const spread = 0.5 + rand() * 0.85;
      const a2 = rand() * Math.PI * 2;
      const r2 = 30 + rand() * 46;
      nodes.push({
        id: `${branch.id}-${article.n}`,
        label: `Art. ${article.n}`,
        title: `Article ${article.n} — ${article.title}`,
        type: "location",
        // Part V's expanded label runs left along its own row, and 72's and
        // 63's above-labels land in it. Put those two underneath.
        labelBelow:
          branch.id === "part-v" && (article.n === "72" || article.n === "63"),
        x: ax + Math.cos(a2) * r2 * spread,
        y: ay + Math.sin(a2) * r2 * spread,
        vx: 0,
        vy: 0,
      });
      edges.push({ a: anchorIndex, b: nodes.length - 1, tone: "swarm" });
      void i;
    });

    // Mesh inside the Part only: each article links to its two nearest
    // siblings, which keeps every edge conceptually true (same Part).
    const leaves = Array.from(
      { length: articles.length },
      (_, i) => leafStart + i,
    );
    const seen = new Set<string>();
    for (const i of leaves) {
      const others = leaves
        .filter((j) => j !== i)
        .map((j) => ({
          j,
          d: Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y),
        }))
        .sort((p, q) => p.d - q.d)
        .slice(0, 2);
      for (const { j } of others) {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({ a: i, b: j, tone: "location" });
      }
    }

    // Part XXI carries a worked example of the whole hierarchy:
    // location (Article 371J) -> its law tokens -> the posts that interpret
    // them -> the person who wrote those posts -> the people following them.
    if (branch.id === "part-xxi") {
      // The tail is pinned rather than simulated: a five-level chain on a
      // shared canvas otherwise piles up against the frame edge.
      const pin = (node: GraphNode, px: number, py: number) => {
        node.tx = WIDTH * px;
        node.ty = HEIGHT * py;
        node.x = node.tx;
        node.y = node.ty;
        node.stiff = 0.14;
      };

      const articleNode = nodes[leafStart];
      // Label it to the left: everything to its right is the law stack and
      // its long names, which used to swallow this label.
      articleNode.labelSide = "left";
      pin(articleNode, 0.36, 0.6);

      // The three law tokens below the location. They are stacked rather than
      // fanned so their long names, which read to the right, never overlap
      // when a hover reveals them together.
      const laws = [
        {
          id: "law-development-board",
          label: "separate development board",
          px: 0.4375,
          py: 0.69,
        },
        {
          id: "law-equitable-funds",
          label: "equitable allocation of funds",
          px: 0.4286,
          py: 0.795,
        },
        {
          id: "law-equitable-opportunities",
          label: "equitable opportunities and facilities",
          px: 0.3929,
          py: 0.895,
        },
      ];
      const lawIndices: number[] = [];
      for (const law of laws) {
        const index = nodes.length;
        const node: GraphNode = {
          id: law.id,
          label: law.label,
          title: law.label,
          type: "lawEntity",
          labelSide: "right",
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
        };
        pin(node, law.px, law.py);
        nodes.push(node);
        lawIndices.push(index);
        edges.push({ a: leafStart, b: index, rest: 46, tone: "location" });
      }

      // Four posts interpret those laws: one on the first, two on the second,
      // one on the third. The posts are the only tokens here Jehosh wrote.
      const posts: Array<{
        id: string;
        label: string;
        law: number;
        px: number;
        py: number;
        labelBelow?: boolean;
      }> = [
        { id: "post-1", label: "post 1", law: 0, px: 0.245, py: 0.712 },
        { id: "post-2", label: "post 2", law: 1, px: 0.315, py: 0.787 },
        {
          id: "post-3",
          label: "post 3",
          law: 1,
          px: 0.245,
          py: 0.83,
          labelBelow: true,
        },
      ];
      const postIndices: number[] = [];
      for (const post of posts) {
        const index = nodes.length;
        const node: GraphNode = {
          id: post.id,
          label: post.label,
          title: post.label,
          kind: "interpretation",
          type: "interpEntity",
          labelBelow: post.labelBelow,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
        };
        pin(node, post.px, post.py);
        nodes.push(node);
        postIndices.push(index);
        edges.push({
          a: lawIndices[post.law],
          b: index,
          rest: 44,
          tone: "lawEntity",
        });
      }

      const contributorIndex = nodes.length;
      const contributor = {
        id: "contrib-jehosh",
        label: "Jehosh",
        tag: "contributor",
        title: "Jehosh — author of posts 1 and 2",
        kind: "contributor" as const,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
      };
      pin(contributor, 0.185, 0.69);
      nodes.push(contributor);

      const followerSlots: Array<{
        name: string;
        px: number;
        py: number;
        /** Gayatri sits lowest; her label reads better under the dot. */
        labelBelow?: boolean;
        /** Sudeep is nearest the left edge, so his name goes outside. */
        labelSide?: "left" | "right";
        /** Frame padding override for people who sit on the edge. */
        pad?: number;
      }> = [
        { name: "Sukriti", px: 0.03, py: 0.84, pad: 26 },
        { name: "Sudeep", px: 0.179, py: 0.915, labelBelow: true },
        { name: "Gayatri", px: 0.071, py: 0.625 },
      ];
      const followerIndices: number[] = [];
      for (const {
        name,
        px,
        py,
        labelBelow,
        labelSide,
        pad,
      } of followerSlots) {
        const follower = {
          id: `follower-${name.toLowerCase()}`,
          label: name,
          tag: "follower",
          title: `${name} — follower of Jehosh`,
          kind: "follower" as const,
          labelBelow,
          labelSide,
          pad,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
        };
        pin(follower, px, py);
        followerIndices.push(nodes.length);
        nodes.push(follower);
        edges.push({
          a: contributorIndex,
          b: nodes.length - 1,
          dashed: true,
          rest: 34,
        });
      }

      // The four people know each other: connect the followers pairwise too.
      for (let i = 0; i < followerIndices.length; i++) {
        for (let j = i + 1; j < followerIndices.length; j++) {
          edges.push({
            a: followerIndices[i],
            b: followerIndices[j],
            dashed: true,
            rest: 46,
          });
        }
      }

      // All three posts are Jehosh's.
      const postAuthors = [
        contributorIndex,
        contributorIndex,
        contributorIndex,
      ];
      postIndices.forEach((postIndex, i) => {
        edges.push({
          a: postIndex,
          b: postAuthors[i],
          rest: 44,
          tone: "interpEntity",
        });
      });
    }
  });

  return { nodes, edges };
}

const SPRING = 0.022;
const REST = 54;
const REPULSION = 1300;
const CENTER = 0.0009;
const DAMPING = 0.85;
const MIN_DIST = 40;
const PIN = 0.06;

export function step(nodes: GraphNode[], edges: GraphEdge[]) {
  const n = nodes.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = nodes[i];
      const b = nodes[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist = Math.hypot(dx, dy);
      if (dist < 0.01) {
        dx = 0.1;
        dy = 0.1;
        dist = 0.14;
      }
      const force = Math.min(REPULSION / (dist * dist), 1.1);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;

      if (dist < MIN_DIST) {
        const push = (MIN_DIST - dist) * 0.05;
        a.vx -= (dx / dist) * push;
        a.vy -= (dy / dist) * push;
        b.vx += (dx / dist) * push;
        b.vy += (dy / dist) * push;
      }
    }
  }

  for (const edge of edges) {
    const a = nodes[edge.a];
    const b = nodes[edge.b];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 0.01;
    const force = (dist - (edge.rest ?? REST)) * SPRING;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    a.vx += fx;
    a.vy += fy;
    b.vx -= fx;
    b.vy -= fy;
  }

  let energy = 0;
  for (const node of nodes) {
    node.vx += (WIDTH / 2 - node.x) * CENTER;
    node.vy += (HEIGHT / 2 - node.y) * CENTER;

    if (node.tx !== undefined && node.ty !== undefined) {
      const stiff = node.stiff ?? PIN;
      node.vx += (node.tx - node.x) * stiff;
      node.vy += (node.ty - node.y) * stiff;
    }

    node.vx *= DAMPING;
    node.vy *= DAMPING;

    // The frame padding, overridable per node so the people can sit closer to
    // the left edge than the rest of the graph.
    const pad = node.pad ?? 34;
    if (node.x < pad) node.vx += (pad - node.x) * 0.08;
    if (node.x > WIDTH - pad) node.vx -= (node.x - (WIDTH - pad)) * 0.08;
    if (node.y < pad) node.vy += (pad - node.y) * 0.08;
    if (node.y > HEIGHT - pad) node.vy -= (node.y - (HEIGHT - pad)) * 0.08;

    node.x += node.vx;
    node.y += node.vy;

    node.x = Math.min(WIDTH - pad, Math.max(pad, node.x));
    node.y = Math.min(HEIGHT - pad, Math.max(pad, node.y));

    energy += node.vx * node.vx + node.vy * node.vy;
  }

  return energy;
}

// The graph is grey at rest; a hover reveals the colour of the level a
// relation belongs to. Untoned relations fall back to the interaction accent.
const EDGE_GREY = "text-[#d2d2d7] dark:text-[#38383a]";
const NODE_GREY = "fill-[#6e6e73] dark:fill-[#a1a1a6]";

// Decorative rays around the hub. The start is rotated off the four spokes so
// no ray lies along a real relation.
const RAY_COUNT = 7;
const RAY_START = (-4 * Math.PI) / 180;

// Explanations that appear when a node is hovered, one per node type.
type NoteKey = NodeType | "person";

const TYPE_NOTE: Partial<Record<NoteKey, string>> = {
  curation: "curation = general topic",
  swarm: "swarm = subtopic & community",
  location: "location = semantic address",
  lawEntity: "law token = meaningful chunk of legal language",
  interpEntity: "interpretation token",
  person: "researcher",
};

const NODE_RADIUS: Record<NodeType, number> = {
  curation: 14,
  swarm: 9,
  location: 6.75,
  lawEntity: 6.5,
  interpEntity: 5.5,
};

// The note is specified in rendered CSS pixels and divided by the letterbox
// scale, so it stays the same physical size as the labels. Every callout shares
// one home: the empty left margin, above the people. Its left edge is measured
// from the panel edge, not the viewBox, so it uses the letterbox space too.
const NOTE_FONT_PX = 11;
const NOTE_PAD_PX = 8;
const NOTE_LINE = 1.45;
const NOTE_LEFT_PX = 12;
const NOTE_WIDTH_MAX = 230;
// The top edge of the hovered hub: its centre (HEIGHT / 2) minus its grown
// radius (14 × 1.25). The note is centred a touch above that line.
const NOTE_TOP = HEIGHT / 2 - 14 * 1.25;
const NOTE_LIFT = 10;

function nodeRadius(node: GraphNode) {
  if (node.type) return NODE_RADIUS[node.type];
  if (node.kind === "contributor") return 6.5;
  if (node.kind === "follower") return 5;
  return 6.75;
}

function noteFor(node: GraphNode) {
  if (node.type) return TYPE_NOTE[node.type];
  if (node.kind === "contributor" || node.kind === "follower") {
    return TYPE_NOTE.person;
  }
  return undefined;
}

// The annotation chrome is one fixed ink red, independent of node type: ring,
// leader and box outline all read as one object.
const ANNOTATION_INK = "text-[#ff3b30] dark:text-[#ff453a]";

export type NoteLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  font: number;
  pad: number;
  lines: string[];
  ring: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
};

/**
 * Lay out the callout for a hovered node. Every note lands in the same empty
 * space on the left; only its leader line changes, running from the node's
 * ring to the nearest edge of the box.
 */
export function layoutNote(
  node: GraphNode,
  text: string,
  scale: number,
  leftPad: number,
): NoteLayout {
  const u = 1 / scale;
  const font = NOTE_FONT_PX * u;
  const pad = NOTE_PAD_PX * u;
  const charWidth = font * 0.6;
  // Size the box to the text: even padding on both sides, and only wrap once
  // it would grow into the graph.
  const width = Math.min(text.length * charWidth + pad * 2, NOTE_WIDTH_MAX);
  // The epsilon stops a note that exactly fills the width from wrapping on
  // floating-point noise (e.g. 24 chars at 6.6 px each).
  const maxChars = Math.max(
    6,
    Math.floor((width - pad * 2) / charWidth + 1e-6),
  );

  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);

  const height = pad * 2 + lines.length * font * NOTE_LINE;
  const box = {
    x: (NOTE_LEFT_PX - leftPad) / scale,
    y: NOTE_TOP - height / 2 - NOTE_LIFT,
    width,
    height,
  };
  const ring = nodeRadius(node) * 1.25 + 5 * u;

  // Straight leader from the ring to the point where the line of sight to the
  // box centre crosses the box edge.
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const dx = cx - node.x;
  const dy = cy - node.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;

  const hits: number[] = [];
  if (ux !== 0) {
    for (const ex of [box.x, box.x + box.width]) {
      const t = (ex - node.x) / ux;
      const y = node.y + t * uy;
      if (t > 0 && y >= box.y && y <= box.y + box.height) hits.push(t);
    }
  }
  if (uy !== 0) {
    for (const ey of [box.y, box.y + box.height]) {
      const t = (ey - node.y) / uy;
      const x = node.x + t * ux;
      if (t > 0 && x >= box.x && x <= box.x + box.width) hits.push(t);
    }
  }
  const reach = hits.length ? Math.min(...hits) : ring;
  const start = Math.min(ring, reach);

  return {
    ...box,
    font,
    pad,
    lines,
    ring,
    from: { x: node.x + ux * start, y: node.y + uy * start },
    to: { x: node.x + ux * reach, y: node.y + uy * reach },
  };
}

export function LandingGraph() {
  const { nodes, edges } = useMemo(() => {
    const graph = buildGraph();
    for (let i = 0; i < 900; i++) step(graph.nodes, graph.edges);
    return graph;
  }, []);

  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  // Measure the letterbox: with preserveAspectRatio="xMidYMid meet" the drawing
  // is scaled by min(w / WIDTH, h / HEIGHT) and centred in the element, leaving
  // empty space on the long axis. The note anchors to the element edge, so it
  // needs that offset as well as the scale.
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [scale, setScale] = useState(1);
  const [letterbox, setLetterbox] = useState(0);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        const s = Math.min(width / WIDTH, height / HEIGHT);
        setScale(s);
        setLetterbox((width - WIDTH * s) / 2);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const neighbours = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const { a, b } of edges) {
      const ida = nodes[a]?.id;
      const idb = nodes[b]?.id;
      if (!ida || !idb) continue;
      if (!map.has(ida)) map.set(ida, new Set());
      if (!map.has(idb)) map.set(idb, new Set());
      map.get(ida)!.add(idb);
      map.get(idb)!.add(ida);
    }
    return map;
  }, [edges, nodes]);

  const hot = (id: string) =>
    hovered !== null &&
    (id === hovered || (neighbours.get(hovered)?.has(id) ?? false));

  // Rays run from the hub to the frame edge. They are texture, not data:
  // drawn before everything else, never lit, never dimmed.
  const rays = useMemo(() => {
    const hub = nodes.find((node) => node.hub);
    if (!hub) return [];
    return Array.from({ length: RAY_COUNT }, (_, i) => {
      const angle = RAY_START + (i * Math.PI * 2) / RAY_COUNT;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const t = Math.min(
        dx > 0
          ? (WIDTH - hub.x) / dx
          : dx < 0
            ? -hub.x / dx
            : Number.POSITIVE_INFINITY,
        dy > 0
          ? (HEIGHT - hub.y) / dy
          : dy < 0
            ? -hub.y / dy
            : Number.POSITIVE_INFINITY,
      );
      return {
        angle,
        x1: hub.x,
        y1: hub.y,
        x2: hub.x + dx * t,
        y2: hub.y + dy * t,
      };
    });
  }, [nodes]);

  // Labels are hover-only: the graph reads as grey structure at rest, and
  // names itself — and shows its level colours — only under the cursor. A
  // hover always introduces the node's neighbours, hub and Part included, so
  // every node that lights up also names itself.
  const labelled = useMemo(() => {
    const set = new Set<string>();
    if (hovered) {
      set.add(hovered);
      for (const id of neighbours.get(hovered) ?? []) set.add(id);
    }
    return set;
  }, [hovered, neighbours]);

  // The annotation is a callout, not a tooltip: ring around the node, connector
  // to a wrapped note. Only the hovered node can show one, and only once its
  // type has an explanation.
  const annotation = useMemo(() => {
    if (!hovered) return null;
    const node = nodes.find((n) => n.id === hovered);
    if (!node) return null;
    const text = noteFor(node);
    if (!text) return null;
    return { node, layout: layoutNote(node, text, scale, letterbox) };
  }, [hovered, nodes, scale, letterbox]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg
      ref={svgRef}
      data-graph="knowledge"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={`h-full w-full overflow-visible transition-opacity duration-700 ease-out motion-reduce:transition-none ${visible ? "opacity-100" : "opacity-0"}`}
      role="img"
      aria-label="Constitution of India: articles grouped by Parts — Fundamental Rights, Directive Principles, and the Union"
    >
      <g>
        {rays.map((ray) => (
          <line
            key={ray.angle}
            x1={ray.x1}
            y1={ray.y1}
            x2={ray.x2}
            y2={ray.y2}
            stroke="currentColor"
            strokeWidth={1}
            strokeOpacity={0.35}
            className="text-[#d2d2d7] dark:text-[#38383a]"
          />
        ))}
      </g>

      {edges.map((edge) => {
        const a = nodes[edge.a];
        const b = nodes[edge.b];
        if (!a || !b) return null;
        const touching =
          hovered !== null && (a.id === hovered || b.id === hovered);
        const dimmed = hovered !== null && !touching;
        return (
          <line
            key={`${a.id}-${b.id}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="currentColor"
            strokeWidth={touching ? 1.5 : 1}
            strokeDasharray={edge.dashed ? "3 3" : undefined}
            strokeOpacity={dimmed ? 0.12 : touching ? 1 : 0.5}
            className={`${
              touching && edge.tone
                ? TYPE_COLOUR[edge.tone].line
                : touching
                  ? "text-[#1d1d1f] dark:text-white"
                  : EDGE_GREY
            } transition-opacity duration-150`}
          />
        );
      })}

      {/* The leader runs under the dots so it never looks struck through them. */}
      {annotation && (
        <line
          key={`leader-${annotation.node.id}`}
          x1={annotation.layout.from.x}
          y1={annotation.layout.from.y}
          x2={annotation.layout.to.x}
          y2={annotation.layout.to.y}
          pathLength={1}
          strokeDasharray={1}
          stroke="currentColor"
          strokeWidth={1}
          strokeOpacity={0.6}
          className={`${ANNOTATION_INK} animate-graph-line motion-reduce:animate-none`}
        />
      )}

      <g>
        {nodes.map((node) => {
          const isHot = hot(node.id);
          const isDim = hovered !== null && !isHot;
          const grow = node.id === hovered ? 1.25 : 1;
          const opacity = isDim ? 0.28 : 1;
          const accent = node.id === hovered;
          // Colour is the hover reward: at rest every node is grey.
          const showColour = hovered !== null && isHot;

          return (
            <g
              key={node.id}
              data-node={node.id}
              className="cursor-pointer transition-opacity duration-150"
              opacity={opacity}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Generous invisible hit area: small dots are hard to hover. */}
              <circle cx={node.x} cy={node.y} r={22} fill="transparent" />

              {node.hub ? (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={14 * grow}
                  className={showColour ? TYPE_COLOUR.curation.fill : NODE_GREY}
                />
              ) : node.kind === "contributor" || node.kind === "follower" ? (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={(node.kind === "contributor" ? 6.5 : 5) * grow}
                  strokeWidth={1.5}
                  className={
                    accent
                      ? "fill-[#1d1d1f] stroke-[#1d1d1f] dark:fill-white dark:stroke-white"
                      : "fill-transparent stroke-[#6e6e73] dark:stroke-[#a1a1a6]"
                  }
                />
              ) : node.kind === "interpretation" ? (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={5.5 * grow}
                  className={
                    showColour ? TYPE_COLOUR.interpEntity.fill : NODE_GREY
                  }
                  fillOpacity={isHot ? 1 : 0.75}
                />
              ) : node.type === "lawEntity" ? (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={6.5 * grow}
                  className={
                    showColour ? TYPE_COLOUR.lawEntity.fill : NODE_GREY
                  }
                  fillOpacity={isHot ? 0.95 : 0.8}
                />
              ) : node.anchor ? (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={9 * grow}
                  className={showColour ? TYPE_COLOUR.swarm.fill : NODE_GREY}
                  fillOpacity={accent ? 1 : 0.92}
                />
              ) : (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={6.75 * grow}
                  className={showColour ? TYPE_COLOUR.location.fill : NODE_GREY}
                  fillOpacity={isHot ? 0.95 : 0.6}
                />
              )}
            </g>
          );
        })}
      </g>

      <g fontFamily="inherit">
        {nodes.map((node, index) => {
          if (!labelled.has(node.id)) return null;

          const isLeaf = !node.hub && !node.anchor;
          const isDim = hovered !== null && !hot(node.id);
          // One size for every label, expressed in rendered pixels; `k` keeps
          // the clearances tracking the text rather than the zoom level.
          const size = LABEL_PX / scale;
          const k = size / 10;
          const charWidth = size * 0.6; // Geist Mono advance, plus tracking

          const expanded = node.anchor && node.id === hovered;
          const text =
            (expanded ? (node.title ?? node.label) : node.label) ?? "";

          // Structural labels sit beside the dot, on whichever side has room
          // for the caption; article labels alternate above/below so
          // neighbours clear each other.
          const side = node.labelSide;
          const offset = (node.hub ? 17 : node.anchor ? 12 : 9) * k;
          const slack = 10;
          const roomRight = WIDTH - slack - (node.x + offset);
          const roomLeft = node.x - offset - slack;
          const flip =
            !isLeaf &&
            (expanded
              ? roomLeft > roomRight
              : node.x > WIDTH * (node.hub ? 0.95 : 0.86));
          const room =
            side === "left"
              ? roomLeft
              : side === "right"
                ? roomRight
                : isLeaf
                  ? // Centred labels can use both sides of the dot.
                    2 * Math.min(node.x - slack, WIDTH - node.x - slack)
                  : flip
                    ? roomLeft
                    : roomRight;
          // Typed labels truncate too: a law token's name is long.
          const shown =
            (!isLeaf || node.type !== undefined) &&
            text.length * charWidth > room
              ? `${text.slice(0, Math.max(1, Math.floor(room / charWidth) - 1))}…`
              : text;

          const above = node.labelBelow ? false : index % 2 === 0;
          let x =
            side === "left"
              ? node.x - offset
              : side === "right"
                ? node.x + offset
                : isLeaf
                  ? node.x
                  : node.x + (flip ? -offset : offset);
          let y =
            isLeaf && side === undefined
              ? node.y + (above ? -10 : 16) * k
              : node.y + 3.5 * k;
          let anchor: "middle" | "start" | "end" =
            side === "left"
              ? "end"
              : side === "right"
                ? "start"
                : isLeaf
                  ? "middle"
                  : flip
                    ? "end"
                    : "start";

          // A hovered article pushes its label radially away from its Part,
          // so it never lands on the Part's own caption.
          if (isLeaf && side === undefined && node.id === hovered) {
            const parentId = neighbours.get(node.id);
            const parent = nodes.find((n) => n.anchor && parentId?.has(n.id));
            if (parent) {
              const dx = node.x - parent.x;
              const dy = node.y - parent.y;
              const len = Math.hypot(dx, dy) || 1;
              x = node.x + (dx / len) * 18 * k;
              y = node.y + (dy / len) * 18 * k + 3 * k;
              anchor = dx >= 0 ? "start" : "end";
            }
          }

          return (
            <text
              key={`label-${node.id}`}
              x={x}
              y={y}
              textAnchor={anchor}
              fontSize={size}
              strokeWidth={size * 0.33}
              strokeLinejoin="round"
              paintOrder="stroke"
              opacity={isDim ? 0.25 : 1}
              className={`pointer-events-none stroke-[#fbfbfb] transition-opacity duration-150 dark:stroke-[#0c0c0c] ${
                node.id === hovered || node.hub || node.anchor
                  ? "fill-[#1d1d1f] dark:fill-white"
                  : "fill-[#6e6e73] dark:fill-[#a1a1a6]"
              }`}
            >
              {shown}
            </text>
          );
        })}
      </g>

      {annotation && (
        <g key={`note-${annotation.node.id}`} pointerEvents="none">
          <circle
            cx={annotation.node.x}
            cy={annotation.node.y}
            r={annotation.layout.ring}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            pathLength={1}
            strokeDasharray={1}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            className={`${ANNOTATION_INK} animate-graph-ring motion-reduce:animate-none`}
          />
          <g className="animate-graph-note motion-reduce:animate-none">
            <rect
              x={annotation.layout.x}
              y={annotation.layout.y}
              width={annotation.layout.width}
              height={annotation.layout.height}
              strokeWidth={1}
              className="fill-[#fbfbfb] stroke-[#ff3b30] dark:fill-[#0c0c0c] dark:stroke-[#ff453a]"
            />
            <text
              x={annotation.layout.x + annotation.layout.pad}
              y={
                annotation.layout.y +
                annotation.layout.pad +
                annotation.layout.font * 0.8
              }
              fontSize={annotation.layout.font}
              className="font-mono fill-[#1d1d1f] dark:fill-white"
            >
              {annotation.layout.lines.map((line, i) => (
                <tspan
                  key={line}
                  x={annotation.layout.x + annotation.layout.pad}
                  dy={i === 0 ? 0 : annotation.layout.font * NOTE_LINE}
                >
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        </g>
      )}
    </svg>
  );
}

import { useEffect, useMemo, useState } from "react";

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

export type GraphNode = {
  id: string;
  label?: string;
  title?: string;
  hub?: boolean;
  anchor?: boolean;
  /** "article" (default), "contributor" or "follower". */
  kind?: "article" | "contributor" | "follower";
  /** Small caption shown with the label, e.g. "contributor". */
  tag?: string;
  /** Target position for anchors. */
  tx?: number;
  ty?: number;
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
      label: "Part V · The Executive",
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
      tx: ax,
      ty: ay,
      x: ax,
      y: ay,
      vx: 0,
      vy: 0,
    });
    edges.push({ a: 0, b: anchorIndex });

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
        x: ax + Math.cos(a2) * r2 * spread,
        y: ay + Math.sin(a2) * r2 * spread,
        vx: 0,
        vy: 0,
      });
      edges.push({ a: anchorIndex, b: nodes.length - 1 });
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
        edges.push({ a: i, b: j });
      }
    }

    // Part XXI carries a worked example of the knowledge hierarchy:
    // Article 371 -> the person who curated it -> the people following them.
    if (branch.id === "part-xxi") {
      // The chain is pinned rather than simulated: a four-level tail on a
      // shared canvas otherwise piles up against the frame edge.
      const pin = (node: GraphNode, px: number, py: number) => {
        node.tx = WIDTH * px;
        node.ty = HEIGHT * py;
        node.x = node.tx;
        node.y = node.ty;
      };

      const articleNode = nodes[leafStart];
      pin(articleNode, 0.3, 0.63);

      const contributorIndex = nodes.length;
      const contributor = {
        id: "contrib-jehosh",
        label: "Jehosh",
        tag: "contributor",
        title: "Jehosh — contributor to Article 371J",
        kind: "contributor" as const,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
      };
      pin(contributor, 0.215, 0.74);
      nodes.push(contributor);
      edges.push({ a: leafStart, b: contributorIndex, rest: 40 });

      const followerSlots: Array<[string, number, number]> = [
        ["Sukriti", 0.095, 0.66],
        ["Sudeep", 0.13, 0.845],
        ["Gayatri", 0.235, 0.885],
      ];
      for (const [name, px, py] of followerSlots) {
        const follower = {
          id: `follower-${name.toLowerCase()}`,
          label: name,
          tag: "follower",
          title: `${name} — follower of Jehosh`,
          kind: "follower" as const,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
        };
        pin(follower, px, py);
        nodes.push(follower);
        edges.push({
          a: contributorIndex,
          b: nodes.length - 1,
          dashed: true,
          rest: 34,
        });
      }

      // The four people know each other: connect the followers pairwise too.
      const followerIndices = nodes
        .map((node, index) => (node.kind === "follower" ? index : -1))
        .filter((index) => index >= 0);
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
      node.vx += (node.tx - node.x) * PIN;
      node.vy += (node.ty - node.y) * PIN;
    }

    node.vx *= DAMPING;
    node.vy *= DAMPING;

    const pad = 34;
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

export function LandingGraph() {
  const { nodes, edges } = useMemo(() => {
    const graph = buildGraph();
    for (let i = 0; i < 900; i++) step(graph.nodes, graph.edges);
    return graph;
  }, []);

  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

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

  // Which labels are on screen: the structural ones always, an article's own
  // label plus its direct neighbours only while that article is hovered.
  const labelled = useMemo(() => {
    const set = new Set<string>();
    for (const node of nodes) {
      if (node.hub || node.anchor) set.add(node.id);
    }
    if (hovered) {
      const node = nodes.find((n) => n.id === hovered);
      set.add(hovered);
      if (node && !node.hub && !node.anchor) {
        for (const id of neighbours.get(hovered) ?? []) set.add(id);
      }
    }
    return set;
  }, [hovered, neighbours, nodes]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg
      data-graph="knowledge"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={`h-full w-full transition-opacity duration-700 ease-out motion-reduce:transition-none ${visible ? "opacity-100" : "opacity-0"}`}
      role="img"
      aria-label="Constitution of India: articles grouped by Parts — Fundamental Rights, Directive Principles, and the Executive"
    >
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
            className={
              touching
                ? "text-[#007aff] transition-opacity duration-150 dark:text-[#6b8fff]"
                : "text-[#d2d2d7] transition-opacity duration-150 dark:text-[#38383a]"
            }
          />
        );
      })}

      <g>
        {nodes.map((node) => {
          const isHot = hot(node.id);
          const isDim = hovered !== null && !isHot;
          const grow = node.id === hovered ? 1.25 : 1;
          const opacity = isDim ? 0.28 : 1;
          const accent = node.id === hovered;

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
              <circle cx={node.x} cy={node.y} r={20} fill="transparent" />

              {node.hub ? (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={12 * grow}
                  className="fill-[#007aff] dark:fill-[#6b8fff]"
                />
              ) : node.kind === "contributor" || node.kind === "follower" ? (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={(node.kind === "contributor" ? 5.5 : 4.25) * grow}
                  strokeWidth={1.5}
                  className={
                    accent
                      ? "fill-[#007aff] stroke-[#007aff] dark:fill-[#6b8fff] dark:stroke-[#6b8fff]"
                      : "fill-transparent stroke-[#6e6e73] dark:stroke-[#a1a1a6]"
                  }
                />
              ) : node.anchor ? (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={7.5 * grow}
                  className={
                    accent
                      ? "fill-[#007aff] dark:fill-[#6b8fff]"
                      : "fill-[#1d1d1f] dark:fill-white"
                  }
                  fillOpacity={0.92}
                />
              ) : (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={5.5 * grow}
                  className={
                    accent
                      ? "fill-[#007aff] dark:fill-[#6b8fff]"
                      : "fill-[#1d1d1f] dark:fill-white"
                  }
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
          // Structural labels sit to the side; article labels alternate
          // above/below so neighbouring ones do not collide.
          const flipAt = node.hub ? 0.95 : node.anchor ? 0.86 : 0.72;
          const flip = !isLeaf && node.x > WIDTH * flipAt;
          const offset = node.hub ? 17 : node.anchor ? 12 : 9;
          const size = node.hub ? 11 : node.anchor ? 10 : 9;
          const above = index % 2 === 0;
          let x = isLeaf ? node.x : node.x + (flip ? -offset : offset);
          let y = isLeaf ? node.y + (above ? -10 : 16) : node.y + 3.5;
          let anchor: "middle" | "start" | "end" = isLeaf
            ? "middle"
            : flip
              ? "end"
              : "start";

          // A hovered article pushes its label radially away from its Part,
          // so it never lands on the Part's own caption.
          if (isLeaf && node.id === hovered) {
            const parentId = neighbours.get(node.id);
            const parent = nodes.find((n) => n.anchor && parentId?.has(n.id));
            if (parent) {
              const dx = node.x - parent.x;
              const dy = node.y - parent.y;
              const len = Math.hypot(dx, dy) || 1;
              x = node.x + (dx / len) * 18;
              y = node.y + (dy / len) * 18 + 3;
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
              strokeWidth={3.5}
              strokeLinejoin="round"
              paintOrder="stroke"
              opacity={isDim ? 0.25 : 1}
              className={`pointer-events-none stroke-[#fbfbfb] font-medium transition-opacity duration-150 dark:stroke-[#0c0c0c] ${
                node.kind
                  ? "fill-[#e0168e] dark:fill-[#ff7ab8]"
                  : node.id === hovered || node.hub || node.anchor
                    ? "fill-[#1d1d1f] dark:fill-white"
                    : "fill-[#6e6e73] dark:fill-[#a1a1a6]"
              }`}
            >
              {node.anchor && node.id === hovered ? node.title : node.label}
            </text>
          );
        })}
      </g>
    </svg>
  );
}

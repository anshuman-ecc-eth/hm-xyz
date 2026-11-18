# hyvmind.xyz

A social graph for legal researchers. Each post is a contribution to an expanding
artifact — recorded, organised and credited to its author.

The sibling project is **Hyvmind** ([`hyvmind.app`](https://hyvmind.app),
[repo](https://github.com/anshuman-ecc-eth/hyvmind)), a shared note-taking space
where notes become legal knowledge graphs. **xyz is the social layer; the app is
where the knowledge graphs live.** This README covers xyz and the plan to connect
the two.

**Contents**

- [Stack](#stack)
  - [Live deployments](#live-deployments)
- [Build & check](#build--check)
- [Roadmap: connect posts to Hyvmind knowledge graphs](#roadmap-connect-posts-to-hyvmind-knowledge-graphs)
  - [Goal](#goal)
  - [Constraints (verified, not assumed)](#constraints-verified-not-assumed)
  - [Decisions](#decisions)
  - [Phases](#phases)
    - [Phase 1 — citations](#phase-1--citations-xyz-only-zero-risk)
    - [Phase 2 — principal link](#phase-2--principal-link-both)
    - [Phase 3 — write from xyz](#phase-3--write-from-xyz-both)
    - [Phase 4 — deep links](#phase-4--deep-links)
  - [Not doing (and why)](#not-doing-and-why)
  - [Open items](#open-items)
  - [Reference — Hyvmind API shapes](#reference--hyvmind-api-shapes)

---

## Stack

- **Backend** — Motoko, `mo:core` persistent actor, compiled with `mops`.
  Implements users, posts, replies, reposts, quotes, likes, follows, blocks/mutes,
  notifications, search, trending and object storage. Currently still the stock
  Caffeine MicroBlog model — no graph concepts yet.
- **Frontend** — React 19 + TypeScript + Vite + Tailwind, TanStack Router,
  react-query, shadcn/Radix. Designed in the opencode idiom: mono type, hairline
  frames, square corners, numbered sidebar.
- **Auth** — Internet Identity via `@caffeineai/core-infrastructure`.
- **Deploy** — Caffeine cloud pipeline (`caffeine.toml`); `mops.toml` for the
  backend, `pnpm` workspace for the frontend.

```
src/backend/     main.mo, migrations/, dist/ (wasm + .did)
src/frontend/    React app, public/brand/, dist/
mops.toml        backend canister + toolchain pins (moc 2.1.0)
caffeine.toml    workspace manifest
.old/            previous backend build, used by `check-stable`
```

### Live deployments

| | xyz | Hyvmind app |
|---|---|---|
| Origin | `https://www.hyvmind.xyz` | `https://hyvmind.app` |
| Frontend canister | `2qsaq-7qaaa-aaaan-q6y3q-cai` | `4g6ye-oqaaa-aaaam-qfamq-cai` |
| Backend canister | `2xtge-siaaa-aaaan-q6y3a-cai` | `4p5ty-yyaaa-aaaam-qfana-cai` |
| II derivation origin | `https://hmxyz-i85.caffeine.xyz` | `https://hyvmind---hierarchical-knowledge-graph-application-a15.caffeine.xyz` |

## Build & check

```bash
cd src/backend && mops check     # typecheck
cd src/backend && mops build     # -> src/backend/dist/backend.wasm + .did
pnpm bindgen                     # regenerate src/frontend/src/backend.{ts,d.ts}

cd src/frontend && pnpm typecheck
cd src/frontend && pnpm check    # biome
cd src/frontend && pnpm fix
```

Bindings are generated from `src/backend/dist/backend.did` — **any backend
signature change requires `mops build` + `pnpm bindgen`**, or the frontend will
silently disagree with the canister.

---

## Roadmap: connect posts to Hyvmind knowledge graphs

### Goal

A post should be able to attach to a node in a Hyvmind knowledge graph
(`curation → swarm → location → lawEntity → interpEntity`), so the social layer
and the knowledge layer reference each other. Eventually xyz users should be able
to read, cite and write graphs from xyz.

### Constraints (verified, not assumed)

1. **Hyvmind already exposes a public read API** from the backend canister's
   `http_request`, with `access-control-allow-origin: *`:
   `GET /api/graphs`, `/api/graphs/{id}`, `/api/nodes/{id}`, `/api/edges/{id}`,
   `/api/weights/{id}`, plus an MCP JSON-RPC endpoint at `/mcp`.
   No auth, no API key, and no working rate limit — `track_api_request` writes
   counters that nothing ever reads.
2. **All published graph content is already public.** Drafts have *no* read
   endpoint at all (`getNotesData` reads only the caller's own blob). There is no
   private graph content to gate today.
3. **Shared principals are not achievable.** Caffeine generates
   `/.well-known/ii-alternative-origins` and `env.json`'s `ii_derivation_origin`
   in its cloud pipeline; neither is a repo input. Each project gets one custom
   domain slot. Adding `www.hyvmind.xyz` to the app's alternative origins would
   need a Caffeine support request, and *repointing* an origin orphans every
   existing account — II principals are per-origin and cannot be migrated.
   There are ~25 real principals and 10 published graphs on the app.
4. **Node IDs are `@`-joined path strings** and are *not* unique — the live data
   contains both `SARFAESI ACT, 2002` and `SARFAESI Act, 2002`. Published graph
   IDs are immutable snapshots (`published-<nanos>-<n>`), so pinning to one is safe.
5. **Queries cannot make outbound calls**, and hyvmind's HTTP API is a query.
   Any cross-canister authorization check is therefore unavailable on read paths.
6. **`pluginBindings` / `getEffectiveUser` is not reusable as an identity link**:
   it is one-way, write-only (`getNotesData` uses raw caller while
   `storeNotesData` uses the effective user), and plugin-shaped.
7. **Hyvmind's chat is not a real boundary either** — `getMessages` auto-adds any
   caller to channel membership. Do not model access control on it.

### Decisions

- **Identity linking happens in hyvmind's backend, not in II.** Code-based,
  owner-initiated, no crypto and no cross-canister trust:
  1. In hyvmind settings, the user (already authenticated as `P_hv`) requests
     "Connect an xyz account" and receives a short code.
  2. They paste it into xyz; xyz's backend — allowlisted in hyvmind — calls
     `confirmLink(code, P_xyz)`.
  3. Hyvmind binds `P_hv ↔ P_xyz` with symmetric lookup and either side can revoke.
  Fix `getNotesData` to use the resolver in the same change, or the link stays
  write-only.
- **Reads use the public API directly from the browser.** No proxy, no outcalls,
  no cycles. Cache aggressively: `/api/graphs` once per session / 60s, and treat
  each per-graph payload as immutable keyed by `publishedAt`.
- **Resolve the app's backend canister ID from `https://hyvmind.app/env.json`**
  with `4p5ty-yyaaa-aaaam-qfana-cai` as a fallback. Do not hardcode it.
- **Follower-gating is dropped as an access-control primitive.** One-way follows
  plus "mutuals" is a discovery heuristic, not a permission decision, and for
  legal research explicit per-curation grants are the right model. The follow
  graph drives feeds; it does not authorize reads.

### Phases

| # | Repo | Work |
|---|---|---|
| 1 | xyz | **Citations on published graphs** — shippable standalone |
| 2 | both | **Principal link** — needed before any write |
| 3 | both | **Write graphs from xyz** — attributed to the linked app identity |
| 4 | both | **Deep links** `?graph=&node=` in the app |

#### Phase 1 — citations (xyz only, zero risk)

Backend:

```motoko
type GraphRef = {
  graphId : Text;
  graphName : Text;
  nodeId : Text;
  nodeName : Text;
  nodeType : Text;        // "curation" | "swarm" | "location" | "lawEntity" | "interpEntity"
  path : Text;            // "Indian Securities Law › SARFAESI Act, 2002 › s.2(1)(z)"
  attachedAt : Time.Time;
};

let postGraphRefs : Map.Map<Nat, GraphRef>;                       // postId -> citation
let graphNodePosts : Map.Map<Text, Map.Map<Nat, Bool>>;           // "graphId#nodeId" -> posts
```

- Keep citations in **separate maps**, not fields on `Post` — the migration then
  adds two empties instead of rewriting every post, and a citation can be
  added/removed after posting.
- `PostResponse` gains `graphRef : ?GraphRef`, joined at read time.
- `getPostsByGraphNode(graphId, nodeId, cursor, limit)` powers the node page.
- Requires one new file in `src/backend/migrations/` (`check-limit = 1`, so the
  chain keeps the latest entry). Consult the `migrating-motoko-actors` skill.
- Regenerate bindings (`mops build` + `pnpm bindgen`).

Frontend:

- `src/lib/hyvmind.ts` — typed client over `/api/graphs` and `/api/nodes/{id}`,
  wrapped in react-query; one fetch per graph, never per node.
- Picker in `ComposePost`: graph → searchable flattened node tree.
- Citation chip on `PostCard` / `PostDetail`; panel showing the node's `sources`,
  `tags` and `customAttributes`.
- Store the name/path snapshot so a citation still renders meaningfully if the
  node later disappears — mark it "unresolved" rather than lying.

#### Phase 2 — principal link (both)

- Hyvmind: dedicated `principalLinks` map with a link-type tag, symmetric lookup,
  revoke from either side, and a resolver used by **reads and writes**. Do not
  extend `pluginBindings`.
- Hyvmind: allowlist xyz's backend canister principal for `confirmLink`
  (explicit check — `inspect_message` does not run for inter-canister calls).
- Hyvmind: fix `getNotesData` to read via the effective-user resolver.
- xyz: "Connected accounts" settings UI, code entry, and a display of the linked
  app profile.

#### Phase 3 — write from xyz (both)

- Create curations/swarms from xyz, calling hyvmind's Candid API; authorship,
  buzz and trust accrue to the linked app identity (`createSwarm` already records
  `creator`; contributions are per node in `graphContributionList`).
- Writes are updates, so a live follow/mutual check is *possible* here — but with
  follower-gating dropped, authorization stays: owner of the curation, plus any
  explicit grants hyvmind later introduces.
- Return-path: publishing produces a `published-*` graph ID that xyz can cite.

#### Phase 4 — deep links

- Hyvmind: accept `?graph=<id>&node=<id>` and focus the graph/node view.
- xyz: citation chips link straight into the app instead of the graph tab.

### Not doing (and why)

- **Repointing or sharing II derivation origins.** Caffeine owns both files; the
  change is destructive for existing accounts and cannot be migrated.
- **Follower-gating published graphs.** They are already public; gating them is a
  regression.
- **Reusing `pluginBindings`.** Write-only, one-way, plugin-shaped.
- **Hardcoding canister IDs.** Fetch from the app's `env.json`.
- **Polling `/api/*` per node.** Payloads are whole-graph; fetch once and cache.
- **Server-side HTTPS outcalls for citations.** No per-node endpoint exists, so
  validating one node costs a whole-graph fetch plus a transform. Add only if
  tamper-resistant references are ever needed.

### Open items

- Whether to file a Caffeine support request for a second alternative origin
  (would enable true shared principals, no link UI). Not worth blocking on —
  account linking also survives a migration off Caffeine.
- If hyvmind ever grows private drafts, decide the grant model explicitly;
  do not infer it from the follow graph.
- Whether every xyz post must cite a node (matching the landing-page promise) or
  citations stay optional.

### Reference — Hyvmind API shapes

`GET /api/graphs` → array of
`{ id, name, creator, creatorName, publishedAt, nodeCount, edgeCount,
hierarchyEdgeCount, attributeCount, sourcesCount, extensions[], authorDetails[] }`.

`GET /api/nodes/{graphId}` → array of
`{ id, name, type, parentId?, creator, createdAt, tags[], attributes[],
sources[{name,url}], customAttributes? }`.
Node IDs are `@`-joined paths; duplicates exist.

`GET /api/edges/{graphId}` → cross-reference edges only
`{ source, target, label, bidirectional }`.

`GET /api/weights/{graphId}` → `[{ nodeId, weight, graffiti[{id,text,weight}] }]`.

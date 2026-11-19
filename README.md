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
- [The model](#the-model)
  - [Regular posts and graph posts](#regular-posts-and-graph-posts)
  - [Interpretation tokens](#interpretation-tokens)
  - [Weight](#weight)
  - [Votes and deletion](#votes-and-deletion)
  - [Phase 1 posts are xyz-only](#phase-1-posts-are-xyz-only)
- [Roadmap: connect posts to Hyvmind knowledge graphs](#roadmap-connect-posts-to-hyvmind-knowledge-graphs)
  - [Goal](#goal)
  - [Constraints (verified, not assumed)](#constraints-verified-not-assumed)
  - [Decisions](#decisions)
  - [Phases](#phases)
    - [Phase 1 — interpretation tokens](#phase-1--interpretation-tokens-xyz-only-zero-risk)
    - [Phase 2 — principal link](#phase-2--principal-link-both)
    - [Phase 3 — write tokens from xyz](#phase-3--write-tokens-from-xyz-both)
    - [Phase 4 — deep links](#phase-4--deep-links)
  - [Not doing (and why)](#not-doing-and-why)
  - [Open items](#open-items)
  - [Reference — Hyvmind API shapes](#reference--hyvmind-api-shapes)

---

## Stack

- **Backend** — Motoko, `mo:core` persistent actor, compiled with `mops`.
  Implements users, posts, replies, reposts, quotes, likes, follows, blocks/mutes,
  notifications, search, trending and object storage. Still the stock Caffeine
  MicroBlog model plus the token layer described below.
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

## The model

### Regular posts and graph posts

A post that cites a node in a Hyvmind graph is not a post *about* that node. It
**is** an interpretation of it, and the citation is its identity rather than
metadata attached to it. Two kinds of post, and the kind is fixed at creation:

| | Regular post | Graph post |
|---|---|---|
| Edit / delete (author) | yes, 15-min window | **never** |
| Attached to a node | no | yes, immutable ref |
| Dislike button | no | yes |
| Can be vote-deleted | no | yes |
| Can be archived | no | later, via governance |

Graph posts cannot be edited, deleted or detached by their author. The only way
a token leaves the graph is a vote (see below).

**Inheritance is enforced server-side and the client cannot opt out:**

- a reply to a token becomes a new token on the same node
- a quote of a token becomes a new token on the same node, with the quote text
- a quote or reply of a *regular* post stays regular
- a repost never inherits — it is an endorsement, not a token, and stays regular

### Interpretation tokens

Hyvmind's hierarchy has five node types: **curation → swarm → location →
lawEntity (law token) → interpEntity (interpretation token)**. An interpretation
token carries a title and content and is the only node type that represents an
argument.

A graph post in xyz is one interpretation token. It is created at the last level
of the hierarchy, never as a container: writing a curation, swarm or location is
only possible as an ancestor on the path to the token.

### Weight

Two unrelated numbers, always labelled separately and **never summed**:

- **xyz weight** — has no counterpart in the app. `token weight = 1 + likes +
  reposts − dislikes`, and a node's xyz weight is the sum over its tokens. This
  is the vote signal that drives deletion.
- **graph weight** — what `/api/weights/{graphId}` reports. In the app it is a
  graffiti/voxel link signal, written through an unauthenticated method, so it is
  not a trustworthy vote channel.

Weights are **not mirrored** between the two in the current scope. Mirroring
would need a dedicated `postWeight` field and an allowlisted adjust method; it
must never be implemented by synthesising graffiti.

### Votes and deletion

- likes increase a token's weight by 1, dislikes decrease it by 1
- one vote per principal, like and dislike mutually exclusive
- the author cannot vote on their own token
- a token is deleted when `dislikes > likes` **and** `dislikes >= 3`
- deletion is physical, irreversible, and cascades through the reply subtree;
  quotes survive as independent tokens and render "unavailable"; reposts of the
  deleted token are removed
- the rule is evaluated after dislike, undislike and unlike, since removing a
  like can cross the threshold
- **a token that has been published to the app is not deletable, and pins
  everything beneath it.** A branch containing any published token is never
  removed. Permanence is the design: removal-from-view is an xyz-side concern
  (`hiddenAt`), and the app token is immutable either way. Vote-deletion
  therefore applies to xyz-only citations, not to published contributions.

### Phase 1 posts are xyz-only

Until the write path (Phase 3) exists, a graph post never reaches the app: it is
a citation held in xyz, with xyz weight, that appears only here. Publishing one
to the graph later is a **new token created from an immutable post**, with its
own write id. It is not an edit, and it does not mutate the post.

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
4. **Node IDs are opaque.** Use the `id` field from `/api/nodes` verbatim: never
   parse it, never synthesise one, never build one from a name. Both shapes are
   normal and live side by side — generated ids
   (`nodeType-name-creator-timestamp`) for legacy `create*` nodes and curations,
   and path-shaped ids (`Curation@Swarm@Location@s.1`) for nodes created by
   publish or by an xyz write. A path-shaped id is still an exact key, not a name
   lookup: the live data has distinct nodes named `SARFAESI ACT, 2002` and
   `SARFAESI Act, 2002`, each with its own id, and the id selects exactly one.
   Ids are long and contain spaces and `@`, so they must be URL-encoded. A node's
   human path is display-only, built by walking `parentId` (curation → swarm →
   location → lawEntity → interpEntity), and is never sent back to the app.
   Published graph IDs are immutable snapshots (`published-<nanos>-<n>`), so
   pinning to one is safe.
5. **Queries cannot make outbound calls**, and hyvmind's HTTP API is a query.
   Any cross-canister authorization check is therefore unavailable on read paths.
6. **`pluginBindings` / `getEffectiveUser` is not reusable as an identity link**:
   it is one-way and plugin-shaped. It is not broken, though — `storeNotesData`
   writes via the effective user and `getNotesData` is read by the signed-in user
   (`EditorView.tsx:377`), so the Obsidian import slot works end to end. Do not
   "fix" it into the link: the link carries no data channel at all.
7. **Hyvmind's chat is not a real boundary either** — `getMessages` auto-adds any
   caller to channel membership. Do not model access control on it.
8. **There is no public `createLawToken`.** Law tokens exist only as ancestors
   created inside a publish or inside a write. A standalone node-creation API
   would be a dead end; the write contract creates containers only as the path to
   a token.

### Decisions

- **Identity linking happens in hyvmind's backend, not in II.** Code-based,
  owner-initiated, no crypto and no cross-canister trust:
  1. In hyvmind settings, the user (already authenticated as `P_hv`) requests
     "Connect an xyz account" and receives a short code.
  2. They paste it into xyz; xyz's backend — allowlisted in hyvmind — calls
     `confirmLink(code, P_xyz)`.
  3. Hyvmind binds `P_hv ↔ P_xyz` with one account per side and either side can
     revoke.

  Authorization is **directional**: `P_xyz → P_hv` only, held in two maps. A
  `.app` principal never inherits `.xyz` privileges.
- **Reads use the public API directly from the browser.** No proxy, no outcalls,
  no cycles. Cache aggressively keyed on `(graphId, revision)` — `/api/graphs`
  carries `revision` and every extension bumps it, so per-graph payloads are
  fetched once per revision rather than once per session.
- **Strip control characters before parsing.** The API emits raw
  `\u0000`–`\u001f` bytes inside node content, and `/api/graphs/{id}` fails
  `JSON.parse` outright on live data (`Bad control character in string literal`).
  Every response body is sanitised before parsing; this is a hard requirement,
  not defensive polish.
- **Resolve the app's backend canister ID from `https://hyvmind.app/env.json`**
  with `4p5ty-yyaaa-aaaam-qfana-cai` as a fallback. Do not hardcode it.
- **Follower-gating is dropped for reads and retained for writes.** One-way
  follows plus "mutuals" is a discovery heuristic, not a permission decision, and
  for legal research explicit per-curation grants are the right model. The follow
  graph drives feeds; it does not authorize reads. It *does* gate writes: a
  writer may only extend a path whose existing creators mutually follow them —
  a social constraint xyz enforces before calling, not an on-chain boundary.
- **Weights are not mirrored in the current scope.** See [Weight](#weight).

### Phases

| # | Repo | Work |
|---|---|---|
| 1 | xyz | **Interpretation tokens** — shippable standalone |
| 2 | both | **Principal link** — needed before any write |
| 3 | both | **Write tokens from xyz** — attributed to the linked app identity |
| 4 | both | **Deep links** `?graph=&node=` in the app |

#### Phase 1 — interpretation tokens (xyz only, zero risk)

Backend:

```motoko
type GraphRef = {
  graphId : Text;
  graphName : Text;
  nodeId : Text;
  nodeName : Text;
  nodeType : Text;        // "curation" | "swarm" | "location" | "lawEntity" | "interpEntity"
  path : Text;            // built from parentId, e.g. "Indian Securities Law › SARFAESI Act, 2002 › s.2(1)(z)"
  attachedAt : Time.Time;
  hiddenAt : ?Time.Time;    // reserved: xyz-local visibility; never sent to the app
  tokenNodeId : ?Text;      // reserved: app interpEntity id once Phase 3 publishes it
};

let postGraphRefs : Map.Map<Nat, GraphRef>;                       // presence = graph post
let graphNodePosts : Map.Map<Text,
                      Map.Map<Text,
                        Map.Map<Nat, Bool>>>;                     // graphId -> nodeId -> posts
let postDislikes : Map.Map<Nat, Map.Map<Principal, Bool>>;
```

- Keep citations in **separate maps**, not fields on `Post` — the migration then
  adds empties instead of rewriting every post. Presence in `postGraphRefs` is
  what makes a post a token.
- `graphNodePosts` is **nested**, not keyed `"graphId#nodeId"`: both ids are
  client-supplied text that can contain any separator.
- `PostResponse` gains `graphRef : ?GraphRef`, `weight : ?Nat`,
  `dislikeCount`, `isDislikedByCurrentUser`, `canEdit` and `canDelete`, joined at
  read time so every feed and detail path gets them for free.
- `createGraphPost(ref, …)` creates the post and both index entries atomically.
  `createReply` and `quotePost` inherit the parent's ref server-side; `repostPost`
  explicitly does not.
- `editPost` and `deletePost` trap on any post with a ref, before the window
  check.
- Dislike voting and the cascade described in [Votes and deletion](#votes-and-deletion).
- `getPostsByGraphNode(graphId, nodeId, cursor, limit)` powers the node page and
  returns `nodeWeight` and `tokenCount`.
- Ref fields are validated for shape and length only — a query cannot verify a
  node exists. `graphId` must start with `published-`, `nodeType` is whitelisted,
  and every field is length-capped, because the ref is permanent and echoed in
  every response.
- Requires one new file in `src/backend/migrations/` (`check-limit = 1`, so the
  chain keeps the latest entry). Consult the `migrating-motoko-actors` skill.
- Regenerate bindings (`mops build` + `pnpm bindgen`).

Frontend:

- `src/lib/hyvmind.ts` — typed client over `/api/graphs` and `/api/nodes/{id}`,
  wrapped in react-query, cached per `(graphId, revision)`; one fetch per graph,
  never per node.
- Picker in `ComposePost` mirrors the app's own `{@` dropdown and its Public-page
  fuzzy finder: all five node types are searchable, but only `lawEntity` and
  `interpEntity` are selectable — a token must hang off a law token, so a
  citation of a curation, swarm or location has no legal materialisation. Type
  dots, substring scoring over name + path + `content`, arrows/enter/escape.
- **No inline citation syntax in post text.** A post has exactly one citation and
  it is structural.
- Citation chip on `PostCard` / `PostDetail`, linking to the node page; sources
  panel on the node page.
- Store the name and path snapshot so a citation still renders meaningfully if the
  node later disappears — mark it "unresolved" rather than lying.
- Node page at `/node/$graphId?node=<id>` — a query parameter, because node ids
  contain spaces and separators.
- Dislike button on tokens only; weight shown as "xyz weight", never summed with
  graph weight.

#### Phase 2 — principal link (both)

- Hyvmind: dedicated link state with **two directional maps** (`P_hv → link`,
  `P_xyz → P_hv`), one xyz account per app account, and either side can revoke.
  Do not extend `pluginBindings`.
- Hyvmind: allowlist xyz's backend canister principal for `confirmLink`,
  `resolveLinkCode`, `revokeLinkAsXyz`, `getLinkForXyz`, `getLinkedXyzPrincipal`
  and `isAppPrincipalLinked`. Do not use `AccessControl.hasPermission` for
  canister callers — it traps on unregistered principals, and `inspect_message`
  does not run for inter-canister calls.
- Hyvmind: codes are 16 lowercase hex, 10-minute TTL, single use; `confirmLink` is
  idempotent on `(code, xyzPrincipal)` and is the only consumer. `resolveLinkCode`
  exists so xyz can show "Link this account?" before binding.
- Hyvmind: the link carries **no data channel**. `getNotesData` and
  `storeNotesData` are left exactly as they are; there are no `.for` variants and
  there never will be. The only path between the two apps is the write channel,
  and only from Phase 3.
- xyz: `/settings` with a Linked accounts section — code entry, confirmation card,
  linked state, unlink. Copy should promise attribution only, not sync: before
  Phase 3 a link buys attribution readiness and nothing else.
- xyz: store `P_hv` server-side in **both directions** (`P_xyz → P_hv` and
  `P_hv → P_xyz`), written and deleted in the same update, never in the browser.
  The reverse index is what lets us attest path creators. Reconcile with
  `getLinkForXyz` when the app still has the link; an attestation miss is never
  shown as "they haven't linked".
- xyz: the app canister id is a **compile-time constant** in the backend, not a
  stable field. It is stable per Caffeine project, and changing it is a redeploy
  on our side, so there is no admin surface for it. `getAppBackend()` exposes it
  for debugging.
- xyz: every cross-canister call uses a **bounded wait** (`with timeout = 30`)
  and `try`/`catch`, so an unresponsive app cannot block our upgrades.
  `confirmAppLink` holds a per-caller in-flight lock across its two awaits; the
  local write happens only after the app returns `#ok`.
- Trust boundary: the app checks that path creators are **linked**, that the
  attestation covers them, and that asserted principals resolve to linked
  accounts. It never evaluates follows. A compromised xyz can skip the mutual
  check and still write; the link delegates that authority.

#### Phase 3 — write tokens from xyz (both)

Writes are post-shaped: **one graph post creates exactly one interpretation
token.** There is no standalone node or edge creation, and a write that stops at a
curation, swarm or location is rejected.

- Request: `title` (1–200 chars, trimmed, **no `@`** — it becomes part of the
  node id), `content` (1–20,000 chars, required, no media), `parentLaw` (existing
  law id, or a new law included in `ancestors`), `ancestors` (0–4 new nodes on one
  chain to that law, no siblings; each name 1–200 and no `@`; `tags` only on
  swarms), `citations` (0–1 in xyz; the app accepts up to 20), and
  `apiVersion = 1`. Oversize input is `#err(#malformed)`; a payload over 2 MB is
  rejected at the transport layer, so we validate client-side and stay well under
  ~1 MB.
- `anchor = citations[0] ?? parentLaw`. The same expression must be used for any
  future weight target.
- `writeId = "xyz:" + postId`, the only retry key. Same key and same payload
  returns the stored result; same key and different payload conflicts. Committed
  results are retained indefinitely. Previews store nothing.
- Preview is an update with a 2-second cooldown per linked account and returns a
  plan, cost, balance and a **digest**. Commit resends the exact input plus the
  digest; `#stale` means re-show and ask again; `#blocked` and `#insufficient`
  charge nothing.
- Permissions: every existing creator on the path must have a linked app account
  and mutually follow the writer; a creator who is the writer is satisfied with no
  attestation. Blocks return `pathCreators` with `{ appPrincipal, displayName?,
  linked }` so xyz can render "follow @X" versus "ask them to link". The app never
  emits "not mutual".
- Day-one consequence, stated plainly: **existing graphs are effectively
  read-only from xyz** until their path creators link and mutual-follow. New
  branches under the writer's own nodes, and new graphs, work immediately.
- No weight mirroring. `mutualFollowXyz` carries xyz principals; `writerApp` is
  always derived app-side from `writerXyz` and never asserted.
- xyz: store the returned published graph id, revision, interp node id and path
  per post, in `tokenNodeId`, and render it from the snapshot.

**As built.** One migration-free step: `GraphRef.tokenNodeId` already existed, so
Phase 3 adds no stable fields. Three things turned out differently from the sketch
above, each verified against the deployed app:

- **The payload is a pure function of `postId`.** Title, `parentLaw` and the
  citation are derived server-side from the stored post and graph — nothing is
  taken from the client. `#conflict` is therefore unreachable except through a bug
  of ours, and `#stale` can only mean the graph moved under us.
- **Two cost shapes, not one.** A cited `interpEntity` attaches under its
  `parentLawTokenId` and cites itself: 50 + 1 = **5.1 BUZZ**. A cited `lawEntity`
  *is* the anchor, so it cites nothing (`citations = []`, since a target on the
  path is a `hierarchyEdge` block): **5.0 BUZZ**. `parentLaw` comes from
  `getPublishedSourceGraph`, whose `interpretationTokens[].parentLawTokenId` is
  flat — no tree walk. That read is a query, so a malicious replica could in
  principle misdirect the anchor; the app still validates existence, type and
  path consistency, and the writer pays either way.
- **Title is derived, never stored.** First non-empty line, `@` stripped,
  whitespace collapsed, truncated to 200, falling back to a refusal rather than
  an unnamed node. Because the post text is immutable and the title is in the
  digest, preview and commit cannot disagree about it.

Commit is never auto-retried: a bounded-wait timeout does not cancel the callee, so
an immediate retry could race a still-running write. A lost reply becomes
`#unknown`, and `reconcileXyzWriteForPost` asks the app's `getXyzWrite` before the
user retries. A transient per-post lock (not just a disabled button) is what
prevents a double charge, because the app's idempotency is on `(writeId, digest)`
but not concurrency-safe. That lock also makes a branch with a write in flight
undeletable, and `markPublished` refuses to resurrect a purged post.

Two facts worth carrying forward: **no production xyz write has ever been
committed** (every graph sits at `revision: 0`, `xyzWriteCount: 0`), so the first
one deserves a coordinated window; and `/?settings=wallet&redeem=1` redeems a
secret code from the text game — there is no card top-up, so the `#insufficient`
path says so instead of promising a purchase.

#### Phase 4 — deep links

- Hyvmind: accept `?graph=<id>&node=<id>` and focus the graph/node view.
- xyz: citation chips link straight into the app instead of the graph tab.

### Not doing (and why)

- **Repointing or sharing II derivation origins.** Caffeine owns both files; the
  change is destructive for existing accounts and cannot be migrated.
- **Follower-gating published graphs.** They are already public; gating them is a
  regression. Reads are never gated.
- **Attaching or detaching citations after posting.** A citation is irreversible,
  and can only be removed by the vote rule.
- **Mirroring weights in the current scope.** The app's weight path is an
  unauthenticated voxel method, not a trustworthy vote channel. Mirroring needs a
  dedicated field and an allowlisted adjust method, never synthetic graffiti.
- **Retracting a published token.** A token in the graph is immutable and has no
  retraction path. Permanence is intentional; hiding is an xyz-side view concern.
- **Standalone node or edge creation from xyz.** Containers exist only as the path
  to a token.
- **Reusing `pluginBindings`.** Write-only, one-way, plugin-shaped.
- **Hardcoding canister IDs.** Fetch from the app's `env.json`.
- **Polling `/api/*` per node.** Payloads are whole-graph; fetch once per revision
  and cache.
- **Server-side HTTPS outcalls for citations.** No per-node endpoint exists, so
  validating one node costs a whole-graph fetch plus a transform. Add only if
  tamper-resistant references are ever needed.

### Open items

- Whether to file a Caffeine support request for a second alternative origin
  (would enable true shared principals, no link UI). Not worth blocking on —
  account linking also survives a migration off Caffeine.
- If hyvmind ever grows private drafts, decide the grant model explicitly; do not
  infer it from the follow graph.
- Governance and archiving. `archiveNode` exists in the app but is any-user and
  irreversible, so xyz reserves `archivedAt` and implements nothing until
  ownership and unarchive are reconciled.
- Whether a Phase 1 xyz-only citation should be publishable as a token once Phase 3
  lands. If so it is a new token with its own write id, never a mutation.

### Reference — Hyvmind API shapes

The public read API now carries a revision, which is what caches key on.

`GET /api/graphs` → array of
`{ id, name, creator, creatorName, publishedAt, revision, nodeCount, edgeCount,
hierarchyEdgeCount, attributeCount, sourcesCount, extensions[], authorDetails[] }`,
plus `xyzWriteCount` (a count only).

`GET /api/graphs/{id}` → `{ curations[], swarms[], locations[], lawTokens[],
interpretationTokens[], edges[], revision }`.

`GET /api/nodes/{graphId}` → array of
`{ id, name, type, parentId?, content?, creator, createdAt, tags[]?,
attributes[{ key, weightedValues[{ value, weight }] }], sources[{ name, url }],
customAttributes? }`. `content` exists only on `interpEntity`. Bodies contain raw
control characters in `content` — strip Unicode category Cc before `JSON.parse`.
The response carries `x-hyvmind-revision` (exposed via CORS); `/api/edges` and
`/api/weights` carry the same header.

`GET /api/edges/{graphId}` → cross-reference edges only
`{ source, target, label, bidirectional }`.

`GET /api/weights/{graphId}` → `[{ nodeId, weight, graffiti[{ id, text, weight }] }]`,
resolved through the graph's **name**, and 404 for a graph with no voxel world.
This is graph weight, not xyz weight.

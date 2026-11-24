import List "mo:core/List";
import Map "mo:core/Map";
import Array "mo:core/Array";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Char "mo:core/Char";
import Int "mo:core/Int";
import Storage "mo:caffeineai-object-storage/Storage";
import MixinObjectStorage "mo:caffeineai-object-storage/Mixin";
import AccessControl "mo:caffeineai-authorization/access-control";
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";

actor {
  let accessControlState : AccessControl.AccessControlState;
  include MixinAuthorization(accessControlState, null);
  include MixinObjectStorage();

  type UserProfile = {
    username : Text;
    displayName : Text;
    bio : Text;
    profilePictureHash : ?Storage.ExternalBlob;
    headerImageHash : ?Storage.ExternalBlob;
    createdAt : Time.Time;
    updatedAt : Time.Time;
  };

  type PostType = {
    #original;
    #reply : Nat;
    #repost : Nat;
    #quote : Nat;
  };

  type Post = {
    id : Nat;
    author : Principal;
    text : Text;
    mediaHash : ?Storage.ExternalBlob;
    mediaType : ?Text;
    postType : PostType;
    createdAt : Time.Time;
    editedAt : ?Time.Time;
  };

  // A citation held in xyz. `nodeId` is the opaque id from /api/nodes: never
  // parsed, never synthesised. `path` is a display-only snapshot.
  type GraphRef = {
    graphId : Text;
    graphName : Text;
    nodeId : Text;
    nodeName : Text;
    nodeType : Text;
    path : Text;
    attachedAt : Time.Time;
    hiddenAt : ?Time.Time;   // reserved: xyz-local visibility, never sent to the app
    tokenNodeId : ?Text;     // reserved: app token id once a write publishes this post
  };

  // An inline cross-reference written as [[...]] in the post text. Narrower
  // than GraphRef: attachedAt/hiddenAt/tokenNodeId belong to the anchor only,
  // and `graphName` is not needed to link the node.
  type CitationRef = {
    graphId : Text;
    nodeId : Text;
    nodeName : Text;
    nodeType : Text;
    path : Text;
  };

  // Client-supplied half. Server sets attachedAt, hiddenAt and tokenNodeId.
  type GraphRefInput = {
    graphId : Text;
    graphName : Text;
    nodeId : Text;
    nodeName : Text;
    nodeType : Text;
    path : Text;
    // The enclosing swarm, captured from the same node read. Write permission
    // is scoped to that swarm's community; null means no swarm is known, and no
    // publish may pass the gate. Like every ref field this is shape-checked
    // only — a query cannot verify it.
    swarmNodeId : ?Text;
    swarmCreator : ?Principal;
    // Display name for the community, "Curation > Swarm", composed client-side
    // from the same node read.
    communityName : ?Text;
  };

  type SwarmCapture = {
    swarmNodeId : Text;
    swarmCreator : ?Principal;
    communityName : ?Text;
  };

  // ── Chains ──────────────────────────────────────────────────────────────────
  // A chain post creates 1-4 new ancestors below an existing curation, swarm or
  // location, or a whole new curation when `start` is null. The interpretation
  // token itself is still the post; the chain is the path to it. Names are
  // normalised server-side: trimmed, no '@', no control characters.

  type ChainLevelInput = {
    nodeType : Text;
    name : Text;
    tags : [Text];
    attributes : [(Text, [Text])];
    sources : [XyzSourceRef];
  };

  type ChainInput = {
    start : ?GraphRefInput;
    levels : [ChainLevelInput];
  };

  type ChainLevel = {
    nodeType : Text;
    name : Text;
    tags : [Text];
    attributes : [(Text, [Text])];
    sources : [XyzSourceRef];
  };

  type ChainSpec = {
    start : ?GraphRefInput;
    levels : [ChainLevel];
  };

  // What a feed actually needs: the path, not the metadata. Keeping attributes
  // and sources out of every response bounds a page of chain posts.
  type ChainLevelView = {
    nodeType : Text;
    name : Text;
  };

  type ChainView = {
    start : ?GraphRefInput;
    levels : [ChainLevelView];
  };

  type PostResponse = {
    id : Nat;
    author : Principal;
    authorUsername : Text;
    authorDisplayName : Text;
    authorProfilePictureHash : ?Storage.ExternalBlob;
    text : Text;
    mediaHash : ?Storage.ExternalBlob;
    mediaType : ?Text;
    postType : PostType;
    createdAt : Time.Time;
    editedAt : ?Time.Time;
    likeCount : Nat;
    replyCount : Nat;
    repostCount : Nat;
    isLikedByCurrentUser : Bool;
    isRepostedByCurrentUser : Bool;
    // Graph token fields. `graphRef` is null for regular posts.
    graphRef : ?GraphRef;
    // Present when this post declares new graph ancestors (a chain post).
    chain : ?ChainView;
    // Inline [[...]] cross-references, in text order. The anchor may also
    // appear here when the first inline ref was promoted to the anchor.
    citations : [CitationRef];
    // Feeds return a bounded preview of very long posts; the detail call does not.
    textTruncated : Bool;
    weight : ?Int;                    // xyz weight: 1 + likes + reposts - dislikes
    dislikeCount : Nat;
    isDislikedByCurrentUser : Bool;
    canEdit : Bool;
    canDelete : Bool;
  };

  type PaginatedGraphPosts = {
    posts : [PostResponse];
    nextCursor : ?Nat;
    hasMore : Bool;
    nodeWeight : Int;                 // sum over the node's tokens, floored at 0
    tokenCount : Nat;                 // every token on the node, replies included
    contributionCount : Nat;          // top-level tokens only
  };

  // ── Communities ─────────────────────────────────────────────────────────────
  // One community per swarm, named "Curation > Swarm". The swarm node id is the
  // exact key, so two swarms with the same name stay distinct. Membership is
  // xyz-local: the app has no follow graph and enforces no social rule, so this
  // is where a write permission actually comes from.

  type Community = {
    id : Text;                 // swarm node id
    graphId : Text;
    name : Text;
    creator : Principal;       // .app principal recorded by the write
    createdAt : Time.Time;
    memberCount : Nat;
    lastMessageAt : ?Time.Time;
  };

  type CommunityMember = { joinedAt : Time.Time };

  type CommunityInvite = {
    invitedBy : Principal;
    createdAt : Time.Time;
  };

  type CommunityView = {
    id : Text;
    graphId : Text;
    name : Text;
    creator : Principal;
    memberCount : Nat;
    isMember : Bool;
    isCreator : Bool;
    hasInvite : Bool;
    lastMessageAt : ?Time.Time;
  };

  type CommunityMessage = {
    id : Nat;
    communityId : Text;
    author : Principal;
    text : Text;
    createdAt : Time.Time;
  };

  type CommunityMessageView = {
    id : Nat;
    communityId : Text;
    author : Principal;
    authorUsername : Text;
    authorDisplayName : Text;
    text : Text;
    createdAt : Time.Time;
  };

  type PaginatedMessages = {
    messages : [CommunityMessageView];
    nextCursor : ?Nat;
    hasMore : Bool;
  };

  type CommunityMemberView = {
    principal : Principal;
    username : Text;
    displayName : Text;
    isCreator : Bool;
  };

  type GateDecision = {
    #allowed;
    #denied : { message : Text; reason : Text; communityName : ?Text };
  };

  // ── Principal link ──────────────────────────────────────────────────────────
  // One .xyz account per .app account. The pair is stored in both directions:
  // linkByXyz for acting on a user's behalf, appToXyz for attesting path
  // creators. Neither is ever client-writable.

  type AppLinkPreview = {
    appPrincipal : Principal;
    displayName : ?Text;
    expiresAt : Time.Time;
  };

  type LinkState = {
    appPrincipal : Principal;
    displayName : ?Text;
    linkedAt : Time.Time;
  };

  type LinkResult = { #ok : LinkState; #err : Text };

  // ── Hyvmind write channel (Phase 3) ─────────────────────────────────────────
  // Mirrors the app's contract. Argument types are complete because we encode
  // them; response types name only the fields we render, which Candid record
  // width-subtyping allows. Variants must be exhaustive: an undeclared tag is
  // a decode failure, not a graceful fallback.

  type XyzRef = { ref : Text; nodeType : ?Text };

  type XyzSourceRef = { name : Text; url : Text };

  type XyzPathNode = {
    ref : Text;
    nodeType : Text;
    name : Text;
    parentRef : ?XyzRef;
    tags : [Text];
    attributes : [(Text, [Text])];
    sources : [XyzSourceRef];
  };

  type XyzCitation = {
    target : XyzRef;
    edgeLabel : Text;
    bidirectional : Bool;
  };

  type XyzPostInput = {
    apiVersion : Nat;
    title : Text;
    content : Text;
    parentLaw : XyzRef;
    ancestors : [XyzPathNode];
    citations : [XyzCitation];
  };

  type XyzPathCreator = {
    appPrincipal : Principal;
    displayName : ?Text;
    linked : Bool;
  };

  type XyzPlan = {
    rootCuration : Text;
    publishedGraphId : ?Text;
    revision : Nat;
    creates : Nat;
    cost : Int;
    costText : Text;
    balance : Int;
    balanceText : Text;
    lines : [Text];
    pathCreators : [XyzPathCreator];
    digest : Text;
  };

  type XyzErrKind = { #malformed; #internal };

  type XyzCommitOk = {
    publishedGraphId : Text;
    revision : Nat;
    cost : Int;
    costText : Text;
    interpNodeId : Text;
    path : [Text];
    // Every node this write created, with its verbatim ref. The app returns it;
    // we name it here to find a newly created swarm by ref.
    nodes : [XyzCommitNode];
  };

  type XyzCommitNode = {
    ref : Text;
    nodeId : Text;
    path : [Text];
  };

  type XyzPreviewResult = {
    #ready : { message : Text; plan : XyzPlan };
    #insufficient : { message : Text; plan : XyzPlan; topUpPath : Text };
    #blocked : {
      message : Text;
      plan : XyzPlan;
      pathCreators : [XyzPathCreator];
      reason : Text;
    };
    #notLinked : { message : Text; writerXyz : Principal };
    #gate : { message : Text; reason : Text; communityName : ?Text };
    #throttled : { retryAfterMs : Nat };
    #err : { kind : XyzErrKind; message : Text };
  };

  // Our own outcome adds tags the app does not emit. Commit is never auto-
  // retried: a bounded-wait timeout does not cancel the callee, so an immediate
  // retry could race a still-running write. `#unknown` sends the user to
  // reconcile instead.
  //
  // `#gate` is ours too: xyz decides who may extend a swarm before it ever calls
  // the app, because the app no longer evaluates any social rule.
  type XyzCommitOutcome = {
    #ok : XyzCommitOk;
    #insufficient : { message : Text; plan : XyzPlan; topUpPath : Text };
    #blocked : {
      message : Text;
      plan : XyzPlan;
      pathCreators : [XyzPathCreator];
      reason : Text;
    };
    #gate : { message : Text; reason : Text; communityName : ?Text };
    #notLinked : { message : Text; writerXyz : Principal };
    #stale : { message : Text; plan : XyzPlan };
    #conflict : { message : Text };
    #err : { kind : XyzErrKind; message : Text };
    #busy : { message : Text };
    #unknown : { message : Text; writeId : Text };
    #notFound : { message : Text; writeId : Text };
    #alreadyPublished : { interpNodeId : Text };
  };

  // Everything the composer needs before spending a round trip.
  type XyzWriteDraft = {
    postId : Nat;
    writeId : Text;
    title : ?Text;
    nodeType : Text;
    costTenths : Nat;
    costText : Text;
    canPublish : Bool;
    reason : ?Text;
    tokenNodeId : ?Text;
    // Present when the local social gate would refuse this publish.
    gateReason : ?Text;
    // Machine-readable gate reason, so the client can offer a fix.
    gateCode : ?Text;
  };

  type PaginatedPosts = {
    posts : [PostResponse];
    nextCursor : ?Nat;
    hasMore : Bool;
  };

  type TrendingHashtag = {
    tag : Text;
    count : Nat;
  };

  type UserProfileResponse = {
    principal : Principal;
    username : Text;
    displayName : Text;
    bio : Text;
    profilePictureHash : ?Storage.ExternalBlob;
    headerImageHash : ?Storage.ExternalBlob;
    createdAt : Time.Time;
    updatedAt : Time.Time;
    followersCount : Nat;
    followingCount : Nat;
    postsCount : Nat;
    pinnedPostId : ?Nat;
    isFollowedByCurrentUser : Bool;
    isBlockedByCurrentUser : Bool;
    isMutedByCurrentUser : Bool;
  };

  type FollowUserResponse = {
    principal : Principal;
    username : Text;
    displayName : Text;
    profilePictureHash : ?Storage.ExternalBlob;
  };

  type PaginatedFollows = {
    users : [FollowUserResponse];
    nextOffset : ?Nat;
    hasMore : Bool;
  };

  type NotificationType = {
    #like : Nat;
    #reply : Nat;
    #mention : Nat;
    #follow;
    #repost : Nat;
    #quote : Nat;
    // Community id, as a swarm node id.
    #communityInvite : Text;
  };

  type Notification = {
    id : Nat;
    notificationType : NotificationType;
    actorPrincipal : Principal;
    actorUsername : Text;
    createdAt : Time.Time;
    isRead : Bool;
  };

  type PaginatedNotifications = {
    notifications : [Notification];
    nextCursor : ?Nat;
    hasMore : Bool;
  };

  let userProfiles : Map.Map<Principal, UserProfile>;
  let usernameToUser : Map.Map<Text, Principal>;
  let posts : Map.Map<Nat, Post>;
  let userPostCounts : Map.Map<Principal, Nat>;
  let pinnedPosts : Map.Map<Principal, Nat>;
  var nextPostId : Nat;
  let following : Map.Map<Principal, Map.Map<Principal, Bool>>;
  let followers : Map.Map<Principal, Map.Map<Principal, Bool>>;
  let blocks : Map.Map<Principal, Map.Map<Principal, Bool>>;
  let mutes : Map.Map<Principal, Map.Map<Principal, Bool>>;
  let postLikes : Map.Map<Nat, Map.Map<Principal, Bool>>;
  let postReplies : Map.Map<Nat, Map.Map<Nat, Bool>>;
  let postReposts : Map.Map<Nat, Map.Map<Principal, Bool>>;
  let repostIndex : Map.Map<Principal, Map.Map<Nat, Nat>>;
  let hashtagIndex : Map.Map<Text, Map.Map<Nat, Bool>>;
  let userNotifications : Map.Map<Principal, Map.Map<Nat, Notification>>;
  var nextNotificationId : Nat;

  // ── Graph tokens ────────────────────────────────────────────────────────────
  // Presence in postGraphRefs is what makes a post a graph post (a token).
  let postGraphRefs : Map.Map<Nat, GraphRef>;
  // Inline [[...]] cross-references, in the order the markers appear. These
  // are graph edges when the post is a token, and links otherwise.
  let postCitations : Map.Map<Nat, [CitationRef]>;
  // Chain posts declare their new ancestors here. Presence marks a token even
  // before it has a graphRef (a brand-new curation has no graph id yet).
  let postChains : Map.Map<Nat, ChainSpec>;
  // Total UTF-8 bytes of post text per account, so long posts stay bounded.
  let userTextBytes : Map.Map<Principal, Nat>;
  // graphId -> nodeId -> postId. Nested rather than a "graphId#nodeId" key,
  // because both ids are opaque text that can contain any separator.
  let graphNodePosts : Map.Map<Text, Map.Map<Text, Map.Map<Nat, Bool>>>;
  // Votes are weight only; deletion is decided from these counts.
  let postDislikes : Map.Map<Nat, Map.Map<Principal, Bool>>;

  // ── Principal link ──────────────────────────────────────────────────────────
  let linkByXyz : Map.Map<Principal, LinkState>;   // P_xyz -> linked .app account
  let appToXyz : Map.Map<Principal, Principal>;    // P_hv  -> P_xyz (attestation)

  // ── Communities ─────────────────────────────────────────────────────────────
  // Keyed by swarm node id, which the app resolves globally: ids are unique
  // across graphs, so no graph id is needed in the key.
  let communities : Map.Map<Text, Community>;
  let communityMembers : Map.Map<Text, Map.Map<Principal, CommunityMember>>;
  let memberCommunities : Map.Map<Principal, Map.Map<Text, Bool>>;
  let communityInvites : Map.Map<Text, Map.Map<Principal, CommunityInvite>>;
  let inviteIndex : Map.Map<Principal, Map.Map<Text, Bool>>;
  let communityMessages : Map.Map<Text, Map.Map<Nat, CommunityMessage>>;
  var nextCommunityMessageId : Nat;
  // The swarm a post's token hangs from, captured when the post is created.
  // Client-supplied, used only for the social write gate.
  let postSwarm : Map.Map<Nat, SwarmCapture>;

  transient let linkInFlight = Map.empty<Principal, Bool>();
  // One in-flight write per post. The app is idempotent on (writeId, digest)
  // but not concurrency-safe: two simultaneous commits can both pass its
  // "already written" check and both charge. This is the only thing that
  // guarantees a single charge per post.
  transient let writeInFlight = Map.empty<Nat, Bool>();

  transient let maxPostLength : Nat = 20_000;
  transient let maxChainName : Nat = 120;
  transient let maxChainLevels : Nat = 4;
  transient let maxInlineCitations : Nat = 8;
  transient let maxTextBytesPerUser : Nat = 20_000_000;
  // Feeds carry a bounded preview so a page of long posts cannot exceed the
  // 2 MB canister response limit. getPost returns the full body.
  transient let feedPreviewChars : Nat = 800;
  transient let editDeleteWindowNanos : Int = 900_000_000_000;
  transient let maxPostsPerUser : Nat = 10_000;
  transient let maxNotificationsPerUser : Nat = 50;
  transient let maxBranchPosts : Nat = 500;

  // Communities. The invite tree would grow exponentially without a ceiling,
  // and a community is a vouch pool for write permission, so it stays small.
  transient let maxCommunityMembers : Nat = 150;
  transient let maxCommunityInvites : Nat = 50;
  transient let maxOutstandingInvitesPerMember : Nat = 2;
  transient let maxMessageLength : Nat = 2_000;
  transient let maxMessagesPerCommunity : Nat = 5_000;
  transient let communityNameMax : Nat = 220;

  func validateMedia(mediaHash : ?Storage.ExternalBlob, mediaType : ?Text) {
    switch (mediaHash, mediaType) {
      case (null, null) {};
      case (?_, ?"image") {};
      case (?_, ?"video") {};
      case (null, ?_) { Runtime.trap("mediaType requires mediaHash") };
      case (?_, null) { Runtime.trap("mediaHash requires mediaType") };
      case (?_, ?_) { Runtime.trap("mediaType must be \"image\" or \"video\"") };
    };
  };

  func requirePostCapNotReached(caller : Principal) {
    let count = switch (userPostCounts.get(caller)) {
      case (?n) { n };
      case (null) { 0 };
    };
    if (count >= maxPostsPerUser) {
      Runtime.trap("Post limit reached (" # maxPostsPerUser.toText() # " posts max)");
    };
  };

  func requireAuth(caller : Principal) {
    if (caller.isAnonymous()) {
      Runtime.trap("Not authenticated");
    };
  };

  func toLower(t : Text) : Text {
    t.map(
      func(c) {
        let code = c.toNat32();
        if (code >= 65 and code <= 90) {
          Char.fromNat32(code + 32);
        } else {
          c;
        };
      }
    );
  };

  func isValidUsername(username : Text) : Bool {
    let size = username.size();
    if (size < 3 or size > 20) { return false };
    for (c in username.chars()) {
      let code = c.toNat32();
      let isLower = code >= 97 and code <= 122;
      let isUpper = code >= 65 and code <= 90;
      let isDigit = code >= 48 and code <= 57;
      let isUnderscore = code == 95;
      if (not isLower and not isUpper and not isDigit and not isUnderscore) {
        return false;
      };
    };
    true;
  };

  func getMap<V>(store : Map.Map<Principal, Map.Map<Nat, V>>, user : Principal) : Map.Map<Nat, V> {
    switch (store.get(user)) {
      case (?m) { m };
      case (null) {
        let m = Map.empty<Nat, V>();
        store.add(user, m);
        m;
      };
    };
  };

  func getPrincipalMap(store : Map.Map<Principal, Map.Map<Principal, Bool>>, key : Principal) : Map.Map<Principal, Bool> {
    switch (store.get(key)) {
      case (?m) { m };
      case (null) {
        let m = Map.empty<Principal, Bool>();
        store.add(key, m);
        m;
      };
    };
  };

  func incrementPostCount(user : Principal) {
    let current = switch (userPostCounts.get(user)) {
      case (?n) { n };
      case (null) { 0 };
    };
    userPostCounts.add(user, current + 1);
  };

  func decrementPostCount(user : Principal) {
    let current : Int = switch (userPostCounts.get(user)) {
      case (?n) { n };
      case (null) { 0 };
    };
    if (current > 0) {
      userPostCounts.add(user, Int.abs(current - 1));
    };
  };

  func getNatPrincipalMap(store : Map.Map<Nat, Map.Map<Principal, Bool>>, key : Nat) : Map.Map<Principal, Bool> {
    switch (store.get(key)) {
      case (?m) { m };
      case (null) {
        let m = Map.empty<Principal, Bool>();
        store.add(key, m);
        m;
      };
    };
  };

  func getPostReplies(postId : Nat) : Map.Map<Nat, Bool> {
    switch (postReplies.get(postId)) {
      case (?m) { m };
      case (null) {
        let m = Map.empty<Nat, Bool>();
        postReplies.add(postId, m);
        m;
      };
    };
  };

  func getHashtagPosts(tag : Text) : Map.Map<Nat, Bool> {
    switch (hashtagIndex.get(tag)) {
      case (?m) { m };
      case (null) {
        let m = Map.empty<Nat, Bool>();
        hashtagIndex.add(tag, m);
        m;
      };
    };
  };

  func isTokenChar(c : Char) : Bool {
    let code = c.toNat32();
    (code >= 97 and code <= 122) or (code >= 65 and code <= 90) or (code >= 48 and code <= 57) or code == 95;
  };

  func extractTokens(text : Text, triggerChar : Char) : [Text] {
    let tokens = List.empty<Text>();
    let seen = Map.empty<Text, Bool>();
    var current = "";
    var inToken = false;

    for (c in text.chars()) {
      if (inToken) {
        if (isTokenChar(c)) {
          current #= c.toText();
        } else {
          if (current != "" and tokens.size() < 10) {
            let lower = toLower(current);
            if (seen.get(lower) == null) {
              tokens.add(lower);
              seen.add(lower, true);
            };
          };
          current := "";
          inToken := false;
          if (c == triggerChar) { inToken := true };
        };
      } else if (c == triggerChar) {
        inToken := true;
      };
    };
    if (inToken and current != "" and tokens.size() < 10) {
      let lower = toLower(current);
      if (seen.get(lower) == null) {
        tokens.add(lower);
        seen.add(lower, true);
      };
    };
    tokens.toArray();
  };

  func indexPostHashtags(postId : Nat, text : Text) {
    for (tag in extractTokens(text, '#').values()) {
      getHashtagPosts(tag).add(postId, true);
    };
  };

  func removePostHashtags(postId : Nat, text : Text) {
    for (tag in extractTokens(text, '#').values()) {
      switch (hashtagIndex.get(tag)) {
        case (?m) { m.remove(postId) };
        case (null) {};
      };
    };
  };

  // ── Graph token helpers ─────────────────────────────────────────────────────

  func isKnownNodeType(t : Text) : Bool {
    t == "curation" or t == "swarm" or t == "location" or t == "lawEntity" or t == "interpEntity";
  };

  // Shape-only validation: an xyz query cannot reach the app to confirm a node
  // exists. The ref is permanent and echoed in every response, so every field is
  // bounded.
  func validateGraphRef(ref : GraphRefInput) {
    if (not ref.graphId.startsWith(#text "published-")) {
      Runtime.trap("graphId must be a published graph id");
    };
    if (ref.graphId.size() > 120) { Runtime.trap("graphId too long") };
    if (ref.nodeId.size() == 0 or ref.nodeId.size() > 600) {
      Runtime.trap("nodeId length out of range");
    };
    if (ref.graphName.size() > 200) { Runtime.trap("graphName too long") };
    if (ref.nodeName.size() > 300) { Runtime.trap("nodeName too long") };
    if (ref.path.size() > 600) { Runtime.trap("path too long") };
    if (not isKnownNodeType(ref.nodeType)) { Runtime.trap("Unknown nodeType") };
    switch (ref.swarmNodeId) {
      case (?id) {
        if (id.size() == 0 or id.size() > 600) {
          Runtime.trap("swarmNodeId length out of range");
        };
      };
      case (null) {};
    };
    switch (ref.swarmCreator) {
      case (?p) {
        if (p.isAnonymous()) { Runtime.trap("Invalid swarm creator") };
      };
      case (null) {};
    };
    switch (ref.communityName) {
      case (?n) {
        if (n.size() > 400) { Runtime.trap("communityName too long") };
      };
      case (null) {};
    };
  };

  // Inline refs are body metadata, not the anchor: they still need the same
  // opaque-id and length checks, and only tokens can be cross-referenced.
  func validateCitations(refs : [GraphRefInput]) {
    if (refs.size() > maxInlineCitations) {
      Runtime.trap("Too many cross-references (" # maxInlineCitations.toText() # " max)");
    };
    for (ref in refs.values()) {
      validateGraphRef(ref);
      if (not isCitableType(ref.nodeType)) {
        Runtime.trap("Only law tokens and interpretations can be cross-referenced");
      };
    };
  };

  func normalizeCitations(refs : [GraphRefInput]) : [CitationRef] {
    refs.map(
      func(ref : GraphRefInput) : CitationRef {
        {
          graphId = ref.graphId;
          nodeId = ref.nodeId;
          nodeName = ref.nodeName;
          nodeType = ref.nodeType;
          path = ref.path;
        };
      }
    );
  };

  func citationBytes(c : CitationRef) : Nat {
    c.graphId.size() + c.nodeId.size() + c.nodeName.size() + c.nodeType.size() + c.path.size();
  };

  func citationsBytes(cs : [CitationRef]) : Nat {
    var total = 0;
    for (c in cs.values()) { total += citationBytes(c) };
    total;
  };

  func citationsOf(postId : Nat) : [CitationRef] {
    switch (postCitations.get(postId)) {
      case (?c) { c };
      case (null) { [] };
    };
  };

  func getGraphNodeMap(graphId : Text, nodeId : Text) : Map.Map<Nat, Bool> {
    let byNode = switch (graphNodePosts.get(graphId)) {
      case (?m) { m };
      case (null) {
        let m = Map.empty<Text, Map.Map<Nat, Bool>>();
        graphNodePosts.add(graphId, m);
        m;
      };
    };
    switch (byNode.get(nodeId)) {
      case (?m) { m };
      case (null) {
        let m = Map.empty<Nat, Bool>();
        byNode.add(nodeId, m);
        m;
      };
    };
  };

  func removeGraphNodePost(graphId : Text, nodeId : Text, postId : Nat) {
    switch (graphNodePosts.get(graphId)) {
      case (?byNode) {
        switch (byNode.get(nodeId)) {
          case (?m) { m.remove(postId) };
          case (null) {};
        };
      };
      case (null) {};
    };
  };

  func isGraphPost(postId : Nat) : Bool {
    switch (postGraphRefs.get(postId)) {
      case (?_) { true };
      case (null) { false };
    };
  };

  func isChainPost(postId : Nat) : Bool {
    switch (postChains.get(postId)) {
      case (?_) { true };
      case (null) { false };
    };
  };

  // A token is either a citation of an existing node or a chain that will
  // create its own node when published.
  func isTokenPost(postId : Nat) : Bool {
    isGraphPost(postId) or isChainPost(postId);
  };

  // A reply or quote inherits the parent's node. A chain post has no node until
  // it is published, so children must wait for that.
  func requireChainPublishedForChild(parentPostId : Nat) {
    switch (postChains.get(parentPostId)) {
      case (null) {};
      case (?_) {
        let published = switch (postGraphRefs.get(parentPostId)) {
          case (?ref) { ref.tokenNodeId != null };
          case (null) { false };
        };
        if (not published) {
          Runtime.trap("Publish this chain before replying to or quoting it");
        };
      };
    };
  };

  // ── Text bounds ─────────────────────────────────────────────────────────────

  func textBytes(t : Text) : Nat {
    t.encodeUtf8().size();
  };

  func requireTextQuota(caller : Principal, delta : Nat) {
    let used = switch (userTextBytes.get(caller)) {
      case (?n) { n };
      case (null) { 0 };
    };
    if (delta > maxTextBytesPerUser or used + delta > maxTextBytesPerUser) {
      Runtime.trap("This account's text storage is full. Delete older posts to free space.");
    };
  };

  func addTextBytes(caller : Principal, delta : Nat) {
    if (delta == 0) { return };
    let used = switch (userTextBytes.get(caller)) {
      case (?n) { n };
      case (null) { 0 };
    };
    userTextBytes.add(caller, used + delta);
  };

  func removeTextBytes(caller : Principal, delta : Nat) {
    if (delta == 0) { return };
    let used = switch (userTextBytes.get(caller)) {
      case (?n) { n };
      case (null) { 0 };
    };
    let next = if (delta >= used) { 0 } else { used - delta };
    userTextBytes.add(caller, next);
  };

  func truncateChars(t : Text, max : Nat) : Text {
    if (t.size() <= max) { return t };
    Text.fromArray(t.toArray().sliceToArray(0, max));
  };

  func joinPath(parts : [Text]) : Text {
    var out = "";
    var index = 0;
    for (part in parts.values()) {
      if (index > 0) { out #= " › " };
      out #= part;
      index += 1;
    };
    out;
  };

  // Feeds return a bounded preview; the detail view returns the full body.
  func previewText(t : Text) : (Text, Bool) {
    if (t.size() <= feedPreviewChars) { (t, false) } else {
      (truncateChars(t, feedPreviewChars), true);
    };
  };

  // ── Chain validation ────────────────────────────────────────────────────────

  func normalizeChainName(name : Text) : Text {
    let t = name.trim(#char ' ');
    if (t.size() == 0 or t.size() > maxChainName) {
      Runtime.trap("Each new node needs a name of 1-" # maxChainName.toText() # " characters");
    };
    if (t.contains(#text "@")) { Runtime.trap("Names cannot contain '@'") };
    if (t.contains(#text "›")) { Runtime.trap("Names cannot contain '›'") };
    for (c in t.toArray().values()) {
      if (c.toNat32() < 32) { Runtime.trap("Names cannot contain control characters") };
    };
    t;
  };

  func normalizeTag(tag : Text) : ?Text {
    let t = tag.trim(#char ' ');
    if (t.size() == 0) { return null };
    if (t.size() > 50 or t.contains(#text "@") or t.contains(#text "›")) {
      Runtime.trap("Tags must be 1-50 characters and cannot contain '@' or '›'");
    };
    for (c in t.toArray().values()) {
      if (c.toNat32() < 32) { Runtime.trap("Tags cannot contain control characters") };
    };
    ?t;
  };

  func normalizeAttributes(input : [(Text, [Text])]) : [(Text, [Text])] {
    if (input.size() > 20) { Runtime.trap("At most 20 attributes per node") };
    let out = List.empty<(Text, [Text])>();
    for ((key, values) in input.values()) {
      let k = key.trim(#char ' ');
      if (k.size() == 0 or k.size() > 100) {
        Runtime.trap("Attribute keys must be 1-100 characters");
      };
      if (k.contains(#text "@") or k.contains(#text "›")) {
        Runtime.trap("Attribute keys cannot contain '@' or '›'");
      };
      var count = 0;
      let cleaned = List.empty<Text>();
      for (v in values.values()) {
        let t = v.trim(#char ' ');
        if (t.size() > 0) {
          if (t.size() > 200) { Runtime.trap("Attribute values must be 200 characters or fewer") };
          cleaned.add(t);
          count += 1;
        };
      };
      if (count > 20) { Runtime.trap("At most 20 values per attribute") };
      out.add((k, cleaned.toArray()));
    };
    out.toArray();
  };

  func normalizeSources(input : [XyzSourceRef]) : [XyzSourceRef] {
    if (input.size() > 20) { Runtime.trap("At most 20 sources per node") };
    input.map(
      func(s : XyzSourceRef) : XyzSourceRef {
        let name = s.name.trim(#char ' ');
        let url = s.url.trim(#char ' ');
        if (name.size() == 0 or name.size() > 200) { Runtime.trap("Source names must be 1-200 characters") };
        if (url.size() == 0 or url.size() > 500) { Runtime.trap("Source URLs must be 1-500 characters") };
        { name; url };
      }
    );
  };

  func validateChain(input : ChainInput) : ChainSpec {
    let start = input.start;
    let startType = switch (start) {
      case (null) { "" };
      case (?s) {
        validateGraphRef(s);
        if (not isKnownNodeType(s.nodeType)) { Runtime.trap("Unknown start node type") };
        s.nodeType;
      };
    };
    let expected : [Text] = switch (startType) {
      case ("") { ["curation", "swarm", "location", "lawEntity"] };
      case ("curation") { ["swarm", "location", "lawEntity"] };
      case ("swarm") { ["location", "lawEntity"] };
      case ("location") { ["lawEntity"] };
      case (_) {
        Runtime.trap("A chain starts from a curation, swarm or location, or from a new graph");
      };
    };
    if (input.levels.size() > maxChainLevels) {
      Runtime.trap("A chain has at most " # maxChainLevels.toText() # " new levels");
    };
    if (input.levels.size() != expected.size()) {
      Runtime.trap("This chain needs " # expected.size().toText() # " new level(s)");
    };
    let levels = List.empty<ChainLevel>();
    var index = 0;
    for (level in input.levels.values()) {
      if (level.nodeType != expected[index]) {
        Runtime.trap("Invalid chain level: expected " # expected[index]);
      };
      var tags : [Text] = [];
      if (level.nodeType == "swarm") {
        if (level.tags.size() > 10) { Runtime.trap("At most 10 tags per swarm") };
        let collected = List.empty<Text>();
        for (tag in level.tags.values()) {
          switch (normalizeTag(tag)) {
            case (?t) { collected.add(t) };
            case (null) {};
          };
        };
        tags := collected.toArray();
      } else if (level.tags.size() > 0) {
        Runtime.trap("Tags are only allowed on swarms");
      };
      levels.add({
        nodeType = level.nodeType;
        name = normalizeChainName(level.name);
        tags;
        attributes = normalizeAttributes(level.attributes);
        sources = normalizeSources(level.sources);
      });
      index += 1;
    };
    { start; levels = levels.toArray() };
  };

  func chainNodeCost(t : Text) : Nat {
    switch (t) {
      case ("curation") { 10 };
      case ("swarm") { 20 };
      case ("location") { 30 };
      case ("lawEntity") { 40 };
      case (_) { 0 };
    };
  };

  // The app charges the token (50 tenths) plus every newly created ancestor.
  func chainCost(spec : ChainSpec) : Nat {
    var cost = 50;
    for (level in spec.levels.values()) {
      cost += chainNodeCost(level.nodeType);
    };
    cost;
  };

  // A reply or a quote of a token becomes a token on the same node.
  func inheritGraphRef(parentPostId : Nat, childId : Nat) {
    switch (postGraphRefs.get(parentPostId)) {
      case (null) {};
      case (?ref) {
        let child : GraphRef = {
          graphId = ref.graphId;
          graphName = ref.graphName;
          nodeId = ref.nodeId;
          nodeName = ref.nodeName;
          nodeType = ref.nodeType;
          path = ref.path;
          attachedAt = Time.now();
          hiddenAt = null;
          tokenNodeId = null;
        };
        postGraphRefs.add(childId, child);
        getGraphNodeMap(ref.graphId, ref.nodeId).add(childId, true);
      };
    };
    // A reply inherits the token's swarm, so the gate applies to it as well.
    switch (postSwarm.get(parentPostId)) {
      case (?s) { postSwarm.add(childId, s) };
      case (null) {};
    };
  };

  // xyz weight of one token: 1 + likes + reposts - dislikes.
  func postVoteWeight(postId : Nat) : Int {
    let likes = switch (postLikes.get(postId)) {
      case (?m) { m.size() };
      case (null) { 0 };
    };
    let dislikes = switch (postDislikes.get(postId)) {
      case (?m) { m.size() };
      case (null) { 0 };
    };
    let reposts = switch (postReposts.get(postId)) {
      case (?m) { m.size() };
      case (null) { 0 };
    };
    1 + likes.toInt() + reposts.toInt() - dislikes.toInt();
  };

  func shouldDeleteOnVote(postId : Nat) : Bool {
    let likes = switch (postLikes.get(postId)) {
      case (?m) { m.size() };
      case (null) { 0 };
    };
    let dislikes = switch (postDislikes.get(postId)) {
      case (?m) { m.size() };
      case (null) { 0 };
    };
    dislikes > likes and dislikes >= 3;
  };

  // Collects the reply subtree plus any reposts of its members. Returns null
  // when the branch exceeds the budget, in which case nothing is deleted.
  func gatherBranch(root : Nat) : ?[Nat] {
    let ids = List.empty<Nat>();
    let seen = Map.empty<Nat, Bool>();
    ids.add(root);
    seen.add(root, true);
    var i = 0;
    while (i < ids.size()) {
      let id = ids.at(i);
      i += 1;
      switch (postReplies.get(id)) {
        case (?m) {
          for ((child, _) in m.entries()) {
            if (seen.get(child) == null) {
              seen.add(child, true);
              ids.add(child);
            };
          };
        };
        case (null) {};
      };
      switch (postReposts.get(id)) {
        case (?reposters) {
          for ((p, _) in reposters.entries()) {
            switch (repostIndex.get(p)) {
              case (?userReposts) {
                switch (userReposts.get(id)) {
                  case (?repostId) {
                    if (seen.get(repostId) == null) {
                      seen.add(repostId, true);
                      ids.add(repostId);
                    };
                  };
                  case (null) {};
                };
              };
              case (null) {};
            };
          };
        };
        case (null) {};
      };
      if (ids.size() > maxBranchPosts) { return null };
    };
    ?ids.toArray();
  };

  func branchHasToken(ids : [Nat]) : Bool {
    for (id in ids.values()) {
      // A write in flight is treated like a published token: the branch must
      // survive until the commit resolves, or we would mark a purged post.
      if (writeInFlight.get(id) != null) { return true };
      switch (postGraphRefs.get(id)) {
        case (?ref) {
          switch (ref.tokenNodeId) {
            case (?_) { return true };
            case (null) {};
          };
        };
        case (null) {};
      };
    };
    false;
  };

  func purgePost(id : Nat) {
    switch (posts.get(id)) {
      case (?p) {
        posts.remove(id);
        decrementPostCount(p.author);
        let citations = citationsOf(id);
        removeTextBytes(p.author, textBytes(p.text) + citationsBytes(citations));
        postCitations.remove(id);
        removePostHashtags(id, p.text);
        switch (p.postType) {
          case (#reply(parentId)) {
            switch (postReplies.get(parentId)) {
              case (?m) { m.remove(id) };
              case (null) {};
            };
          };
          case (#repost(originalId)) {
            switch (postReposts.get(originalId)) {
              case (?m) { m.remove(p.author) };
              case (null) {};
            };
            switch (repostIndex.get(p.author)) {
              case (?m) { m.remove(originalId) };
              case (null) {};
            };
          };
          case (_) {};
        };
      };
      case (null) {};
    };
    postReplies.remove(id);
    postLikes.remove(id);
    postDislikes.remove(id);
    postReposts.remove(id);
    switch (postGraphRefs.get(id)) {
      case (?ref) {
        removeGraphNodePost(ref.graphId, ref.nodeId, id);
        postGraphRefs.remove(id);
      };
      case (null) {};
    };
    postChains.remove(id);
    postSwarm.remove(id);
  };

  // Vote-deletes a token and its branch, unless the branch contains a token
  // already published to the app: those are permanent, and pin everything
  // beneath them.
  func maybeDeleteBranch(postId : Nat) {
    if (not isTokenPost(postId)) { return };
    if (not shouldDeleteOnVote(postId)) { return };
    switch (gatherBranch(postId)) {
      case (null) {};
      case (?ids) {
        if (not branchHasToken(ids)) {
          for (id in ids.values()) { purgePost(id) };
        };
      };
    };
  };

  func requireNotSelfVote(post : Post, voter : Principal) {
    if (isGraphPost(post.id) and post.author == voter) {
      Runtime.trap("Cannot vote on your own contribution");
    };
  };

  // ── Hyvmind app link client ─────────────────────────────────────────────────
  // The app canister id is a compile-time constant: it is stable per Caffeine
  // project and any change is a redeploy on our side, so no admin surface.

  transient let appBackendText : Text = "4p5ty-yyaaa-aaaam-qfana-cai";

  type AppLinkApi = actor {
    resolveLinkCode : (Text) -> async ?{
      appPrincipal : Principal;
      displayName : ?Text;
      expiresAt : Time.Time;
    };
    confirmLink : (Text, Principal) -> async { #ok : Principal; #err : Text };
    revokeLinkAsXyz : (Principal) -> async { #ok; #err : Text };
    getLinkForXyz : (Principal) -> async ?Principal;
  };

  func appLink() : AppLinkApi = actor (appBackendText);

  // Bounded wait: an unresponsive callee must not block our upgrades.
  // `with timeout` takes seconds as Nat32.
  transient let linkCallTimeout : Nat32 = 30;

  func normalizeLinkCode(code : Text) : Text {
    code.replace(#text "-", "").replace(#text " ", "");
  };

  func acquireLinkLock(p : Principal) : Bool {
    switch (linkInFlight.get(p)) {
      case (?true) { false };
      case (_) { linkInFlight.add(p, true); true };
    };
  };

  func releaseLinkLock(p : Principal) {
    linkInFlight.remove(p);
  };

  // ── Hyvmind write client ────────────────────────────────────────────────────

  type AppWriteApi = actor {
    previewXyzWrite : (
      Principal,
      Text,
      [Principal],
      XyzPostInput,
    ) -> async XyzPreviewResult;
    commitXyzWrite : (
      Principal,
      Text,
      Text,
      [Principal],
      XyzPostInput,
    ) -> async XyzCommitOutcome;
    getXyzWrite : (Principal, Text) -> async ?XyzCommitOk;
    getXyzBuzzBalance : (Principal) -> async ?{ units : Int; text : Text };
    // Only the field we need; Candid record width-subtyping makes the rest of
    // GraphData irrelevant. The largest published graph is ~37 KB of JSON.
    getPublishedSourceGraph : (Text) -> async ?{
      interpretationTokens : [{ id : Text; parentLawTokenId : Text }];
    };
  };

  func appWrite() : AppWriteApi = actor (appBackendText);

  // Seconds, as Nat32. A commit applies the whole write in one message, so
  // this is generous rather than tight.
  transient let writeReadTimeout : Nat32 = 30;
  transient let writePreviewTimeout : Nat32 = 30;
  transient let writeCommitTimeout : Nat32 = 60;

  transient let maxMutualFollows : Nat = 500;   // the app's cap

  func acquireWriteLock(postId : Nat) : Bool {
    switch (writeInFlight.get(postId)) {
      case (?true) { false };
      case (_) { writeInFlight.add(postId, true); true };
    };
  };

  func releaseWriteLock(postId : Nat) {
    writeInFlight.remove(postId);
  };

  // xyz principals the writer mutually follows. The app maps these through its
  // own xyz->app link table and drops the rest.
  func mutualFollowsOf(p : Principal) : [Principal] {
    let out = List.empty<Principal>();
    let f = switch (following.get(p)) {
      case (?m) { m };
      case (null) { return [] };
    };
    let g = switch (followers.get(p)) {
      case (?m) { m };
      case (null) { return [] };
    };
    for ((q, _) in f.entries()) {
      if (out.size() >= maxMutualFollows) { return out.toArray() };
      if (g.get(q) != null) { out.add(q) };
    };
    out.toArray();
  };

  // ── Communities (swarm-scoped write permission) ─────────────────────────────
  // The app enforces structure only, so every social precondition for a write is
  // decided here. A token may be published under a swarm when the writer is a
  // member of that swarm's community, or a mutual of any current member. A swarm
  // with no community yet falls back to its creator: the writer must be a mutual
  // of the creator's linked xyz account, and the community is created with that
  // creator as member #1. A swarm whose creator never linked is closed — there
  // is nobody who could consent.

  func follows(a : Principal, b : Principal) : Bool {
    switch (following.get(a)) {
      case (?m) { m.get(b) != null };
      case (null) { false };
    };
  };

  func mutualFollow(a : Principal, b : Principal) : Bool {
    if (Principal.equal(a, b)) { return true };
    follows(a, b) and follows(b, a);
  };

  func isCommunityMember(communityId : Text, p : Principal) : Bool {
    switch (communityMembers.get(communityId)) {
      case (?m) { m.get(p) != null };
      case (null) { false };
    };
  };

  func getCommunityMemberMap(communityId : Text) : Map.Map<Principal, CommunityMember> {
    switch (communityMembers.get(communityId)) {
      case (?m) { m };
      case (null) {
        let m = Map.empty<Principal, CommunityMember>();
        communityMembers.add(communityId, m);
        m;
      };
    };
  };

  func getCommunityInviteMap(communityId : Text) : Map.Map<Principal, CommunityInvite> {
    switch (communityInvites.get(communityId)) {
      case (?m) { m };
      case (null) {
        let m = Map.empty<Principal, CommunityInvite>();
        communityInvites.add(communityId, m);
        m;
      };
    };
  };

  func getCommunityMessageMap(communityId : Text) : Map.Map<Nat, CommunityMessage> {
    switch (communityMessages.get(communityId)) {
      case (?m) { m };
      case (null) {
        let m = Map.empty<Nat, CommunityMessage>();
        communityMessages.add(communityId, m);
        m;
      };
    };
  };

  func getMemberIndex(p : Principal) : Map.Map<Text, Bool> {
    switch (memberCommunities.get(p)) {
      case (?m) { m };
      case (null) {
        let m = Map.empty<Text, Bool>();
        memberCommunities.add(p, m);
        m;
      };
    };
  };

  func getInviteIndex(p : Principal) : Map.Map<Text, Bool> {
    switch (inviteIndex.get(p)) {
      case (?m) { m };
      case (null) {
        let m = Map.empty<Text, Bool>();
        inviteIndex.add(p, m);
        m;
      };
    };
  };

  func communityNameOf(curationName : Text, swarmName : Text) : Text {
    let c = normalizeSpaces(curationName);
    let s = normalizeSpaces(swarmName);
    let joined = if (c.size() == 0) { s } else { c # " > " # s };
    truncateChars(joined, communityNameMax);
  };

  func communityViewOf(c : Community, caller : Principal) : CommunityView {
    {
      id = c.id;
      graphId = c.graphId;
      name = c.name;
      creator = c.creator;
      memberCount = c.memberCount;
      isMember = isCommunityMember(c.id, caller);
      isCreator = Principal.equal(c.creator, caller);
      hasInvite = switch (communityInvites.get(c.id)) {
        case (?m) { m.get(caller) != null };
        case (null) { false };
      };
      lastMessageAt = c.lastMessageAt;
    };
  };

  // The swarm a post's token hangs from. A chain that creates a swarm is
  // trivially allowed: its writer becomes member #1 when the write lands.
  func swarmSubject(postId : Nat) : {
    #creates;
    #existing : SwarmCapture;
    #unknown;
  } {
    switch (postChains.get(postId)) {
      case (?spec) {
        for (level in spec.levels.values()) {
          if (level.nodeType == "swarm") { return #creates };
        };
        switch (spec.start) {
          case (?start) {
            switch (start.swarmNodeId) {
              case (?id) {
                return #existing({
                  swarmNodeId = id;
                  swarmCreator = start.swarmCreator;
                  communityName = start.communityName;
                });
              };
              case (null) {};
            };
          };
          case (null) {};
        };
        return #unknown;
      };
      case (null) {};
    };
    switch (postSwarm.get(postId)) {
      case (?s) { #existing(s) };
      case (null) { #unknown };
    };
  };

  func writeGateFor(postId : Nat, writer : Principal) : GateDecision {
    switch (swarmSubject(postId)) {
      case (#creates) { #allowed };
      case (#unknown) {
        #denied({
          message = "This post has no enclosing swarm, so its write permission cannot be checked.";
          reason = "noSwarm";
          communityName = null;
        });
      };
      case (#existing(s)) {
        switch (communities.get(s.swarmNodeId)) {
          case (?c) {
            if (isCommunityMember(c.id, writer)) { return #allowed };
            switch (communityMembers.get(c.id)) {
              case (?members) {
                for ((m, _) in members.entries()) {
                  if (mutualFollow(writer, m)) { return #allowed };
                };
              };
              case (null) {};
            };
            #denied({
              message = "Publishing under " # c.name # " needs an invite from a member, or a mutual follow with one of them.";
              reason = "notVouched";
              communityName = ?c.name;
            });
          };
          case (null) {
            let creator = switch (s.swarmCreator) {
              case (?p) { p };
              case (null) {
                return #denied({
                  message = "This swarm has no community yet.";
                  reason = "noCommunity";
                  communityName = s.communityName;
                });
              };
            };
            switch (appToXyz.get(creator)) {
              case (null) {
                #denied({
                  message = "This swarm has no community yet, and its creator has not linked a hyvmind.app account.";
                  reason = "creatorUnlinked";
                  communityName = s.communityName;
                });
              };
              case (?creatorXyz) {
                if (mutualFollow(writer, creatorXyz)) { #allowed } else {
                  #denied({
                    message = "This swarm has no community yet. Ask its creator to link or publish into it first.";
                    reason = "notVouched";
                    communityName = s.communityName;
                  });
                };
              };
            };
          };
        };
      };
    };
  };

  func addCommunityMember(c : Community, p : Principal) : Community {
    if (isCommunityMember(c.id, p)) { return c };
    getCommunityMemberMap(c.id).add(p, { joinedAt = Time.now() });
    getMemberIndex(p).add(c.id, true);
    let inv = getCommunityInviteMap(c.id);
    if (inv.get(p) != null) {
      inv.remove(p);
      getInviteIndex(p).remove(c.id);
    };
    let updated : Community = { c with memberCount = c.memberCount + 1 };
    communities.add(c.id, updated);
    updated;
  };

  func ensureCommunity(
    swarmId : Text,
    graphId : Text,
    name : Text,
    creator : Principal,
    firstMember : Principal,
  ) : Community {
    switch (communities.get(swarmId)) {
      case (?c) { return c };
      case (null) {};
    };
    let created : Community = {
      id = swarmId;
      graphId;
      name = communityNameOf("", if (name.size() == 0) { "Swarm" } else { name });
      creator;
      createdAt = Time.now();
      memberCount = 0;
      lastMessageAt = null;
    };
    communities.add(swarmId, created);
    addCommunityMember(created, firstMember);
  };

  // Called once a write has landed. A created swarm mints its community with
  // the writer as member #1; a citation into a community-less swarm mints it
  // with that swarm's creator as member #1, which is what makes the chat appear
  // as soon as the creator links.
  func settleCommunity(postId : Nat, writerXyz : Principal, ref : ?GraphRef, ok : XyzCommitOk) {
    let writerApp = switch (linkByXyz.get(writerXyz)) {
      case (?s) { s.appPrincipal };
      case (null) { return };
    };
    switch (postChains.get(postId)) {
      case (?spec) {
        var index = 0;
        for (level in spec.levels.values()) {
          if (level.nodeType == "swarm") {
            let refText = "xyz:" # index.toText();
            switch (ok.nodes.find(func(n : XyzCommitNode) : Bool { n.ref == refText })) {
              case (?n) {
                let curation = if (n.path.size() > 1) { n.path[0] } else { "" };
                ignore ensureCommunity(
                  n.nodeId,
                  ok.publishedGraphId,
                  communityNameOf(curation, level.name),
                  writerApp,
                  writerXyz,
                );
              };
              case (null) {};
            };
          };
          index += 1;
        };
      };
      case (null) {};
    };
    switch (postSwarm.get(postId)) {
      case (?s) {
        switch (communities.get(s.swarmNodeId)) {
          case (?_) {};
          case (null) {
            let creator = switch (s.swarmCreator) {
              case (?p) { p };
              case (null) { return };
            };
            let firstMember = switch (appToXyz.get(creator)) {
              case (?p) { p };
              case (null) { return };
            };
            let graphId = switch (ref) {
              case (?r) { r.graphId };
              case (null) { ok.publishedGraphId };
            };
            let name = switch (s.communityName) {
              case (?n) { n };
              case (null) { "Swarm" };
            };
            ignore ensureCommunity(s.swarmNodeId, graphId, name, creator, firstMember);
          };
        };
      };
      case (null) {};
    };
  };

  // ── Title derivation ────────────────────────────────────────────────────────
  // The title becomes the token's permanent node name, so it is a pure
  // function of the immutable post text: first non-empty line, no '@',
  // whitespace collapsed, at most 200 characters.

  func normalizeSpaces(t : Text) : Text {
    var out = "";
    var first = true;
    for (part in t.split(#text " ")) {
      if (part.size() > 0) {
        if (not first) { out #= " " };
        out #= part;
        first := false;
      };
    };
    out;
  };

  func truncateText(t : Text, max : Nat) : Text {
    if (t.size() <= max) { return t };
    Text.fromArray(t.toArray().sliceToArray(0, max));
  };

  func deriveTitle(text : Text) : ?Text {
    let stripped = text.map(
      func(c : Char) : Char {
        if (c == '@' or c == '\t' or c == '\r' or c == '[' or c == ']') { ' ' } else { c };
      }
    );
    for (line in stripped.split(#char '\n')) {
      let t = normalizeSpaces(line.trim(#char ' '));
      if (t.size() > 0) {
        let bounded = truncateText(t, 200).trimEnd(#char ' ');
        if (bounded.size() > 0) { return ?bounded };
      };
    };
    null;
  };

  // ── Cost ────────────────────────────────────────────────────────────────────
  // Tenths of BUZZ, matching the app: 50 for the token itself, plus 1 when the
  // interp anchor adds a cross-reference edge. Inline citations add one tenth
  // each via draftCitationCount. A law anchor is a hierarchy edge, not a
  // citation, so it contributes nothing here.

  func xyzCostTenths(nodeType : Text) : Nat {
    if (nodeType == "interpEntity") { 51 } else { 50 };
  };

  func formatTenths(v : Nat) : Text {
    (v / 10).toText() # "." # (v % 10).toText();
  };

  func isCitableType(t : Text) : Bool {
    t == "lawEntity" or t == "interpEntity";
  };

  // Inline cross-references from a post, minus anything the app already implies
  // through the parent chain. `excluded` is mutated as targets are consumed so
  // duplicate markers collapse to one edge.
  func writeCitations(postId : Nat, excluded : Map.Map<Text, Bool>) : [XyzCitation] {
    let out = List.empty<XyzCitation>();
    for (citation in citationsOf(postId).values()) {
      if (excluded.get(citation.nodeId) == null) {
        excluded.add(citation.nodeId, true);
        out.add({
          target = { ref = citation.nodeId; nodeType = ?citation.nodeType };
          edgeLabel = "cites";
          bidirectional = false;
        });
      };
    };
    out.toArray();
  };

  // The draft cost is shown before the app preview, which is authoritative.
  // The interp anchor's enclosing law is only known after that read, so this
  // may overestimate by one tenth when the enclosing law is also inline-cited.
  func draftCitationCount(postId : Nat, ref : ?GraphRef, chain : ?ChainSpec) : Nat {
    let excluded = Map.empty<Text, Bool>();
    switch (chain) {
      case (?spec) {
        switch (spec.start) {
          case (?start) { excluded.add(start.nodeId, true) };
          case (null) {};
        };
      };
      case (null) {
        switch (ref) {
          case (?r) { excluded.add(r.nodeId, true) };
          case (null) {};
        };
      };
    };
    writeCitations(postId, excluded).size();
  };

  // The write payload is a pure function of the stored post and graph: no
  // field comes from the client, so `#conflict` cannot happen by user action.
  func buildWriteInput(post : Post, ref : ?GraphRef) : async {
    #ok : XyzPostInput;
    #err : Text;
  } {
    let title = switch (deriveTitle(post.text)) {
      case (?t) { t };
      case (null) {
        return #err("This post needs a first line that can become a title.");
      };
    };
    if (post.text.size() == 0) {
      return #err("A published interpretation needs text.");
    };

    // A chain post creates its own path: 1-4 ancestors and a new law anchor.
    // The refs are local labels resolved by the app's ancestor map.
    switch (postChains.get(post.id)) {
      case (?spec) {
        let ancestors = List.empty<XyzPathNode>();
        var index = 0;
        for (level in spec.levels.values()) {
          let parentRef : ?XyzRef = if (index == 0) {
            // The first new level hangs from the existing start node, if any.
            switch (spec.start) {
              case (?start) {
                ?{ ref = start.nodeId; nodeType = ?start.nodeType };
              };
              case (null) { null };
            };
          } else {
            ?{
              ref = "xyz:" # (index - 1).toText();
              // A previous *new* ancestor is resolved through the ancestor map,
              // so its type is null; a type here would mean "existing node".
              nodeType = null;
            };
          };
          ancestors.add({
            ref = "xyz:" # index.toText();
            nodeType = level.nodeType;
            name = level.name;
            parentRef;
            tags = level.tags;
            attributes = level.attributes;
            sources = level.sources;
          });
          index += 1;
        };
        let newAncestors = ancestors.toArray();
        if (newAncestors.size() == 0) {
          return #err("This chain has no new nodes.");
        };
        // The chain start is an existing ancestor, so citing it would be a
        // hierarchyEdge block. New ancestors have no existing ids yet.
        let excluded = Map.empty<Text, Bool>();
        switch (spec.start) {
          case (?start) { excluded.add(start.nodeId, true) };
          case (null) {};
        };
        return #ok({
          apiVersion = 1;
          title;
          content = post.text;
          parentLaw = {
            ref = newAncestors[newAncestors.size() - 1].ref;
            nodeType = null;
          };
          ancestors = newAncestors;
          citations = writeCitations(post.id, excluded);
        });
      };
      case (null) {};
    };

    let anchor = switch (ref) {
      case (?r) { r };
      case (null) { return #err("Only graph posts can be published.") };
    };

    let (parentLaw, parentLawId) : (XyzRef, ?Text) = if (anchor.nodeType == "lawEntity") {
      // The cited law is the anchor. Citing it would be a hierarchyEdge block.
      ({ ref = anchor.nodeId; nodeType = ?"lawEntity" }, ?anchor.nodeId);
    } else if (anchor.nodeType == "interpEntity") {
      let graph = try {
        let app = appWrite();
        await (with timeout = writeReadTimeout) app.getPublishedSourceGraph(anchor.graphId);
      } catch (_e) {
        return #err("Could not read the graph to find the enclosing law.");
      };
      let tokens = switch (graph) {
        case (?g) { g.interpretationTokens };
        case (null) { return #err("That graph is no longer published.") };
      };
      var lawId : ?Text = null;
      for (t in tokens.values()) {
        if (t.id == anchor.nodeId) { lawId := ?t.parentLawTokenId };
      };
      switch (lawId) {
        case (?id) { ({ ref = id; nodeType = ?"lawEntity" }, ?id) };
        case (null) {
          return #err("That interpretation is no longer in the graph.");
        };
      };
    } else {
      return #err("Only law tokens and interpretations can be published.");
    };

    // The anchor and its enclosing law are implied by the hierarchy, not
    // cross-references. Skip them, and skip duplicate inline markers.
    let excluded = Map.empty<Text, Bool>();
    excluded.add(anchor.nodeId, true);
    switch (parentLawId) {
      case (?id) { excluded.add(id, true) };
      case (null) {};
    };
    let citations = List.empty<XyzCitation>();
    if (anchor.nodeType == "interpEntity") {
      citations.add({
        target = { ref = anchor.nodeId; nodeType = ?"interpEntity" };
        edgeLabel = "cites";
        bidirectional = false;
      });
    };
    for (citation in writeCitations(post.id, excluded).values()) {
      citations.add(citation);
    };

    #ok({
      apiVersion = 1;
      title;
      content = post.text;
      parentLaw;
      ancestors = [];
      citations = citations.toArray();
    });
  };

  func publishedToken(ref : ?GraphRef) : ?Text {
    switch (ref) {
      case (?r) { r.tokenNodeId };
      case (null) { null };
    };
  };

  // A post is writable by its author, once, while it is a token post.
  func writablePost(postId : Nat, caller : Principal) : {
    #ok : (Post, ?GraphRef);
    #err : Text;
  } {
    let post = switch (posts.get(postId)) {
      case (?p) { p };
      case (null) { return #err("Post not found") };
    };
    if (post.author != caller) { return #err("Only the author can publish this post") };
    let ref = postGraphRefs.get(postId);
    let chain = postChains.get(postId);
    switch (ref, chain) {
      case (null, null) { return #err("Only graph posts can be published") };
      case (?r, null) {
        if (not isCitableType(r.nodeType)) {
          return #err("Only law tokens and interpretations can be published");
        };
      };
      case (_, ?_) {};
    };
    #ok((post, ref));
  };

  func markPublished(postId : Nat, ref : ?GraphRef, ok : XyzCommitOk, writer : Principal) {
    // The post could have been vote-deleted while the commit was in flight;
    // never resurrect a graph ref for a post that no longer exists.
    if (posts.get(postId) == null) { return };
    switch (ref) {
      case (?existing) {
        let updated : GraphRef = {
          graphId = existing.graphId;
          graphName = existing.graphName;
          nodeId = existing.nodeId;
          nodeName = existing.nodeName;
          nodeType = existing.nodeType;
          path = existing.path;
          attachedAt = existing.attachedAt;
          hiddenAt = existing.hiddenAt;
          tokenNodeId = ?ok.interpNodeId;
        };
        postGraphRefs.add(postId, updated);
      };
      case (null) {
        // A brand-new curation: the token it created is now this post's node.
        let pathNames = ok.path;
        let leaf = if (pathNames.size() == 0) { "" } else {
          pathNames[pathNames.size() - 1];
        };
        let graphName = switch (postChains.get(postId)) {
          case (?spec) {
            switch (spec.start) {
              case (?start) { start.graphName };
              case (null) {
                if (spec.levels.size() > 0) { spec.levels[0].name } else { leaf };
              };
            };
          };
          case (null) { leaf };
        };
        let created : GraphRef = {
          graphId = ok.publishedGraphId;
          graphName;
          nodeId = ok.interpNodeId;
          nodeName = leaf;
          nodeType = "interpEntity";
          // Display-only: keep it within the ref validation bound even for a
          // maximum-length chain.
          path = truncateChars(joinPath(pathNames), 600);
          attachedAt = Time.now();
          hiddenAt = null;
          tokenNodeId = ?ok.interpNodeId;
        };
        postGraphRefs.add(postId, created);
        getGraphNodeMap(ok.publishedGraphId, ok.interpNodeId).add(postId, true);
      };
    };
    settleCommunity(postId, writer, ref, ok);
  };

  func addNotification(recipient : Principal, actor_ : Principal, notificationType : NotificationType) {
    if (recipient == actor_) { return };
    if (isBlockedBidirectional(recipient, actor_)) { return };
    let actorUsername = switch (userProfiles.get(actor_)) {
      case (?p) { p.username };
      case (null) { "unknown" };
    };
    let id = nextNotificationId;
    nextNotificationId += 1;
    let notif : Notification = {
      id;
      notificationType;
      actorPrincipal = actor_;
      actorUsername;
      createdAt = Time.now();
      isRead = false;
    };
    let notifs = getMap(userNotifications, recipient);
    notifs.add(id, notif);

    // Evict oldest notifications beyond the cap
    if (notifs.size() > maxNotificationsPerUser) {
      let ids = List.empty<Nat>();
      for ((nid, _) in notifs.entries()) {
        ids.add(nid);
      };
      ids.sortInPlace(
        func(a, b) {
          if (a < b) { #less } else if (a > b) { #greater } else { #equal };
        }
      );
      var removed : Nat = 0;
      let toRemove : Nat = notifs.size() - maxNotificationsPerUser;
      for (nid in ids.values()) {
        if (removed < toRemove) {
          notifs.remove(nid);
          removed += 1;
        };
      };
    };
  };

  func notifyMentions(text : Text, postId : Nat, actor_ : Principal) {
    for (username in extractTokens(text, '@').values()) {
      switch (usernameToUser.get(username)) {
        case (?recipient) {
          addNotification(recipient, actor_, #mention(postId));
        };
        case (null) {};
      };
    };
  };

  // Returns true if `blocker` has blocked `target`
  func hasBlocked(blocker : Principal, target : Principal) : Bool {
    switch (blocks.get(blocker)) {
      case (?m) { m.get(target) != null };
      case (null) { false };
    };
  };

  func isBlockedBidirectional(a : Principal, b : Principal) : Bool {
    hasBlocked(a, b) or hasBlocked(b, a);
  };

  // Case-insensitive substring search
  func textContains(haystack : Text, needle : Text) : Bool {
    let h = toLower(haystack);
    let n = toLower(needle);
    let nSize = n.size();
    if (nSize == 0) { return true };
    let hSize = h.size();
    if (nSize > hSize) { return false };

    let hChars = List.empty<Char>();
    for (c in h.chars()) { hChars.add(c) };
    let nChars = List.empty<Char>();
    for (c in n.chars()) { nChars.add(c) };
    let hArr = hChars.toArray();
    let nArr = nChars.toArray();

    var i = 0;
    while (i + nSize <= hSize) {
      var j = 0;
      var matched = true;
      while (j < nSize and matched) {
        if (hArr[i + j] != nArr[j]) { matched := false };
        j += 1;
      };
      if (matched) { return true };
      i += 1;
    };
    false;
  };

  func buildProfileResponse(user : Principal, caller : Principal) : ?UserProfileResponse {
    if (not caller.isAnonymous() and hasBlocked(user, caller)) {
      return null;
    };
    switch (userProfiles.get(user)) {
      case (null) { null };
      case (?profile) {
        let followersCount = switch (followers.get(user)) {
          case (?m) { m.size() };
          case (null) { 0 };
        };
        let followingCount = switch (following.get(user)) {
          case (?m) { m.size() };
          case (null) { 0 };
        };
        let postsCount = switch (userPostCounts.get(user)) {
          case (?n) { n };
          case (null) { 0 };
        };
        let isAuthenticated = not caller.isAnonymous();
        let pinnedPostId = switch (pinnedPosts.get(user)) {
          case (?id) {
            switch (posts.get(id)) {
              case (?post) {
                let pinnable = switch (post.postType) {
                  case (#repost(_)) { false };
                  case (_) { true };
                };
                if (post.author == user and pinnable) { ?id } else { null };
              };
              case (null) { null };
            };
          };
          case (null) { null };
        };
        let isFollowed = if (isAuthenticated) {
          switch (following.get(caller)) {
            case (?m) { m.get(user) != null };
            case (null) { false };
          };
        } else { false };
        let isBlocked = if (isAuthenticated) {
          hasBlocked(caller, user);
        } else { false };
        let isMuted = if (isAuthenticated) {
          switch (mutes.get(caller)) {
            case (?m) { m.get(user) != null };
            case (null) { false };
          };
        } else { false };
        ?{
          principal = user;
          username = profile.username;
          displayName = profile.displayName;
          bio = profile.bio;
          profilePictureHash = profile.profilePictureHash;
          headerImageHash = profile.headerImageHash;
          createdAt = profile.createdAt;
          updatedAt = profile.updatedAt;
          followersCount;
          followingCount;
          postsCount;
          pinnedPostId;
          isFollowedByCurrentUser = isFollowed;
          isBlockedByCurrentUser = isBlocked;
          isMutedByCurrentUser = isMuted;
        };
      };
    };
  };

  func toPostResponse(post : Post, caller : ?Principal, preview : Bool) : PostResponse {
    let authorProfile = userProfiles.get(post.author);
    let likes = postLikes.get(post.id);
    let likeCount = switch (likes) {
      case (?m) { m.size() };
      case (null) { 0 };
    };
    let isLiked = switch (caller) {
      case (?c) {
        switch (likes) {
          case (?m) { m.get(c) != null };
          case (null) { false };
        };
      };
      case (null) { false };
    };
    let replyCount = switch (postReplies.get(post.id)) {
      case (?m) { m.size() };
      case (null) { 0 };
    };
    let reposts = postReposts.get(post.id);
    let repostCount = switch (reposts) {
      case (?m) { m.size() };
      case (null) { 0 };
    };
    let isReposted = switch (caller) {
      case (?c) {
        switch (reposts) {
          case (?m) { m.get(c) != null };
          case (null) { false };
        };
      };
      case (null) { false };
    };

    // ── Graph token fields ──
    let graphRef = postGraphRefs.get(post.id);
    let chain : ?ChainView = switch (postChains.get(post.id)) {
      case (?spec) {
        ?{
          start = spec.start;
          levels = spec.levels.map(
            func(level : ChainLevel) : ChainLevelView {
              { nodeType = level.nodeType; name = level.name };
            }
          );
        };
      };
      case (null) { null };
    };
    let isToken = switch (graphRef) {
      case (?_) { true };
      case (null) { isChainPost(post.id) };
    };
    let dislikes = postDislikes.get(post.id);
    let dislikeCount = switch (dislikes) {
      case (?m) { m.size() };
      case (null) { 0 };
    };
    let isDisliked = switch (caller) {
      case (?c) {
        switch (dislikes) {
          case (?m) { m.get(c) != null };
          case (null) { false };
        };
      };
      case (null) { false };
    };
    let isAuthor = switch (caller) {
      case (?c) { c == post.author };
      case (null) { false };
    };
    let withinWindow = Time.now() - post.createdAt <= editDeleteWindowNanos;
    let mutable = isAuthor and not isToken and withinWindow;
    let (responseText, textTruncated) = if (preview) {
      previewText(post.text);
    } else {
      (post.text, false);
    };

    {
      id = post.id;
      author = post.author;
      authorUsername = switch (authorProfile) {
        case (?p) { p.username };
        case (null) { "unknown" };
      };
      authorDisplayName = switch (authorProfile) {
        case (?p) { p.displayName };
        case (null) { "Unknown" };
      };
      authorProfilePictureHash = switch (authorProfile) {
        case (?p) { p.profilePictureHash };
        case (null) { null };
      };
      text = responseText;
      mediaHash = post.mediaHash;
      mediaType = post.mediaType;
      postType = post.postType;
      createdAt = post.createdAt;
      editedAt = post.editedAt;
      likeCount;
      replyCount;
      repostCount;
      isLikedByCurrentUser = isLiked;
      isRepostedByCurrentUser = isReposted;
      graphRef;
      chain;
      citations = citationsOf(post.id);
      textTruncated;
      weight = if (isToken) {
        ?(1 + likeCount.toInt() + repostCount.toInt() - dislikeCount.toInt())
      } else { null };
      dislikeCount;
      isDislikedByCurrentUser = isDisliked;
      canEdit = mutable;
      canDelete = mutable;
    };
  };

  func paginatePosts(start : Nat, effectiveLimit : Nat, caller : ?Principal, predicate : (Post) -> Bool) : PaginatedPosts {
    if (start == 0) {
      return { posts = []; nextCursor = null; hasMore = false };
    };
    let buf = List.empty<PostResponse>();
    let startInt : Int = start;
    for ((_, post) in posts.reverseEntriesFrom(Int.abs(startInt - 1))) {
      if (predicate(post)) {
        if (buf.size() < effectiveLimit) {
          buf.add(toPostResponse(post, caller, true));
        } else {
          let arr = buf.toArray();
          return {
            posts = arr;
            nextCursor = ?arr[arr.size() - 1].id;
            hasMore = true;
          };
        };
      };
    };
    { posts = buf.toArray(); nextCursor = null; hasMore = false };
  };

  func paginateFollows(principalMap : Map.Map<Principal, Bool>, caller : Principal, offset : Nat, effectiveLimit : Nat) : PaginatedFollows {
    let result = List.empty<FollowUserResponse>();
    var skipped : Nat = 0;
    var collected : Nat = 0;
    var hasMore = false;
    for ((p, _) in principalMap.entries()) {
      if (not caller.isAnonymous() and isBlockedBidirectional(caller, p)) {
        // skip
      } else {
        switch (userProfiles.get(p)) {
          case (null) {};
          case (?profile) {
            if (skipped < offset) {
              skipped += 1;
            } else if (collected < effectiveLimit) {
              result.add({
                principal = p;
                username = profile.username;
                displayName = profile.displayName;
                profilePictureHash = profile.profilePictureHash;
              });
              collected += 1;
            } else {
              hasMore := true;
            };
          };
        };
      };
    };
    let nextOffset : ?Nat = if (hasMore) { ?(offset + effectiveLimit) } else {
      null;
    };
    { users = result.toArray(); nextOffset; hasMore };
  };

  func paginatePostIds(idMap : Map.Map<Nat, Bool>, caller : Principal, cursor : ?Nat, effectiveLimit : Nat) : PaginatedPosts {
    let isAnon = caller.isAnonymous();
    let c = if (isAnon) { null } else { ?caller };
    let idList = List.empty<Nat>();
    for ((id, _) in idMap.entries()) {
      idList.add(id);
    };
    idList.sortInPlace(
      func(a, b) {
        if (a > b) { #less } else if (a < b) { #greater } else { #equal };
      }
    );
    let start = switch (cursor) {
      case (?cur) { cur };
      case (null) { nextPostId };
    };
    let resultBuf = List.empty<PostResponse>();
    var foundExtra = false;
    for (id in idList.values()) {
      if (not foundExtra and id < start) {
        switch (posts.get(id)) {
          case (?post) {
            if (not isAnon and isBlockedBidirectional(caller, post.author)) {
              // skip
            } else if (resultBuf.size() < effectiveLimit) {
              resultBuf.add(toPostResponse(post, c, true));
            } else {
              foundExtra := true;
            };
          };
          case (null) {};
        };
      };
    };
    let arr = resultBuf.toArray();
    let nextCursor : ?Nat = if (foundExtra and arr.size() > 0) {
      ?arr[arr.size() - 1].id;
    } else {
      null;
    };
    { posts = arr; nextCursor; hasMore = foundExtra };
  };

  func markNotifRead(notifs : Map.Map<Nat, Notification>, id : Nat) {
    switch (notifs.get(id)) {
      case (?notif) {
        if (not notif.isRead) {
          notifs.add(
            id,
            {
              id = notif.id;
              notificationType = notif.notificationType;
              actorPrincipal = notif.actorPrincipal;
              actorUsername = notif.actorUsername;
              createdAt = notif.createdAt;
              isRead = true;
            },
          );
        };
      };
      case (null) {};
    };
  };

  public query func checkUsernameAvailability(username : Text) : async Bool {
    if (not isValidUsername(username)) { return false };
    let lower = toLower(username);
    switch (usernameToUser.get(lower)) {
      case (?_) { false };
      case (null) { true };
    };
  };

  public query func getPrincipalByUsername(username : Text) : async ?Principal {
    let lower = toLower(username);
    usernameToUser.get(lower);
  };

  public query ({ caller }) func getProfile() : async ?UserProfile {
    requireAuth(caller);
    userProfiles.get(caller);
  };

  public shared ({ caller }) func pinPost(postId : Nat) : async () {
    requireAuth(caller);
    let post = switch (posts.get(postId)) {
      case (?p) { p };
      case (null) { Runtime.trap("Post not found") };
    };
    if (post.author != caller) {
      Runtime.trap("Cannot pin another user's post");
    };
    switch (post.postType) {
      case (#repost(_)) { Runtime.trap("Reposts cannot be pinned") };
      case (_) {};
    };
    pinnedPosts.add(caller, postId);
  };

  public shared ({ caller }) func unpinPost(postId : Nat) : async () {
    requireAuth(caller);
    switch (pinnedPosts.get(caller)) {
      case (?pinnedId) {
        if (pinnedId == postId) { pinnedPosts.remove(caller) };
      };
      case (null) {};
    };
  };

  public shared ({ caller }) func setProfile(username : Text, displayName : Text, bio : Text) : async () {
    requireAuth(caller);

    if (username == "") {
      Runtime.trap("Username cannot be empty");
    };
    if (not isValidUsername(username)) {
      Runtime.trap("Username must be 3-20 characters, alphanumeric and underscores only");
    };
    if (displayName == "") {
      Runtime.trap("Display name cannot be empty");
    };
    if (displayName.size() > 50) {
      Runtime.trap("Display name must be 50 characters or fewer");
    };
    if (bio.size() > 160) {
      Runtime.trap("Bio must be 160 characters or fewer");
    };

    let lower = toLower(username);

    // Check username availability (allow keeping own username)
    switch (usernameToUser.get(lower)) {
      case (?existingPrincipal) {
        if (existingPrincipal != caller) {
          Runtime.trap("Username is already taken");
        };
      };
      case (null) {};
    };

    // Remove old username mapping if changing username
    switch (userProfiles.get(caller)) {
      case (?existing) {
        let oldLower = toLower(existing.username);
        if (oldLower != lower) {
          usernameToUser.remove(oldLower);
        };
      };
      case (null) {};
    };

    let now = Time.now();
    let existing = userProfiles.get(caller);
    let profile : UserProfile = {
      username;
      displayName;
      bio;
      profilePictureHash = switch (existing) {
        case (?e) { e.profilePictureHash };
        case (null) { null };
      };
      headerImageHash = switch (existing) {
        case (?e) { e.headerImageHash };
        case (null) { null };
      };
      createdAt = switch (existing) {
        case (?e) { e.createdAt };
        case (null) { now };
      };
      updatedAt = now;
    };

    userProfiles.add(caller, profile);
    usernameToUser.add(lower, caller);
  };

  public shared ({ caller }) func updateProfilePicture(pictureHash : ?Storage.ExternalBlob) : async () {
    requireAuth(caller);
    let existing = switch (userProfiles.get(caller)) {
      case (?p) { p };
      case (null) { Runtime.trap("Must create profile first") };
    };
    userProfiles.add(
      caller,
      {
        username = existing.username;
        displayName = existing.displayName;
        bio = existing.bio;
        profilePictureHash = pictureHash;
        headerImageHash = existing.headerImageHash;
        createdAt = existing.createdAt;
        updatedAt = Time.now();
      },
    );
  };

  public shared ({ caller }) func updateHeaderImage(imageHash : ?Storage.ExternalBlob) : async () {
    requireAuth(caller);
    let existing = switch (userProfiles.get(caller)) {
      case (?p) { p };
      case (null) { Runtime.trap("Must create profile first") };
    };
    userProfiles.add(
      caller,
      {
        username = existing.username;
        displayName = existing.displayName;
        bio = existing.bio;
        profilePictureHash = existing.profilePictureHash;
        headerImageHash = imageHash;
        createdAt = existing.createdAt;
        updatedAt = Time.now();
      },
    );
  };

  public shared ({ caller }) func createPost(text : Text, mediaHash : ?Storage.ExternalBlob, mediaType : ?Text) : async PostResponse {
    requireAuth(caller);
    validateMedia(mediaHash, mediaType);
    requirePostCapNotReached(caller);
    switch (userProfiles.get(caller)) {
      case (null) { Runtime.trap("Must create profile before posting") };
      case (?_) {};
    };
    if (text.size() == 0 and mediaHash == null) {
      Runtime.trap("Post must contain text or media");
    };
    if (text.size() > maxPostLength) {
      Runtime.trap("Post is too long (20,000 characters max)");
    };
    requireTextQuota(caller, textBytes(text));

    let now = Time.now();
    let id = nextPostId;
    nextPostId += 1;

    let post : Post = {
      id;
      author = caller;
      text;
      mediaHash;
      mediaType;
      postType = #original;
      createdAt = now;
      editedAt = null;
    };

    posts.add(id, post);
    addTextBytes(caller, textBytes(text));
    incrementPostCount(caller);
    indexPostHashtags(id, text);
    notifyMentions(text, id, caller);

    toPostResponse(post, ?caller, false);
  };

  // Creates one interpretation token: a post plus its immutable citation.
  public shared ({ caller }) func createGraphPost(
    ref : GraphRefInput,
    text : Text,
    mediaHash : ?Storage.ExternalBlob,
    mediaType : ?Text,
    citations : [GraphRefInput],
  ) : async PostResponse {
    requireAuth(caller);
    validateMedia(mediaHash, mediaType);
    validateGraphRef(ref);
    validateCitations(citations);
    requirePostCapNotReached(caller);
    switch (userProfiles.get(caller)) {
      case (null) { Runtime.trap("Must create profile before citing") };
      case (?_) {};
    };
    if (text.size() == 0 and mediaHash == null) {
      Runtime.trap("Post must contain text or media");
    };
    if (text.size() > maxPostLength) {
      Runtime.trap("Post is too long (20,000 characters max)");
    };
    let storedCitations = normalizeCitations(citations);
    let contentBytes = textBytes(text) + citationsBytes(storedCitations);
    requireTextQuota(caller, contentBytes);

    let now = Time.now();
    let id = nextPostId;
    nextPostId += 1;

    let post : Post = {
      id;
      author = caller;
      text;
      mediaHash;
      mediaType;
      postType = #original;
      createdAt = now;
      editedAt = null;
    };

    posts.add(id, post);
    addTextBytes(caller, contentBytes);
    incrementPostCount(caller);
    indexPostHashtags(id, text);
    notifyMentions(text, id, caller);
    if (storedCitations.size() > 0) {
      postCitations.add(id, storedCitations);
    };

    let graphRef : GraphRef = {
      graphId = ref.graphId;
      graphName = ref.graphName;
      nodeId = ref.nodeId;
      nodeName = ref.nodeName;
      nodeType = ref.nodeType;
      path = ref.path;
      attachedAt = now;
      hiddenAt = null;
      tokenNodeId = null;
    };
    postGraphRefs.add(id, graphRef);
    getGraphNodeMap(ref.graphId, ref.nodeId).add(id, true);
    switch (ref.swarmNodeId) {
      case (?swarmNodeId) {
        postSwarm.add(id, {
          swarmNodeId;
          swarmCreator = ref.swarmCreator;
          communityName = ref.communityName;
        });
      };
      case (null) {};
    };

    toPostResponse(post, ?caller, false);
  };

  // A chain post is still one interpretation token. The 1-4 new nodes are only
  // the path to it, which is the only way the app permits containers to exist.
  public shared ({ caller }) func createChainPost(
    chain : ChainInput,
    text : Text,
    mediaHash : ?Storage.ExternalBlob,
    mediaType : ?Text,
    citations : [GraphRefInput],
  ) : async PostResponse {
    requireAuth(caller);
    validateMedia(mediaHash, mediaType);
    validateCitations(citations);
    let spec = validateChain(chain);
    requirePostCapNotReached(caller);
    switch (userProfiles.get(caller)) {
      case (null) { Runtime.trap("Must create profile before posting") };
      case (?_) {};
    };
    if (text.size() == 0 and mediaHash == null) {
      Runtime.trap("Post must contain text or media");
    };
    if (text.size() > maxPostLength) {
      Runtime.trap("Post is too long (20,000 characters max)");
    };
    let storedCitations = normalizeCitations(citations);
    let contentBytes = textBytes(text) + citationsBytes(storedCitations);
    requireTextQuota(caller, contentBytes);

    let now = Time.now();
    let id = nextPostId;
    nextPostId += 1;

    let post : Post = {
      id;
      author = caller;
      text;
      mediaHash;
      mediaType;
      postType = #original;
      createdAt = now;
      editedAt = null;
    };

    posts.add(id, post);
    addTextBytes(caller, contentBytes);
    incrementPostCount(caller);
    indexPostHashtags(id, text);
    notifyMentions(text, id, caller);
    if (storedCitations.size() > 0) {
      postCitations.add(id, storedCitations);
    };

    postChains.add(id, spec);

    // An extension chain already has a graph and node to link to. A brand-new
    // curation has neither until the app creates it on publish.
    switch (spec.start) {
      case (?start) {
        let graphRef : GraphRef = {
          graphId = start.graphId;
          graphName = start.graphName;
          nodeId = start.nodeId;
          nodeName = start.nodeName;
          nodeType = start.nodeType;
          path = start.path;
          attachedAt = now;
          hiddenAt = null;
          tokenNodeId = null;
        };
        postGraphRefs.add(id, graphRef);
        getGraphNodeMap(start.graphId, start.nodeId).add(id, true);
        switch (start.swarmNodeId) {
          case (?swarmNodeId) {
            postSwarm.add(id, {
              swarmNodeId;
              swarmCreator = start.swarmCreator;
              communityName = start.communityName;
            });
          };
          case (null) {};
        };
      };
      case (null) {};
    };

    toPostResponse(post, ?caller, false);
  };

  public query ({ caller }) func getPost(postId : Nat) : async ?PostResponse {
    let isAnon = caller.isAnonymous();
    let c = if (isAnon) { null } else { ?caller };
    switch (posts.get(postId)) {
      case (?post) {
        if (not isAnon and isBlockedBidirectional(caller, post.author)) {
          null;
        } else {
          ?toPostResponse(post, c, false);
        };
      };
      case (null) { null };
    };
  };

  public shared ({ caller }) func editPost(postId : Nat, text : Text) : async PostResponse {
    requireAuth(caller);
    if (text.size() > maxPostLength) {
      Runtime.trap("Post is too long (20,000 characters max)");
    };

    let post = switch (posts.get(postId)) {
      case (?p) { p };
      case (null) { Runtime.trap("Post not found") };
    };
    if (text.size() == 0 and post.mediaHash == null) {
      Runtime.trap("Post must contain text or media");
    };
    if (post.author != caller) {
      Runtime.trap("Cannot edit another user's post");
    };
    if (isGraphPost(postId)) {
      Runtime.trap("Graph posts cannot be edited");
    };
    if (isChainPost(postId)) {
      Runtime.trap("Chain posts cannot be edited");
    };
    let oldBytes = textBytes(post.text);
    let newBytes = textBytes(text);
    if (newBytes > oldBytes) {
      requireTextQuota(caller, newBytes - oldBytes);
    };
    let now = Time.now();
    if (now - post.createdAt > editDeleteWindowNanos) {
      Runtime.trap("Edit window has expired (15 minutes)");
    };

    let updated : Post = {
      id = post.id;
      author = post.author;
      text;
      mediaHash = post.mediaHash;
      mediaType = post.mediaType;
      postType = post.postType;
      createdAt = post.createdAt;
      editedAt = ?now;
    };

    removePostHashtags(postId, post.text);
    posts.add(postId, updated);
    if (newBytes > oldBytes) {
      addTextBytes(caller, newBytes - oldBytes);
    } else {
      removeTextBytes(caller, oldBytes - newBytes);
    };
    indexPostHashtags(postId, text);
    toPostResponse(updated, ?caller, false);
  };

  public shared ({ caller }) func deletePost(postId : Nat) : async () {
    requireAuth(caller);

    let post = switch (posts.get(postId)) {
      case (?p) { p };
      case (null) { Runtime.trap("Post not found") };
    };
    if (post.author != caller) {
      Runtime.trap("Cannot delete another user's post");
    };
    if (isTokenPost(postId)) {
      Runtime.trap("Graph posts cannot be deleted");
    };
    let now = Time.now();
    if (now - post.createdAt > editDeleteWindowNanos) {
      Runtime.trap("Delete window has expired (15 minutes)");
    };

    posts.remove(postId);
    decrementPostCount(caller);
    removeTextBytes(caller, textBytes(post.text));
    removePostHashtags(postId, post.text);
    postLikes.remove(postId);
    postDislikes.remove(postId);
    switch (pinnedPosts.get(caller)) {
      case (?pinnedId) {
        if (pinnedId == postId) { pinnedPosts.remove(caller) };
      };
      case (null) {};
    };

    // Clean up type-specific indexes
    switch (post.postType) {
      case (#repost(originalId)) {
        switch (postReposts.get(originalId)) {
          case (?m) { m.remove(caller) };
          case (null) {};
        };
        let userReposts = getMap(repostIndex, caller);
        userReposts.remove(originalId);
      };
      case (#reply(parentId)) {
        switch (postReplies.get(parentId)) {
          case (?m) { m.remove(postId) };
          case (null) {};
        };
      };
      case (_) {};
    };
  };

  public query ({ caller }) func getGlobalFeed(cursor : ?Nat, limit : Nat) : async PaginatedPosts {
    let effectiveLimit = if (limit == 0 or limit > 50) { 20 } else { limit };
    let start = switch (cursor) {
      case (?c) { c };
      case (null) { nextPostId };
    };
    let isAnon = caller.isAnonymous();
    let c = if (isAnon) { null } else { ?caller };
    paginatePosts(
      start,
      effectiveLimit,
      c,
      func(post) {
        if (isAnon) { true } else {
          not isBlockedBidirectional(caller, post.author);
        };
      },
    );
  };

  public query ({ caller }) func getPostsByUser(user : Principal, cursor : ?Nat, limit : Nat) : async PaginatedPosts {
    if (not caller.isAnonymous() and hasBlocked(user, caller)) {
      return { posts = []; nextCursor = null; hasMore = false };
    };
    let effectiveLimit = if (limit == 0 or limit > 50) { 20 } else { limit };
    let start = switch (cursor) {
      case (?c) { c };
      case (null) { nextPostId };
    };
    let c = if (caller.isAnonymous()) { null } else { ?caller };
    paginatePosts(start, effectiveLimit, c, func(post) { post.author == user });
  };

  public query ({ caller }) func getHomeFeed(cursor : ?Nat, limit : Nat) : async PaginatedPosts {
    requireAuth(caller);
    let effectiveLimit = if (limit == 0 or limit > 50) { 20 } else { limit };
    let start = switch (cursor) {
      case (?c) { c };
      case (null) { nextPostId };
    };

    let callerFollowing = following.get(caller);
    let callerMutes = mutes.get(caller);
    let followsAnyone = switch (callerFollowing) {
      case (?m) { m.size() > 0 };
      case (null) { false };
    };

    paginatePosts(
      start,
      effectiveLimit,
      ?caller,
      func(post) {
        if (hasBlocked(caller, post.author) or hasBlocked(post.author, caller)) {
          false;
        } else {
          let isMuted = switch (callerMutes) {
            case (?m) { m.get(post.author) != null };
            case (null) { false };
          };
          if (isMuted) {
            false;
          } else if (post.author == caller) {
            true;
          } else if (followsAnyone) {
            switch (callerFollowing) {
              case (?m) { m.get(post.author) != null };
              case (null) { false };
            };
          } else {
            true;
          };
        };
      },
    );
  };

  public query ({ caller }) func getPostsByHashtag(tag : Text, cursor : ?Nat, limit : Nat) : async PaginatedPosts {
    let effectiveLimit = if (limit == 0 or limit > 50) { 20 } else { limit };
    let lower = toLower(tag);
    let tagPosts = switch (hashtagIndex.get(lower)) {
      case (?m) { m };
      case (null) {
        return { posts = []; nextCursor = null; hasMore = false };
      };
    };
    paginatePostIds(tagPosts, caller, cursor, effectiveLimit);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfileResponse {
    buildProfileResponse(user, caller);
  };

  public query ({ caller }) func getProfileByUsername(username : Text) : async ?UserProfileResponse {
    let lower = toLower(username);
    switch (usernameToUser.get(lower)) {
      case (null) { null };
      case (?user) { buildProfileResponse(user, caller) };
    };
  };

  public query ({ caller }) func getFollowers(username : Text, offset : Nat, limit : Nat) : async PaginatedFollows {
    let effectiveLimit = if (limit == 0 or limit > 50) { 20 } else { limit };
    let lower = toLower(username);
    let user = switch (usernameToUser.get(lower)) {
      case (null) { return { users = []; nextOffset = null; hasMore = false } };
      case (?u) { u };
    };
    let followerMap = switch (followers.get(user)) {
      case (null) { return { users = []; nextOffset = null; hasMore = false } };
      case (?m) { m };
    };
    paginateFollows(followerMap, caller, offset, effectiveLimit);
  };

  public query ({ caller }) func getFollowing(username : Text, offset : Nat, limit : Nat) : async PaginatedFollows {
    let effectiveLimit = if (limit == 0 or limit > 50) { 20 } else { limit };
    let lower = toLower(username);
    let user = switch (usernameToUser.get(lower)) {
      case (null) { return { users = []; nextOffset = null; hasMore = false } };
      case (?u) { u };
    };
    let followingMap = switch (following.get(user)) {
      case (null) { return { users = []; nextOffset = null; hasMore = false } };
      case (?m) { m };
    };
    paginateFollows(followingMap, caller, offset, effectiveLimit);
  };

  public query ({ caller }) func getPostsByUsername(username : Text, cursor : ?Nat, limit : Nat) : async PaginatedPosts {
    let lower = toLower(username);
    switch (usernameToUser.get(lower)) {
      case (null) { { posts = []; nextCursor = null; hasMore = false } };
      case (?user) {
        if (not caller.isAnonymous() and hasBlocked(user, caller)) {
          return { posts = []; nextCursor = null; hasMore = false };
        };
        let effectiveLimit = if (limit == 0 or limit > 50) { 20 } else { limit };
        let start = switch (cursor) {
          case (?c) { c };
          case (null) { nextPostId };
        };
        let c = if (caller.isAnonymous()) { null } else { ?caller };
        paginatePosts(start, effectiveLimit, c, func(post) { post.author == user });
      };
    };
  };

  public shared ({ caller }) func followUser(user : Principal) : async () {
    requireAuth(caller);
    if (caller == user) {
      Runtime.trap("Cannot follow yourself");
    };
    switch (userProfiles.get(user)) {
      case (null) { Runtime.trap("User not found") };
      case (?_) {};
    };
    if (isBlockedBidirectional(caller, user)) {
      Runtime.trap("Cannot interact with this user");
    };
    let callerFollowing = getPrincipalMap(following, caller);
    let alreadyFollowing = callerFollowing.get(user) != null;
    callerFollowing.add(user, true);
    getPrincipalMap(followers, user).add(caller, true);
    if (not alreadyFollowing) {
      addNotification(user, caller, #follow);
    };
  };

  public shared ({ caller }) func unfollowUser(user : Principal) : async () {
    requireAuth(caller);
    getPrincipalMap(following, caller).remove(user);
    getPrincipalMap(followers, user).remove(caller);
  };

  public shared ({ caller }) func blockUser(user : Principal) : async () {
    requireAuth(caller);
    if (caller == user) {
      Runtime.trap("Cannot block yourself");
    };
    switch (userProfiles.get(user)) {
      case (null) { Runtime.trap("User not found") };
      case (?_) {};
    };
    getPrincipalMap(blocks, caller).add(user, true);
    // Remove follow relationships in both directions
    getPrincipalMap(following, caller).remove(user);
    getPrincipalMap(followers, user).remove(caller);
    getPrincipalMap(following, user).remove(caller);
    getPrincipalMap(followers, caller).remove(user);
  };

  public shared ({ caller }) func unblockUser(user : Principal) : async () {
    requireAuth(caller);
    getPrincipalMap(blocks, caller).remove(user);
  };

  public shared ({ caller }) func muteUser(user : Principal) : async () {
    requireAuth(caller);
    if (caller == user) {
      Runtime.trap("Cannot mute yourself");
    };
    switch (userProfiles.get(user)) {
      case (null) { Runtime.trap("User not found") };
      case (?_) {};
    };
    getPrincipalMap(mutes, caller).add(user, true);
  };

  public shared ({ caller }) func unmuteUser(user : Principal) : async () {
    requireAuth(caller);
    getPrincipalMap(mutes, caller).remove(user);
  };

  public shared ({ caller }) func likePost(postId : Nat) : async () {
    requireAuth(caller);
    let post = switch (posts.get(postId)) {
      case (?p) { p };
      case (null) { Runtime.trap("Post not found") };
    };
    if (isBlockedBidirectional(caller, post.author)) {
      Runtime.trap("Cannot interact with this user");
    };
    requireNotSelfVote(post, caller);
    // Liking clears a dislike: one vote per principal.
    switch (postDislikes.get(postId)) {
      case (?m) { m.remove(caller) };
      case (null) {};
    };
    let likes = getNatPrincipalMap(postLikes, postId);
    let alreadyLiked = likes.get(caller) != null;
    likes.add(caller, true);
    if (not alreadyLiked) {
      addNotification(post.author, caller, #like(postId));
    };
  };

  public shared ({ caller }) func unlikePost(postId : Nat) : async () {
    requireAuth(caller);
    switch (posts.get(postId)) {
      case (null) { Runtime.trap("Post not found") };
      case (?post) { requireNotSelfVote(post, caller) };
    };
    switch (postLikes.get(postId)) {
      case (?m) { m.remove(caller) };
      case (null) {};
    };
    maybeDeleteBranch(postId);
  };

  public shared ({ caller }) func dislikePost(postId : Nat) : async () {
    requireAuth(caller);
    let post = switch (posts.get(postId)) {
      case (?p) { p };
      case (null) { Runtime.trap("Post not found") };
    };
    if (not isTokenPost(postId)) {
      Runtime.trap("Dislikes apply to graph posts only");
    };
    if (isBlockedBidirectional(caller, post.author)) {
      Runtime.trap("Cannot interact with this user");
    };
    requireNotSelfVote(post, caller);
    // Disliking clears a like: one vote per principal.
    switch (postLikes.get(postId)) {
      case (?m) { m.remove(caller) };
      case (null) {};
    };
    getNatPrincipalMap(postDislikes, postId).add(caller, true);
    maybeDeleteBranch(postId);
  };

  public shared ({ caller }) func undislikePost(postId : Nat) : async () {
    requireAuth(caller);
    switch (posts.get(postId)) {
      case (null) { Runtime.trap("Post not found") };
      case (?post) { requireNotSelfVote(post, caller) };
    };
    switch (postDislikes.get(postId)) {
      case (?m) { m.remove(caller) };
      case (null) {};
    };
    maybeDeleteBranch(postId);
  };

  public shared ({ caller }) func createReply(parentPostId : Nat, text : Text, mediaHash : ?Storage.ExternalBlob, mediaType : ?Text) : async PostResponse {
    requireAuth(caller);
    validateMedia(mediaHash, mediaType);
    requirePostCapNotReached(caller);
    switch (userProfiles.get(caller)) {
      case (null) { Runtime.trap("Must create profile before replying") };
      case (?_) {};
    };
    let parentPost = switch (posts.get(parentPostId)) {
      case (?p) { p };
      case (null) { Runtime.trap("Parent post not found") };
    };
    if (isBlockedBidirectional(caller, parentPost.author)) {
      Runtime.trap("Cannot interact with this user");
    };
    if (text.size() == 0 and mediaHash == null) {
      Runtime.trap("Reply must contain text or media");
    };
    if (text.size() > maxPostLength) {
      Runtime.trap("Reply is too long (20,000 characters max)");
    };
    requireTextQuota(caller, textBytes(text));
    requireChainPublishedForChild(parentPostId);

    let now = Time.now();
    let id = nextPostId;
    nextPostId += 1;

    let reply : Post = {
      id;
      author = caller;
      text;
      mediaHash;
      mediaType;
      postType = #reply(parentPostId);
      createdAt = now;
      editedAt = null;
    };

    posts.add(id, reply);
    addTextBytes(caller, textBytes(text));
    incrementPostCount(caller);
    getPostReplies(parentPostId).add(id, true);
    indexPostHashtags(id, text);
    addNotification(parentPost.author, caller, #reply(parentPostId));
    notifyMentions(text, id, caller);
    inheritGraphRef(parentPostId, id);

    toPostResponse(reply, ?caller, false);
  };

  // Every token on a node, newest first, with the node's aggregate weight.
  public query ({ caller }) func getPostsByGraphNode(
    graphId : Text,
    nodeId : Text,
    cursor : ?Nat,
    limit : Nat,
  ) : async PaginatedGraphPosts {
    let effectiveLimit = if (limit == 0 or limit > 50) { 20 } else { limit };
    let empty : PaginatedGraphPosts = {
      posts = [];
      nextCursor = null;
      hasMore = false;
      nodeWeight = 0;
      tokenCount = 0;
      contributionCount = 0;
    };
    let ids = switch (graphNodePosts.get(graphId)) {
      case (null) { return empty };
      case (?byNode) {
        switch (byNode.get(nodeId)) {
          case (null) { return empty };
          case (?m) { m };
        };
      };
    };

    var total : Int = 0;
    var tokens : Nat = 0;
    var contributions : Nat = 0;
    for ((id, _) in ids.entries()) {
      switch (posts.get(id)) {
        case (?p) {
          tokens += 1;
          total += postVoteWeight(id);
          switch (p.postType) {
            case (#original) { contributions += 1 };
            case (_) {};
          };
        };
        case (null) {};
      };
    };

    let page = paginatePostIds(ids, caller, cursor, effectiveLimit);
    {
      posts = page.posts;
      nextCursor = page.nextCursor;
      hasMore = page.hasMore;
      nodeWeight = if (total < 0) { 0 } else { total };
      tokenCount = tokens;
      contributionCount = contributions;
    };
  };

  // ── Principal link methods ──────────────────────────────────────────────────

  public query func getAppBackend() : async Text {
    appBackendText;
  };

  public query ({ caller }) func getMyAppLink() : async ?LinkState {
    linkByXyz.get(caller);
  };

  // Step 1: resolve a code without consuming it, so the confirmation card can
  // show which .app account is about to be linked.
  public shared ({ caller }) func resolveAppLinkCode(
    code : Text,
  ) : async { #ok : AppLinkPreview; #err : Text } {
    requireAuth(caller);
    let app = appLink();
    try {
      switch (await (with timeout = linkCallTimeout) app.resolveLinkCode(normalizeLinkCode(code))) {
        case (null) { #err("Invalid or expired code") };
        case (?preview) { #ok(preview) };
      };
    } catch (_e) {
      #err("Could not reach hyvmind.app");
    };
  };

  // Step 2: bind. Idempotent if already linked.
  public shared ({ caller }) func confirmAppLink(code : Text) : async LinkResult {
    requireAuth(caller);
    switch (linkByXyz.get(caller)) {
      case (?existing) { return #ok(existing) };
      case (null) {};
    };
    if (not acquireLinkLock(caller)) {
      return #err("A link request is already in progress");
    };
    try {
      let app = appLink();
      let normalized = normalizeLinkCode(code);

      // Best effort: the name is cosmetic, and a used code resolves to null.
      let preview = try {
        await (with timeout = linkCallTimeout) app.resolveLinkCode(normalized)
      } catch (_e) { null };

      let result = try {
        await (with timeout = linkCallTimeout) app.confirmLink(normalized, caller)
      } catch (_e) {
        return #err("Could not reach hyvmind.app");
      };

      switch (result) {
        case (#err(e)) { #err(e) };
        case (#ok(appPrincipal)) {
          // One .xyz account per .app account.
          switch (appToXyz.get(appPrincipal)) {
            case (?other) {
              if (other != caller) {
                return #err("That hyvmind.app account is already linked to another xyz account");
              };
            };
            case (null) {};
          };
          let displayName = switch (preview) {
            case (?pv) {
              if (pv.appPrincipal == appPrincipal) { pv.displayName } else { null };
            };
            case (null) { null };
          };
          let state : LinkState = {
            appPrincipal;
            displayName;
            linkedAt = Time.now();
          };
          linkByXyz.add(caller, state);
          appToXyz.add(appPrincipal, caller);
          #ok(state);
        };
      };
    } finally {
      releaseLinkLock(caller);
    };
  };

  public shared ({ caller }) func unlinkAppAccount() : async { #ok; #err : Text } {
    requireAuth(caller);
    let state = switch (linkByXyz.get(caller)) {
      case (null) { return #err("No linked hyvmind.app account") };
      case (?s) { s };
    };
    // Ask the app to revoke. #err("Not linked") is success for the goal state,
    // and an unreachable app does not block the local unlink.
    try {
      let app = appLink();
      ignore await (with timeout = linkCallTimeout) app.revokeLinkAsXyz(caller);
    } catch (_e) {};
    linkByXyz.remove(caller);
    appToXyz.remove(state.appPrincipal);
    #ok;
  };

  // Reconciles local link state against the app, which is authoritative.
  public shared ({ caller }) func reconcileAppLink() : async {
    #ok : ?LinkState;
    #err : Text;
  } {
    requireAuth(caller);
    let remote = try {
      let app = appLink();
      await (with timeout = linkCallTimeout) app.getLinkForXyz(caller)
    } catch (_e) {
      return #err("Could not reach hyvmind.app");
    };
    switch (remote) {
      case (null) {
        switch (linkByXyz.get(caller)) {
          case (?s) { appToXyz.remove(s.appPrincipal) };
          case (null) {};
        };
        linkByXyz.remove(caller);
        #ok(null);
      };
      case (?appPrincipal) {
        switch (linkByXyz.get(caller)) {
          case (?s) {
            if (s.appPrincipal == appPrincipal) {
              #ok(?s);
            } else {
              appToXyz.remove(s.appPrincipal);
              let refreshed : LinkState = {
                appPrincipal;
                displayName = null;
                linkedAt = Time.now();
              };
              linkByXyz.add(caller, refreshed);
              appToXyz.add(appPrincipal, caller);
              #ok(?refreshed);
            };
          };
          case (null) {
            let refreshed : LinkState = {
              appPrincipal;
              displayName = null;
              linkedAt = Time.now();
            };
            linkByXyz.add(caller, refreshed);
            appToXyz.add(appPrincipal, caller);
            #ok(?refreshed);
          };
        };
      };
    };
  };

  // ── Graph post publishing (Phase 3) ─────────────────────────────────────────

  // Cheap, local, and never touches the app: exactly what the composer needs to
  // show a title and a price before spending a round trip.
  public query ({ caller }) func getXyzWriteDraft(postId : Nat) : async ?XyzWriteDraft {
    let post = switch (posts.get(postId)) {
      case (?p) { p };
      case (null) { return null };
    };
    if (post.author != caller) { return null };
    let ref = postGraphRefs.get(postId);
    let chain = postChains.get(postId);
    switch (ref, chain) {
      case (null, null) { return null };
      case (_) {};
    };
    let tokenNodeId = publishedToken(ref);
    let nodeType = switch (chain) {
      case (?_) { "interpEntity" };
      case (null) {
        switch (ref) {
          case (?r) { r.nodeType };
          case (null) { "" };
        };
      };
    };
    let citable = switch (chain) {
      case (?_) { true };
      case (null) {
        switch (ref) {
          case (?r) { isCitableType(r.nodeType) };
          case (null) { false };
        };
      };
    };
    let title = deriveTitle(post.text);
    let linked = linkByXyz.get(caller) != null;
    let reason : ?Text = if (tokenNodeId != null) {
      ?"This post is already published.";
    } else if (not citable) {
      ?"Only law tokens and interpretations can be published.";
    } else if (post.text.size() == 0) {
      ?"A published interpretation needs text.";
    } else if (title == null) {
      ?"This post needs a first line that can become a title.";
    } else if (not linked) {
      ?"Link your hyvmind.app account first.";
    } else {
      null;
    };
    let gate = writeGateFor(postId, caller);
    let (gateReason, gateCode) = switch (gate) {
      case (#allowed) { (null, null) };
      case (#denied(d)) { (?d.message, ?d.reason) };
    };
    let cost = switch (chain) {
      case (?spec) { chainCost(spec) + draftCitationCount(postId, ref, chain) };
      case (null) { xyzCostTenths(nodeType) + draftCitationCount(postId, ref, chain) };
    };
    ?{
      postId;
      writeId = "xyz:" # postId.toText();
      title;
      nodeType;
      costTenths = cost;
      costText = formatTenths(cost);
      canPublish = reason == null and gateReason == null;
      reason;
      tokenNodeId;
      gateReason;
      gateCode;
    };
  };

  public shared ({ caller }) func previewXyzWriteForPost(
    postId : Nat,
  ) : async XyzPreviewResult {
    requireAuth(caller);
    let pair = switch (writablePost(postId, caller)) {
      case (#ok(p)) { p };
      case (#err(m)) { return #err({ kind = #malformed; message = m }) };
    };
    let (post, ref) = pair;
    switch (publishedToken(ref)) {
      case (?_) {
        return #err({ kind = #malformed; message = "This post is already published." });
      };
      case (null) {};
    };
    if (linkByXyz.get(caller) == null) {
      return #notLinked({
        message = "This xyz account is not linked to a hyvmind.app account.";
        writerXyz = caller;
      });
    };
    // The app evaluates no social rule, so this is the only gate there is.
    switch (writeGateFor(postId, caller)) {
      case (#allowed) {};
      case (#denied(d)) {
        return #gate({
          message = d.message;
          reason = d.reason;
          communityName = d.communityName;
        });
      };
    };
    let input = switch (await buildWriteInput(post, ref)) {
      case (#ok(i)) { i };
      case (#err(m)) { return #err({ kind = #malformed; message = m }) };
    };
    try {
      let app = appWrite();
      await (with timeout = writePreviewTimeout) app.previewXyzWrite(
        caller,
        "xyz:" # postId.toText(),
        mutualFollowsOf(caller),
        input,
      );
    } catch (_e) {
      #err({
        kind = #internal;
        message = "Could not reach hyvmind.app. Nothing was charged.";
      });
    };
  };

  public shared ({ caller }) func commitXyzWriteForPost(
    postId : Nat,
    expectedDigest : Text,
  ) : async XyzCommitOutcome {
    requireAuth(caller);
    let pair = switch (writablePost(postId, caller)) {
      case (#ok(p)) { p };
      case (#err(m)) { return #err({ kind = #malformed; message = m }) };
    };
    let (post, ref) = pair;
    switch (publishedToken(ref)) {
      case (?id) { return #alreadyPublished({ interpNodeId = id }) };
      case (null) {};
    };
    if (linkByXyz.get(caller) == null) {
      return #notLinked({
        message = "This xyz account is not linked to a hyvmind.app account.";
        writerXyz = caller;
      });
    };
    switch (writeGateFor(postId, caller)) {
      case (#allowed) {};
      case (#denied(d)) {
        return #gate({
          message = d.message;
          reason = d.reason;
          communityName = d.communityName;
        });
      };
    };
    if (not acquireWriteLock(postId)) {
      return #busy({ message = "A publish for this post is already in progress." });
    };
    let writeId = "xyz:" # postId.toText();
    try {
      let input = switch (await buildWriteInput(post, ref)) {
        case (#ok(i)) { i };
        case (#err(m)) { return #err({ kind = #malformed; message = m }) };
      };
      let result = try {
        let app = appWrite();
        await (with timeout = writeCommitTimeout) app.commitXyzWrite(
          caller,
          writeId,
          expectedDigest,
          mutualFollowsOf(caller),
          input,
        );
      } catch (_e) {
        return #unknown({
          message = "The app did not confirm. The write may still land; check status before retrying.";
          writeId;
        });
      };
      switch (result) {
        case (#ok(ok)) {
          markPublished(postId, ref, ok, caller);
          #ok(ok);
        };
        case (_) { result };
      };
    } finally {
      releaseWriteLock(postId);
    };
  };

  // The app exposes the linked account's balance only to the xyz backend. A
  // query cannot await another canister, so this has to be a shared method.
  public shared ({ caller }) func getLinkedBuzzBalance() : async ?{
    units : Int;
    text : Text;
  } {
    requireAuth(caller);
    if (linkByXyz.get(caller) == null) { return null };
    try {
      let app = appWrite();
      await (with timeout = writeReadTimeout) app.getXyzBuzzBalance(caller);
    } catch (_e) {
      null;
    };
  };

  // Recovers a commit whose reply was lost, and confirms one that landed.
  // The app keeps write results indefinitely, keyed on (xyz, writeId).
  public shared ({ caller }) func reconcileXyzWriteForPost(
    postId : Nat,
  ) : async XyzCommitOutcome {
    requireAuth(caller);
    let pair = switch (writablePost(postId, caller)) {
      case (#ok(p)) { p };
      case (#err(m)) { return #err({ kind = #malformed; message = m }) };
    };
    let (_, ref) = pair;
    switch (publishedToken(ref)) {
      case (?id) { return #alreadyPublished({ interpNodeId = id }) };
      case (null) {};
    };
    if (linkByXyz.get(caller) == null) {
      return #notLinked({
        message = "This xyz account is not linked to a hyvmind.app account.";
        writerXyz = caller;
      });
    };
    let writeId = "xyz:" # postId.toText();
    let remote = try {
      let app = appWrite();
      await (with timeout = writeReadTimeout) app.getXyzWrite(caller, writeId);
    } catch (_e) {
      return #unknown({
        message = "Could not reach hyvmind.app to check this write.";
        writeId;
      });
    };
    switch (remote) {
      case (?ok) {
        markPublished(postId, ref, ok, caller);
        #ok(ok);
      };
      case (null) {
        #notFound({
          message = "No commit was recorded for this post. You can publish it now.";
          writeId;
        });
      };
    };
  };

  public query ({ caller }) func getReplies(postId : Nat, cursor : ?Nat, limit : Nat) : async PaginatedPosts {
    let effectiveLimit = if (limit == 0 or limit > 50) { 20 } else { limit };
    let replyIds = switch (postReplies.get(postId)) {
      case (?m) { m };
      case (null) {
        return { posts = []; nextCursor = null; hasMore = false };
      };
    };
    paginatePostIds(replyIds, caller, cursor, effectiveLimit);
  };

  public shared ({ caller }) func repostPost(postId : Nat) : async PostResponse {
    requireAuth(caller);
    requirePostCapNotReached(caller);
    switch (userProfiles.get(caller)) {
      case (null) { Runtime.trap("Must create profile before reposting") };
      case (?_) {};
    };
    let originalPost = switch (posts.get(postId)) {
      case (?p) { p };
      case (null) { Runtime.trap("Post not found") };
    };
    if (isBlockedBidirectional(caller, originalPost.author)) {
      Runtime.trap("Cannot interact with this user");
    };
    // Prevent duplicate repost
    switch (postReposts.get(postId)) {
      case (?m) {
        if (m.get(caller) != null) {
          Runtime.trap("Already reposted this post");
        };
      };
      case (null) {};
    };

    let now = Time.now();
    let id = nextPostId;
    nextPostId += 1;

    let repost : Post = {
      id;
      author = caller;
      text = "";
      mediaHash = null;
      mediaType = null;
      postType = #repost(postId);
      createdAt = now;
      editedAt = null;
    };

    posts.add(id, repost);
    incrementPostCount(caller);
    getNatPrincipalMap(postReposts, postId).add(caller, true);
    getMap(repostIndex, caller).add(postId, id);
    addNotification(originalPost.author, caller, #repost(postId));

    toPostResponse(repost, ?caller, false);
  };

  public shared ({ caller }) func undoRepost(postId : Nat) : async () {
    requireAuth(caller);
    switch (posts.get(postId)) {
      case (null) { Runtime.trap("Post not found") };
      case (?_) {};
    };
    // Remove from repost tracking
    switch (postReposts.get(postId)) {
      case (?m) { m.remove(caller) };
      case (null) {};
    };
    // Remove the repost post entry via reverse index
    let userReposts = getMap(repostIndex, caller);
    switch (userReposts.get(postId)) {
      case (?repostId) {
        posts.remove(repostId);
        decrementPostCount(caller);
        userReposts.remove(postId);
      };
      case (null) {};
    };
  };

  public shared ({ caller }) func quotePost(postId : Nat, text : Text, mediaHash : ?Storage.ExternalBlob, mediaType : ?Text) : async PostResponse {
    requireAuth(caller);
    validateMedia(mediaHash, mediaType);
    requirePostCapNotReached(caller);
    switch (userProfiles.get(caller)) {
      case (null) { Runtime.trap("Must create profile before quoting") };
      case (?_) {};
    };
    let originalPost = switch (posts.get(postId)) {
      case (?p) { p };
      case (null) { Runtime.trap("Post not found") };
    };
    if (isBlockedBidirectional(caller, originalPost.author)) {
      Runtime.trap("Cannot interact with this user");
    };
    if (text.size() == 0 and mediaHash == null) {
      Runtime.trap("Quote must contain text or media");
    };
    if (text.size() > maxPostLength) {
      Runtime.trap("Quote is too long (20,000 characters max)");
    };
    requireTextQuota(caller, textBytes(text));
    requireChainPublishedForChild(postId);

    let now = Time.now();
    let id = nextPostId;
    nextPostId += 1;

    let quote : Post = {
      id;
      author = caller;
      text;
      mediaHash;
      mediaType;
      postType = #quote(postId);
      createdAt = now;
      editedAt = null;
    };

    posts.add(id, quote);
    addTextBytes(caller, textBytes(text));
    incrementPostCount(caller);
    indexPostHashtags(id, text);
    addNotification(originalPost.author, caller, #quote(postId));
    notifyMentions(text, id, caller);
    inheritGraphRef(postId, id);

    toPostResponse(quote, ?caller, false);
  };

  public query ({ caller }) func searchPosts(searchText : Text, cursor : ?Nat, limit : Nat) : async PaginatedPosts {
    if (searchText == "") {
      return { posts = []; nextCursor = null; hasMore = false };
    };
    let effectiveLimit = if (limit == 0 or limit > 50) { 20 } else { limit };
    let start = switch (cursor) {
      case (?c) { c };
      case (null) { nextPostId };
    };
    let isAnon = caller.isAnonymous();
    let c = if (isAnon) { null } else { ?caller };
    paginatePosts(
      start,
      effectiveLimit,
      c,
      func(post) {
        if (not isAnon and isBlockedBidirectional(caller, post.author)) {
          false;
        } else {
          textContains(post.text, searchText);
        };
      },
    );
  };

  public query ({ caller }) func searchUsers(searchText : Text, limit : Nat) : async [UserProfileResponse] {
    if (searchText == "") {
      return [];
    };
    let effectiveLimit = if (limit == 0 or limit > 50) { 20 } else { limit };
    let results = List.empty<UserProfileResponse>();

    let isAnon = caller.isAnonymous();
    for ((principal, profile) in userProfiles.entries()) {
      if (results.size() >= effectiveLimit) {
        return results.toArray();
      };
      if (not isAnon and isBlockedBidirectional(caller, principal)) {
        // skip
      } else if (textContains(profile.username, searchText) or textContains(profile.displayName, searchText)) {
        switch (buildProfileResponse(principal, caller)) {
          case (?response) { results.add(response) };
          case (null) {};
        };
      };
    };
    results.toArray();
  };

  public query func getTrendingHashtags(limit : Nat) : async [TrendingHashtag] {
    let effectiveLimit = if (limit == 0 or limit > 50) { 10 } else { limit };
    let now = Time.now();
    let windowNanos : Int = 86_400_000_000_000; // 24 hours

    let trending = List.empty<TrendingHashtag>();

    for ((tag, postIds) in hashtagIndex.entries()) {
      var count : Nat = 0;
      for ((postId, _) in postIds.entries()) {
        switch (posts.get(postId)) {
          case (?post) {
            if (now - post.createdAt <= windowNanos) {
              count += 1;
            };
          };
          case (null) {};
        };
      };
      if (count > 0) {
        trending.add({ tag; count });
      };
    };

    trending.sortInPlace(
      func(a, b) {
        if (a.count > b.count) { #less } else if (a.count < b.count) {
          #greater;
        } else { #equal };
      }
    );

    let result = List.empty<TrendingHashtag>();
    for (item in trending.values()) {
      if (result.size() < effectiveLimit) {
        result.add(item);
      };
    };
    result.toArray();
  };

  public query ({ caller }) func getNotifications(cursor : ?Nat, limit : Nat) : async PaginatedNotifications {
    requireAuth(caller);
    let effectiveLimit = if (limit == 0 or limit > 50) { 20 } else { limit };

    let notifs = switch (userNotifications.get(caller)) {
      case (?m) { m };
      case (null) {
        return { notifications = []; nextCursor = null; hasMore = false };
      };
    };

    let idList = List.empty<Nat>();
    for ((id, _) in notifs.entries()) {
      idList.add(id);
    };
    idList.sortInPlace(
      func(a, b) {
        if (a > b) { #less } else if (a < b) { #greater } else { #equal };
      }
    );

    let start = switch (cursor) {
      case (?c) { c };
      case (null) { nextNotificationId };
    };

    let resultBuf = List.empty<Notification>();
    var foundExtra = false;
    for (id in idList.values()) {
      if (not foundExtra and id < start) {
        switch (notifs.get(id)) {
          case (?notif) {
            if (resultBuf.size() < effectiveLimit) {
              resultBuf.add(notif);
            } else {
              foundExtra := true;
            };
          };
          case (null) {};
        };
      };
    };

    let arr = resultBuf.toArray();
    let nextCursor : ?Nat = if (foundExtra and arr.size() > 0) {
      ?arr[arr.size() - 1].id;
    } else {
      null;
    };
    { notifications = arr; nextCursor; hasMore = foundExtra };
  };

  public shared ({ caller }) func markNotificationRead(notifId : Nat) : async () {
    requireAuth(caller);
    markNotifRead(getMap(userNotifications, caller), notifId);
  };

  public shared ({ caller }) func markAllNotificationsRead() : async () {
    requireAuth(caller);
    let notifs = getMap(userNotifications, caller);
    for ((id, _) in notifs.entries()) {
      markNotifRead(notifs, id);
    };
  };

  public query ({ caller }) func getUnreadNotificationCount() : async Nat {
    requireAuth(caller);
    switch (userNotifications.get(caller)) {
      case (null) { 0 };
      case (?notifs) {
        var count : Nat = 0;
        for ((_, notif) in notifs.entries()) {
          if (not notif.isRead) {
            count += 1;
          };
        };
        count;
      };
    };
  };

  // ── Community methods ───────────────────────────────────────────────────────

  // A post created before swarms were captured has no enclosing swarm on record.
  // The author can supply it once, from the same node read the composer uses;
  // after that it is frozen like every other ref field. Without this, every
  // citation that predates the gate could never be published.
  public shared ({ caller }) func setPostSwarm(
    postId : Nat,
    swarmNodeId : Text,
    swarmCreator : ?Principal,
    communityName : ?Text,
  ) : async { #ok; #err : Text } {
    requireAuth(caller);
    let post = switch (posts.get(postId)) {
      case (?p) { p };
      case (null) { return #err("Post not found") };
    };
    if (post.author != caller) { return #err("Only the author can set this") };
    switch (postGraphRefs.get(postId)) {
      case (null) { return #err("Only graph posts have an enclosing swarm") };
      case (?r) {
        if (r.tokenNodeId != null) { return #err("This post is already published") };
      };
    };
    switch (postSwarm.get(postId)) {
      case (?_) { return #ok };
      case (null) {};
    };
    if (swarmNodeId.size() == 0 or swarmNodeId.size() > 600) {
      return #err("swarmNodeId length out of range");
    };
    switch (swarmCreator) {
      case (?p) {
        if (p.isAnonymous()) { return #err("Invalid swarm creator") };
      };
      case (null) {};
    };
    switch (communityName) {
      case (?n) {
        if (n.size() > 400) { return #err("communityName too long") };
      };
      case (null) {};
    };
    postSwarm.add(postId, { swarmNodeId; swarmCreator; communityName });
    #ok;
  };

  func profileNames(p : Principal) : (Text, Text) {
    switch (userProfiles.get(p)) {
      case (?profile) { (profile.username, profile.displayName) };
      case (null) { ("unknown", "Unknown") };
    };
  };

  func messageView(m : CommunityMessage) : CommunityMessageView {
    let (username, displayName) = profileNames(m.author);
    {
      id = m.id;
      communityId = m.communityId;
      author = m.author;
      authorUsername = username;
      authorDisplayName = displayName;
      text = m.text;
      createdAt = m.createdAt;
    };
  };

  func inviteMember(
    c : Community,
    inviter : Principal,
    target : Principal,
  ) : { #ok; #err : Text } {
    if (not isCommunityMember(c.id, inviter)) { return #err("Only members can invite") };
    if (isCommunityMember(c.id, target)) { return #err("Already a member") };
    if (Principal.equal(inviter, target)) { return #err("You are already a member") };
    if (isBlockedBidirectional(inviter, target)) { return #err("Cannot invite this user") };
    if (c.memberCount >= maxCommunityMembers) { return #err("This community is full") };
    let invites = getCommunityInviteMap(c.id);
    if (invites.get(target) != null) { return #err("Already invited") };
    if (invites.size() >= maxCommunityInvites) {
      return #err("Too many pending invites in this community");
    };
    var mine = 0;
    for ((_, inv) in invites.entries()) {
      if (Principal.equal(inv.invitedBy, inviter)) { mine += 1 };
    };
    if (mine >= maxOutstandingInvitesPerMember) {
      return #err(
        "You can have " # maxOutstandingInvitesPerMember.toText() # " pending invites in this community"
      );
    };
    invites.add(target, { invitedBy = inviter; createdAt = Time.now() });
    getInviteIndex(target).add(c.id, true);
    addNotification(target, inviter, #communityInvite(c.id));
    #ok;
  };

  // A mention in a community message is an invite. Mentions of non-members are
  // ignored once the caps are reached; the message itself still posts.
  func inviteMentions(c : Community, inviter : Principal, text : Text) {
    for (username in extractTokens(text, '@').values()) {
      switch (usernameToUser.get(username)) {
        case (?target) {
          if (not isCommunityMember(c.id, target)) {
            ignore inviteMember(c, inviter, target);
          };
        };
        case (null) {};
      };
    };
  };

  public query ({ caller }) func getMyCommunities() : async [CommunityView] {
    let out = List.empty<CommunityView>();
    switch (memberCommunities.get(caller)) {
      case (?ids) {
        for ((id, _) in ids.entries()) {
          switch (communities.get(id)) {
            case (?c) { out.add(communityViewOf(c, caller)) };
            case (null) {};
          };
        };
      };
      case (null) {};
    };
    out.toArray();
  };

  public query ({ caller }) func getMyCommunityInvites() : async [CommunityView] {
    let out = List.empty<CommunityView>();
    switch (inviteIndex.get(caller)) {
      case (?ids) {
        for ((id, _) in ids.entries()) {
          switch (communities.get(id)) {
            case (?c) { out.add(communityViewOf(c, caller)) };
            case (null) {};
          };
        };
      };
      case (null) {};
    };
    out.toArray();
  };

  // Visible to members and invitees only: the chat is not public.
  public query ({ caller }) func getCommunity(communityId : Text) : async ?CommunityView {
    switch (communities.get(communityId)) {
      case (?c) {
        let invited = switch (communityInvites.get(c.id)) {
          case (?m) { m.get(caller) != null };
          case (null) { false };
        };
        if (not isCommunityMember(c.id, caller) and not invited) { return null };
        ?communityViewOf(c, caller);
      };
      case (null) { null };
    };
  };

  public query ({ caller }) func getCommunityMessages(
    communityId : Text,
    cursor : ?Nat,
    limit : Nat,
  ) : async PaginatedMessages {
    let empty : PaginatedMessages = {
      messages = [];
      nextCursor = null;
      hasMore = false;
    };
    if (not isCommunityMember(communityId, caller)) { return empty };
    let store = switch (communityMessages.get(communityId)) {
      case (?m) { m };
      case (null) { return empty };
    };
    let effectiveLimit = if (limit == 0 or limit > 50) { 20 } else { limit };
    let upper = switch (cursor) {
      case (?c) { c };
      case (null) { nextCommunityMessageId };
    };
    let ids = List.empty<Nat>();
    for ((id, _) in store.entries()) {
      if (id < upper) { ids.add(id) };
    };
    let arr = ids.toArray();
    let total = arr.size();
    let startIndex = if (total <= effectiveLimit) { 0 } else { total - effectiveLimit };
    let out = List.empty<CommunityMessageView>();
    var i = total;
    while (i > startIndex) {
      i -= 1;
      switch (store.get(arr[i])) {
        case (?m) { out.add(messageView(m)) };
        case (null) {};
      };
    };
    {
      messages = out.toArray();
      nextCursor = if (startIndex > 0) { ?arr[startIndex] } else { null };
      hasMore = startIndex > 0;
    };
  };

  public shared ({ caller }) func sendCommunityMessage(
    communityId : Text,
    text : Text,
  ) : async { #ok : CommunityMessageView; #err : Text } {
    requireAuth(caller);
    let c = switch (communities.get(communityId)) {
      case (?c) { c };
      case (null) { return #err("Community not found") };
    };
    if (not isCommunityMember(c.id, caller)) {
      return #err("Join this community before posting in it");
    };
    if (text.size() == 0) { return #err("Message is empty") };
    if (text.size() > maxMessageLength) {
      return #err("Message is too long (" # maxMessageLength.toText() # " characters max)");
    };
    let store = getCommunityMessageMap(c.id);
    if (store.size() >= maxMessagesPerCommunity) {
      return #err("This community has reached its message limit");
    };
    let id = nextCommunityMessageId;
    nextCommunityMessageId += 1;
    let now = Time.now();
    let msg : CommunityMessage = {
      id;
      communityId = c.id;
      author = caller;
      text;
      createdAt = now;
    };
    store.add(id, msg);
    communities.add(c.id, { c with lastMessageAt = ?now });
    inviteMentions(c, caller, text);
    #ok(messageView(msg));
  };

  public shared ({ caller }) func inviteToCommunity(
    communityId : Text,
    target : Principal,
  ) : async { #ok; #err : Text } {
    requireAuth(caller);
    if (target.isAnonymous()) { return #err("Invalid user") };
    let c = switch (communities.get(communityId)) {
      case (?c) { c };
      case (null) { return #err("Community not found") };
    };
    inviteMember(c, caller, target);
  };

  public shared ({ caller }) func acceptCommunityInvite(
    communityId : Text,
  ) : async { #ok : CommunityView; #err : Text } {
    requireAuth(caller);
    let c = switch (communities.get(communityId)) {
      case (?c) { c };
      case (null) { return #err("Community not found") };
    };
    let invites = switch (communityInvites.get(c.id)) {
      case (?m) { m };
      case (null) { return #err("No invite for this community") };
    };
    if (invites.get(caller) == null) { return #err("No invite for this community") };
    if (c.memberCount >= maxCommunityMembers) { return #err("This community is full") };
    let updated = addCommunityMember(c, caller);
    #ok(communityViewOf(updated, caller));
  };

  public shared ({ caller }) func declineCommunityInvite(communityId : Text) : async () {
    requireAuth(caller);
    switch (communityInvites.get(communityId)) {
      case (?m) { m.remove(caller) };
      case (null) {};
    };
    switch (inviteIndex.get(caller)) {
      case (?m) { m.remove(communityId) };
      case (null) {};
    };
  };

  public query ({ caller }) func getCommunityMembers(
    communityId : Text,
    offset : Nat,
    limit : Nat,
  ) : async {
    members : [CommunityMemberView];
    nextOffset : ?Nat;
    hasMore : Bool;
  } {
    let empty = { members = []; nextOffset = null; hasMore = false };
    if (not isCommunityMember(communityId, caller)) { return empty };
    let c = switch (communities.get(communityId)) {
      case (?c) { c };
      case (null) { return empty };
    };
    let effectiveLimit = if (limit == 0 or limit > 100) { 50 } else { limit };
    let all = List.empty<CommunityMemberView>();
    switch (communityMembers.get(communityId)) {
      case (?m) {
        for ((p, _) in m.entries()) {
          let (username, displayName) = profileNames(p);
          all.add({
            principal = p;
            username;
            displayName;
            isCreator = Principal.equal(c.creator, p);
          });
        };
      };
      case (null) {};
    };
    // Map order is key order (principal), which is stable across calls; sorting
    // by username would need a mutable array for an at-most-150 list.
    let sorted = all.toArray();
    let total = sorted.size();
    let start = if (offset >= total) { total } else { offset };
    let end = if (start + effectiveLimit > total) { total } else { start + effectiveLimit };
    {
      members = sorted.sliceToArray(start, end);
      nextOffset = if (end < total) { ?end } else { null };
      hasMore = end < total;
    };
  };
};

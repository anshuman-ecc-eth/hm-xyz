import Map "mo:core/Map";
import Time "mo:core/Time";
import Storage "mo:caffeineai-object-storage/Storage";
import AccessControl "mo:caffeineai-authorization/access-control";

// Bridges the deployed 20261122 state to inline citations and profile pins.
// OldActor is exactly the codomain of 20261122_040245, which is deployed and
// frozen; this build adds the postCitations and pinnedPosts maps.
module {
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

  // Deployed shape (six cases) and the shape this build introduces.
  type OldNotificationType = {
    #like : Nat;
    #reply : Nat;
    #mention : Nat;
    #follow;
    #repost : Nat;
    #quote : Nat;
  };

  type NotificationType = {
    #like : Nat;
    #reply : Nat;
    #mention : Nat;
    #follow;
    #repost : Nat;
    #quote : Nat;
    #communityInvite : Text;
  };

  type OldNotification = {
    id : Nat;
    notificationType : OldNotificationType;
    actorPrincipal : Principal;
    actorUsername : Text;
    createdAt : Time.Time;
    isRead : Bool;
  };

  type Notification = {
    id : Nat;
    notificationType : NotificationType;
    actorPrincipal : Principal;
    actorUsername : Text;
    createdAt : Time.Time;
    isRead : Bool;
  };

  type GraphRef = {
    graphId : Text;
    graphName : Text;
    nodeId : Text;
    nodeName : Text;
    nodeType : Text;
    path : Text;
    attachedAt : Time.Time;
    hiddenAt : ?Time.Time;
    tokenNodeId : ?Text;
  };

  type LinkState = {
    appPrincipal : Principal;
    displayName : ?Text;
    linkedAt : Time.Time;
  };

  // Deployed ref shape, and the shape with the enclosing swarm captured.
  type OldGraphRefInput = {
    graphId : Text;
    graphName : Text;
    nodeId : Text;
    nodeName : Text;
    nodeType : Text;
    path : Text;
  };

  type GraphRefInput = {
    graphId : Text;
    graphName : Text;
    nodeId : Text;
    nodeName : Text;
    nodeType : Text;
    path : Text;
    swarmNodeId : ?Text;
    swarmCreator : ?Principal;
    communityName : ?Text;
  };

  type CitationRef = {
    graphId : Text;
    nodeId : Text;
    nodeName : Text;
    nodeType : Text;
    path : Text;
  };

  type SwarmCapture = {
    swarmNodeId : Text;
    swarmCreator : ?Principal;
    communityName : ?Text;
  };

  type Community = {
    id : Text;
    graphId : Text;
    name : Text;
    creator : Principal;
    createdAt : Time.Time;
    memberCount : Nat;
    lastMessageAt : ?Time.Time;
  };

  type CommunityMember = { joinedAt : Time.Time };

  type CommunityInvite = {
    invitedBy : Principal;
    createdAt : Time.Time;
  };

  type CommunityMessage = {
    id : Nat;
    communityId : Text;
    author : Principal;
    text : Text;
    createdAt : Time.Time;
  };

  type XyzSourceRef = { name : Text; url : Text };

  type ChainLevel = {
    nodeType : Text;
    name : Text;
    tags : [Text];
    attributes : [(Text, [Text])];
    sources : [XyzSourceRef];
  };

  type OldChainSpec = {
    start : ?OldGraphRefInput;
    levels : [ChainLevel];
  };

  type ChainSpec = {
    start : ?GraphRefInput;
    levels : [ChainLevel];
  };

  type OldActor = {
    accessControlState : AccessControl.AccessControlState;
    userProfiles : Map.Map<Principal, UserProfile>;
    usernameToUser : Map.Map<Text, Principal>;
    posts : Map.Map<Nat, Post>;
    userPostCounts : Map.Map<Principal, Nat>;
    var nextPostId : Nat;
    following : Map.Map<Principal, Map.Map<Principal, Bool>>;
    followers : Map.Map<Principal, Map.Map<Principal, Bool>>;
    blocks : Map.Map<Principal, Map.Map<Principal, Bool>>;
    mutes : Map.Map<Principal, Map.Map<Principal, Bool>>;
    postLikes : Map.Map<Nat, Map.Map<Principal, Bool>>;
    postReplies : Map.Map<Nat, Map.Map<Nat, Bool>>;
    postReposts : Map.Map<Nat, Map.Map<Principal, Bool>>;
    repostIndex : Map.Map<Principal, Map.Map<Nat, Nat>>;
    hashtagIndex : Map.Map<Text, Map.Map<Nat, Bool>>;
    userNotifications : Map.Map<Principal, Map.Map<Nat, Notification>>;
    var nextNotificationId : Nat;
    postGraphRefs : Map.Map<Nat, GraphRef>;
    graphNodePosts : Map.Map<Text, Map.Map<Text, Map.Map<Nat, Bool>>>;
    postDislikes : Map.Map<Nat, Map.Map<Principal, Bool>>;
    linkByXyz : Map.Map<Principal, LinkState>;
    appToXyz : Map.Map<Principal, Principal>;
    postChains : Map.Map<Nat, ChainSpec>;
    userTextBytes : Map.Map<Principal, Nat>;
    communities : Map.Map<Text, Community>;
    communityMembers : Map.Map<Text, Map.Map<Principal, CommunityMember>>;
    memberCommunities : Map.Map<Principal, Map.Map<Text, Bool>>;
    communityInvites : Map.Map<Text, Map.Map<Principal, CommunityInvite>>;
    inviteIndex : Map.Map<Principal, Map.Map<Text, Bool>>;
    communityMessages : Map.Map<Text, Map.Map<Nat, CommunityMessage>>;
    var nextCommunityMessageId : Nat;
    postSwarm : Map.Map<Nat, SwarmCapture>;
  };

  type NewActor = {
    accessControlState : AccessControl.AccessControlState;
    userProfiles : Map.Map<Principal, UserProfile>;
    usernameToUser : Map.Map<Text, Principal>;
    posts : Map.Map<Nat, Post>;
    userPostCounts : Map.Map<Principal, Nat>;
    pinnedPosts : Map.Map<Principal, Nat>;
    var nextPostId : Nat;
    following : Map.Map<Principal, Map.Map<Principal, Bool>>;
    followers : Map.Map<Principal, Map.Map<Principal, Bool>>;
    blocks : Map.Map<Principal, Map.Map<Principal, Bool>>;
    mutes : Map.Map<Principal, Map.Map<Principal, Bool>>;
    postLikes : Map.Map<Nat, Map.Map<Principal, Bool>>;
    postReplies : Map.Map<Nat, Map.Map<Nat, Bool>>;
    postReposts : Map.Map<Nat, Map.Map<Principal, Bool>>;
    repostIndex : Map.Map<Principal, Map.Map<Nat, Nat>>;
    hashtagIndex : Map.Map<Text, Map.Map<Nat, Bool>>;
    userNotifications : Map.Map<Principal, Map.Map<Nat, Notification>>;
    var nextNotificationId : Nat;
    postGraphRefs : Map.Map<Nat, GraphRef>;
    postCitations : Map.Map<Nat, [CitationRef]>;
    graphNodePosts : Map.Map<Text, Map.Map<Text, Map.Map<Nat, Bool>>>;
    postDislikes : Map.Map<Nat, Map.Map<Principal, Bool>>;
    linkByXyz : Map.Map<Principal, LinkState>;
    appToXyz : Map.Map<Principal, Principal>;
    postChains : Map.Map<Nat, ChainSpec>;
    userTextBytes : Map.Map<Principal, Nat>;
    communities : Map.Map<Text, Community>;
    communityMembers : Map.Map<Text, Map.Map<Principal, CommunityMember>>;
    memberCommunities : Map.Map<Principal, Map.Map<Text, Bool>>;
    communityInvites : Map.Map<Text, Map.Map<Principal, CommunityInvite>>;
    inviteIndex : Map.Map<Principal, Map.Map<Text, Bool>>;
    communityMessages : Map.Map<Text, Map.Map<Nat, CommunityMessage>>;
    var nextCommunityMessageId : Nat;
    postSwarm : Map.Map<Nat, SwarmCapture>;
  };

  public func migration(old : OldActor) : NewActor {
    {
      accessControlState = old.accessControlState;
      userProfiles = old.userProfiles;
      usernameToUser = old.usernameToUser;
      posts = old.posts;
      userPostCounts = old.userPostCounts;
      pinnedPosts = Map.empty();
      var nextPostId = old.nextPostId;
      following = old.following;
      followers = old.followers;
      blocks = old.blocks;
      mutes = old.mutes;
      postLikes = old.postLikes;
      postReplies = old.postReplies;
      postReposts = old.postReposts;
      repostIndex = old.repostIndex;
      hashtagIndex = old.hashtagIndex;
      userNotifications = old.userNotifications;
      var nextNotificationId = old.nextNotificationId;
      postGraphRefs = old.postGraphRefs;
      postCitations = Map.empty();
      graphNodePosts = old.graphNodePosts;
      postDislikes = old.postDislikes;
      linkByXyz = old.linkByXyz;
      appToXyz = old.appToXyz;
      postChains = old.postChains;
      userTextBytes = old.userTextBytes;
      communities = old.communities;
      communityMembers = old.communityMembers;
      memberCommunities = old.memberCommunities;
      communityInvites = old.communityInvites;
      inviteIndex = old.inviteIndex;
      communityMessages = old.communityMessages;
      var nextCommunityMessageId = old.nextCommunityMessageId;
      postSwarm = old.postSwarm;
    };
  };
};

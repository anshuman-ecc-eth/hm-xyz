import Map "mo:core/Map";
import Time "mo:core/Time";
import Storage "mo:caffeineai-object-storage/Storage";
import AccessControl "mo:caffeineai-authorization/access-control";

// Adds chain posts (1-4 new ancestors below a curation, swarm or location, or a
// whole new curation) and the per-account text budget. OldActor is exactly the
// codomain of 20261119_090000, which is deployed and frozen.
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

  // Deployed shape (six cases) and the shape this build introduces. Adding a
  // variant constructor is stable-safe, but the migration must still widen the
  // stored values explicitly, so both types are inlined here.
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
    userNotifications : Map.Map<Principal, Map.Map<Nat, OldNotification>>;
    var nextNotificationId : Nat;
    postGraphRefs : Map.Map<Nat, GraphRef>;
    graphNodePosts : Map.Map<Text, Map.Map<Text, Map.Map<Nat, Bool>>>;
    postDislikes : Map.Map<Nat, Map.Map<Principal, Bool>>;
    linkByXyz : Map.Map<Principal, LinkState>;
    appToXyz : Map.Map<Principal, Principal>;
  };

  type NewActor = {
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

  public func migration(old : OldActor) : NewActor {
    {
      accessControlState = old.accessControlState;
      userProfiles = old.userProfiles;
      usernameToUser = old.usernameToUser;
      posts = old.posts;
      userPostCounts = old.userPostCounts;
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
      userNotifications = old.userNotifications.map(
        func(_p : Principal, inner : Map.Map<Nat, OldNotification>) : Map.Map<Nat, Notification> {
          inner.map(
            func(_id : Nat, n : OldNotification) : Notification {
              { n with notificationType = n.notificationType : NotificationType }
            }
          )
        }
      );
      var nextNotificationId = old.nextNotificationId;
      postGraphRefs = old.postGraphRefs;
      graphNodePosts = old.graphNodePosts;
      postDislikes = old.postDislikes;
      linkByXyz = old.linkByXyz;
      appToXyz = old.appToXyz;
      postChains = Map.empty();
      userTextBytes = Map.empty();
      communities = Map.empty();
      communityMembers = Map.empty();
      memberCommunities = Map.empty();
      communityInvites = Map.empty();
      inviteIndex = Map.empty();
      communityMessages = Map.empty();
      var nextCommunityMessageId = 0;
      postSwarm = Map.empty();
    };
  };
};

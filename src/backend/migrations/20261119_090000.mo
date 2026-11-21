import Map "mo:core/Map";
import Time "mo:core/Time";
import Storage "mo:caffeineai-object-storage/Storage";
import AccessControl "mo:caffeineai-authorization/access-control";

// Adds the principal link plus chain posts: one .xyz account per .app account
// stored in both directions, and 1-4 new chain ancestors declared by a post.
// OldActor is exactly the codomain of the previous entry (20261119_000000),
// which is deployed and therefore frozen. This file is still pending, so both
// changes are folded into it.
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

  type NotificationType = {
    #like : Nat;
    #reply : Nat;
    #mention : Nat;
    #follow;
    #repost : Nat;
    #quote : Nat;
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

  // New in this version.
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
    userNotifications : Map.Map<Principal, Map.Map<Nat, Notification>>;
    var nextNotificationId : Nat;
    postGraphRefs : Map.Map<Nat, GraphRef>;
    graphNodePosts : Map.Map<Text, Map.Map<Text, Map.Map<Nat, Bool>>>;
    postDislikes : Map.Map<Nat, Map.Map<Principal, Bool>>;
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
      userNotifications = old.userNotifications;
      var nextNotificationId = old.nextNotificationId;
      postGraphRefs = old.postGraphRefs;
      graphNodePosts = old.graphNodePosts;
      postDislikes = old.postDislikes;
      linkByXyz = Map.empty();
      appToXyz = Map.empty();
      postChains = Map.empty();
      userTextBytes = Map.empty();
    };
  };
};

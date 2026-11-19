import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
import type { ExternalBlob } from "@caffeineai/object-storage";
export type { ExternalBlob } from "@caffeineai/object-storage";
export interface AppLinkPreview {
    expiresAt: Time;
    appPrincipal: Principal;
    displayName?: string;
}
export type Error_ = {
    __kind__: "FrontendOriginsNotConfigured";
    FrontendOriginsNotConfigured: null;
} | {
    __kind__: "MixedSsoSources";
    MixedSsoSources: {
        otherKeys: Array<string>;
        ssoKeys: Array<string>;
    };
} | {
    __kind__: "Stale";
    Stale: {
        ageNs: bigint;
    };
} | {
    __kind__: "MalformedCandid";
    MalformedCandid: null;
} | {
    __kind__: "AmbiguousAttribute";
    AmbiguousAttribute: {
        field: string;
        sources: Array<string>;
    };
} | {
    __kind__: "NoAttributes";
    NoAttributes: null;
} | {
    __kind__: "UnknownNonce";
    UnknownNonce: null;
} | {
    __kind__: "UntrustedSsoSource";
    UntrustedSsoSource: {
        domain: string;
    };
} | {
    __kind__: "MissingField";
    MissingField: string;
} | {
    __kind__: "FrontendOriginMismatch";
    FrontendOriginMismatch: {
        got: string;
        expected: Array<string>;
    };
};
export interface FollowUserResponse {
    principal: Principal;
    username: string;
    displayName: string;
    profilePictureHash?: ExternalBlob;
}
export interface GraphRef {
    hiddenAt?: Time;
    nodeId: string;
    path: string;
    graphId: string;
    tokenNodeId?: string;
    attachedAt: Time;
    nodeName: string;
    nodeType: string;
    graphName: string;
}
export interface GraphRefInput {
    nodeId: string;
    path: string;
    graphId: string;
    nodeName: string;
    nodeType: string;
    graphName: string;
}
export type LinkResult = {
    __kind__: "ok";
    ok: LinkState;
} | {
    __kind__: "err";
    err: string;
};
export interface LinkState {
    linkedAt: Time;
    appPrincipal: Principal;
    displayName?: string;
}
export interface Notification {
    id: bigint;
    notificationType: NotificationType;
    createdAt: Time;
    isRead: boolean;
    actorUsername: string;
    actorPrincipal: Principal;
}
export type NotificationType = {
    __kind__: "repost";
    repost: bigint;
} | {
    __kind__: "like";
    like: bigint;
} | {
    __kind__: "quote";
    quote: bigint;
} | {
    __kind__: "mention";
    mention: bigint;
} | {
    __kind__: "reply";
    reply: bigint;
} | {
    __kind__: "follow";
    follow: null;
};
export interface PaginatedFollows {
    nextOffset?: bigint;
    hasMore: boolean;
    users: Array<FollowUserResponse>;
}
export interface PaginatedGraphPosts {
    nodeWeight: bigint;
    hasMore: boolean;
    contributionCount: bigint;
    tokenCount: bigint;
    posts: Array<PostResponse>;
    nextCursor?: bigint;
}
export interface PaginatedNotifications {
    hasMore: boolean;
    notifications: Array<Notification>;
    nextCursor?: bigint;
}
export interface PaginatedPosts {
    hasMore: boolean;
    posts: Array<PostResponse>;
    nextCursor?: bigint;
}
export interface PostResponse {
    id: bigint;
    dislikeCount: bigint;
    weight?: bigint;
    postType: PostType;
    graphRef?: GraphRef;
    authorUsername: string;
    likeCount: bigint;
    isRepostedByCurrentUser: boolean;
    authorProfilePictureHash?: ExternalBlob;
    repostCount: bigint;
    createdAt: Time;
    text: string;
    canEdit: boolean;
    author: Principal;
    mediaHash?: ExternalBlob;
    replyCount: bigint;
    mediaType?: string;
    canDelete: boolean;
    isDislikedByCurrentUser: boolean;
    editedAt?: Time;
    authorDisplayName: string;
    isLikedByCurrentUser: boolean;
}
export type PostType = {
    __kind__: "repost";
    repost: bigint;
} | {
    __kind__: "quote";
    quote: bigint;
} | {
    __kind__: "original";
    original: null;
} | {
    __kind__: "reply";
    reply: bigint;
};
export type Result = {
    __kind__: "ok";
    ok: null;
} | {
    __kind__: "err";
    err: Error_;
};
export type Time = bigint;
export interface TrendingHashtag {
    tag: string;
    count: bigint;
}
export interface UserProfile {
    bio: string;
    username: string;
    displayName: string;
    createdAt: Time;
    updatedAt: Time;
    headerImageHash?: ExternalBlob;
    profilePictureHash?: ExternalBlob;
}
export interface UserProfileResponse {
    bio: string;
    isBlockedByCurrentUser: boolean;
    principal: Principal;
    username: string;
    displayName: string;
    isMutedByCurrentUser: boolean;
    followersCount: bigint;
    createdAt: Time;
    updatedAt: Time;
    headerImageHash?: ExternalBlob;
    followingCount: bigint;
    isFollowedByCurrentUser: boolean;
    profilePictureHash?: ExternalBlob;
    postsCount: bigint;
}
export interface XyzCommitOk {
    costText: string;
    cost: bigint;
    path: Array<string>;
    interpNodeId: string;
    revision: bigint;
    publishedGraphId: string;
}
export type XyzCommitOutcome = {
    __kind__: "ok";
    ok: XyzCommitOk;
} | {
    __kind__: "err";
    err: {
        kind: XyzErrKind;
        message: string;
    };
} | {
    __kind__: "conflict";
    conflict: {
        message: string;
    };
} | {
    __kind__: "busy";
    busy: {
        message: string;
    };
} | {
    __kind__: "blocked";
    blocked: {
        plan: XyzPlan;
        pathCreators: Array<XyzPathCreator>;
        message: string;
        reason: string;
    };
} | {
    __kind__: "notLinked";
    notLinked: {
        writerXyz: Principal;
        message: string;
    };
} | {
    __kind__: "stale";
    stale: {
        plan: XyzPlan;
        message: string;
    };
} | {
    __kind__: "notFound";
    notFound: {
        message: string;
        writeId: string;
    };
} | {
    __kind__: "alreadyPublished";
    alreadyPublished: {
        interpNodeId: string;
    };
} | {
    __kind__: "insufficient";
    insufficient: {
        topUpPath: string;
        plan: XyzPlan;
        message: string;
    };
} | {
    __kind__: "unknown";
    unknown: {
        message: string;
        writeId: string;
    };
};
export interface XyzPathCreator {
    appPrincipal: Principal;
    displayName?: string;
    linked: boolean;
}
export interface XyzPlan {
    creates: bigint;
    balance: bigint;
    costText: string;
    cost: bigint;
    pathCreators: Array<XyzPathCreator>;
    lines: Array<string>;
    balanceText: string;
    digest: string;
    revision: bigint;
    rootCuration: string;
    publishedGraphId?: string;
}
export type XyzPreviewResult = {
    __kind__: "err";
    err: {
        kind: XyzErrKind;
        message: string;
    };
} | {
    __kind__: "blocked";
    blocked: {
        plan: XyzPlan;
        pathCreators: Array<XyzPathCreator>;
        message: string;
        reason: string;
    };
} | {
    __kind__: "notLinked";
    notLinked: {
        writerXyz: Principal;
        message: string;
    };
} | {
    __kind__: "insufficient";
    insufficient: {
        topUpPath: string;
        plan: XyzPlan;
        message: string;
    };
} | {
    __kind__: "throttled";
    throttled: {
        retryAfterMs: bigint;
    };
} | {
    __kind__: "ready";
    ready: {
        plan: XyzPlan;
        message: string;
    };
};
export interface XyzWriteDraft {
    title?: string;
    costText: string;
    canPublish: boolean;
    costTenths: bigint;
    writeId: string;
    tokenNodeId?: string;
    nodeType: string;
    reason?: string;
    postId: bigint;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export enum XyzErrKind {
    malformed = "malformed",
    internal = "internal"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    blockUser(user: Principal): Promise<void>;
    checkUsernameAvailability(username: string): Promise<boolean>;
    commitXyzWriteForPost(postId: bigint, expectedDigest: string): Promise<XyzCommitOutcome>;
    confirmAppLink(code: string): Promise<LinkResult>;
    createGraphPost(ref: GraphRefInput, text: string, mediaHash: ExternalBlob | null, mediaType: string | null): Promise<PostResponse>;
    createPost(text: string, mediaHash: ExternalBlob | null, mediaType: string | null): Promise<PostResponse>;
    createReply(parentPostId: bigint, text: string, mediaHash: ExternalBlob | null, mediaType: string | null): Promise<PostResponse>;
    deletePost(postId: bigint): Promise<void>;
    dislikePost(postId: bigint): Promise<void>;
    editPost(postId: bigint, text: string): Promise<PostResponse>;
    followUser(user: Principal): Promise<void>;
    getAppBackend(): Promise<string>;
    getCallerUserRole(): Promise<UserRole>;
    getFollowers(username: string, offset: bigint, limit: bigint): Promise<PaginatedFollows>;
    getFollowing(username: string, offset: bigint, limit: bigint): Promise<PaginatedFollows>;
    getGlobalFeed(cursor: bigint | null, limit: bigint): Promise<PaginatedPosts>;
    getHomeFeed(cursor: bigint | null, limit: bigint): Promise<PaginatedPosts>;
    getMyAppLink(): Promise<LinkState | null>;
    getNotifications(cursor: bigint | null, limit: bigint): Promise<PaginatedNotifications>;
    getPost(postId: bigint): Promise<PostResponse | null>;
    getPostsByGraphNode(graphId: string, nodeId: string, cursor: bigint | null, limit: bigint): Promise<PaginatedGraphPosts>;
    getPostsByHashtag(tag: string, cursor: bigint | null, limit: bigint): Promise<PaginatedPosts>;
    getPostsByUser(user: Principal, cursor: bigint | null, limit: bigint): Promise<PaginatedPosts>;
    getPostsByUsername(username: string, cursor: bigint | null, limit: bigint): Promise<PaginatedPosts>;
    getPrincipalByUsername(username: string): Promise<Principal | null>;
    getProfile(): Promise<UserProfile | null>;
    getProfileByUsername(username: string): Promise<UserProfileResponse | null>;
    getReplies(postId: bigint, cursor: bigint | null, limit: bigint): Promise<PaginatedPosts>;
    getTrendingHashtags(limit: bigint): Promise<Array<TrendingHashtag>>;
    getUnreadNotificationCount(): Promise<bigint>;
    getUserProfile(user: Principal): Promise<UserProfileResponse | null>;
    getXyzWriteDraft(postId: bigint): Promise<XyzWriteDraft | null>;
    isCallerAdmin(): Promise<boolean>;
    likePost(postId: bigint): Promise<void>;
    markAllNotificationsRead(): Promise<void>;
    markNotificationRead(notifId: bigint): Promise<void>;
    muteUser(user: Principal): Promise<void>;
    previewXyzWriteForPost(postId: bigint): Promise<XyzPreviewResult>;
    quotePost(postId: bigint, text: string, mediaHash: ExternalBlob | null, mediaType: string | null): Promise<PostResponse>;
    reconcileAppLink(): Promise<{
        __kind__: "ok";
        ok: LinkState | null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    reconcileXyzWriteForPost(postId: bigint): Promise<XyzCommitOutcome>;
    repostPost(postId: bigint): Promise<PostResponse>;
    resolveAppLinkCode(code: string): Promise<{
        __kind__: "ok";
        ok: AppLinkPreview;
    } | {
        __kind__: "err";
        err: string;
    }>;
    searchPosts(searchText: string, cursor: bigint | null, limit: bigint): Promise<PaginatedPosts>;
    searchUsers(searchText: string, limit: bigint): Promise<Array<UserProfileResponse>>;
    setProfile(username: string, displayName: string, bio: string): Promise<void>;
    unblockUser(user: Principal): Promise<void>;
    undislikePost(postId: bigint): Promise<void>;
    undoRepost(postId: bigint): Promise<void>;
    unfollowUser(user: Principal): Promise<void>;
    unlikePost(postId: bigint): Promise<void>;
    unlinkAppAccount(): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    unmuteUser(user: Principal): Promise<void>;
    updateHeaderImage(imageHash: ExternalBlob | null): Promise<void>;
    updateProfilePicture(pictureHash: ExternalBlob | null): Promise<void>;
}

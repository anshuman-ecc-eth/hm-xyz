import type { Principal } from "@icp-sdk/core/principal";
import type { ChainView, CitationRef, ExternalBlob } from "../backend";

export type PostType =
  | { original: null }
  | { reply: bigint }
  | { repost: bigint }
  | { quote: bigint };

export interface GraphRef {
  graphId: string;
  graphName: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  path: string;
  attachedAt: bigint;
  hiddenAt?: bigint;
  tokenNodeId?: string;
}

export interface Post {
  id: bigint;
  author: Principal;
  authorUsername: string;
  authorDisplayName: string;
  authorProfilePictureHash?: ExternalBlob;
  text: string;
  mediaHash?: ExternalBlob;
  mediaType?: string;
  postType: PostType;
  createdAt: bigint;
  editedAt?: bigint;
  likeCount: bigint;
  replyCount: bigint;
  repostCount: bigint;
  isLikedByCurrentUser: boolean;
  isRepostedByCurrentUser: boolean;
  graphRef?: GraphRef;
  chain?: ChainView;
  citations?: CitationRef[];
  textTruncated?: boolean;
  weight?: bigint;
  dislikeCount?: bigint;
  isDislikedByCurrentUser?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export interface PaginatedPosts {
  posts: Post[];
  nextCursor?: bigint;
  hasMore: boolean;
}

export interface FollowUserResponse {
  principal: Principal;
  username: string;
  displayName: string;
  profilePictureHash?: ExternalBlob;
}

export interface PaginatedFollows {
  users: FollowUserResponse[];
  nextOffset?: bigint;
  hasMore: boolean;
}

export interface UserProfileResponse {
  principal: Principal;
  username: string;
  displayName: string;
  bio: string;
  profilePictureHash?: ExternalBlob;
  headerImageHash?: ExternalBlob;
  createdAt: bigint;
  updatedAt: bigint;
  followersCount: bigint;
  followingCount: bigint;
  postsCount: bigint;
  pinnedPostId?: bigint;
  isFollowedByCurrentUser: boolean;
  isBlockedByCurrentUser: boolean;
  isMutedByCurrentUser: boolean;
}

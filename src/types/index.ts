import { NavigatorScreenParams } from '@react-navigation/native';

// User & Authentication
export interface User {
  id: string;
  email: string;
  username: string;
  fullName?: string;
  photoUrl?: string;
  bio?: string;
  isAvailable: boolean;
  availabilityExpiresAt?: string;
  hasBoard: boolean;
  fideId?: string;
  fideRating?: number;
  chessCom?: ChessRating;
  lichess?: ChessRating;
  linkedAccounts?: LinkedAccount[];
  createdAt: string;
  lastLogin?: string;
}

export interface ChessRating {
  username?: string;
  url?: string;
  rating?: number;
}

// External chess account: Lichess (verified via OAuth) or chess.com
// (username only, unverified until chess.com OAuth is available)
export type LinkedPlatform = 'lichess' | 'chesscom';

export interface PlatformRating {
  category: string; // bullet, blitz, rapid, classical, correspondence, daily, ...
  rating: number;
  best?: number; // peak rating (chess.com only)
  games: number;
  provisional: boolean;
  progress?: number;
}

export interface LinkedAccount {
  platform: LinkedPlatform;
  username: string;
  profileUrl: string;
  title?: string;
  verified: boolean;
  ratings: PlatformRating[];
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  memberSince?: string;
  lastSeenAt?: string;
  connectedAt: string;
  lastSyncedAt: string;
}

export interface LichessAuthorizeResponse {
  authorizeUrl: string;
  state: string;
}

export interface UserPublicProfile {
  id: string;
  username: string;
  fullName?: string;
  photoUrl?: string;
  bio?: string;
  hasBoard: boolean;
  fideRating?: number;
  chessComRating?: number;
  lichessRating?: number;
  linkedAccounts?: LinkedAccount[];
}

// Authentication
export interface AuthResponse {
  userId: string;
  email: string;
  username: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  fullName?: string;
}

export interface UpdateProfileRequest {
  fullName?: string;
  bio?: string;
  hasBoard?: boolean;
  fideId?: string;
  fideRating?: number;
}

// Location & Availability
export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface SetAvailabilityRequest {
  isAvailable: boolean;
  latitude: number;
  longitude: number;
  hasBoard: boolean;
  expiresInHours?: number;
}

export interface SetAvailabilityResponse {
  isAvailable: boolean;
  expiresAt: string;
  location: Location;
}

// Nearby Users
export interface NearbyUser extends UserPublicProfile {
  distanceKm: number;
}

export interface NearbyUsersResponse {
  // Where distances were measured from: your last beacon
  center?: { latitude: number; longitude: number };
  users: NearbyUser[];
  count: number;
}

// Gatherings: someone hosts a meetup at a venue for a time window, people
// nearby ask to join, and one approval from anyone already in it lets them in.
// The app arranges the meetup only; it never tracks games or results.
export type GatheringStatus = 'open' | 'gathered' | 'ended' | 'cancelled';

export interface GatheringPerson {
  id: string;
  username: string;
  fullName?: string;
  photoUrl?: string;
  hasBoard: boolean;
  fideRating?: number;
  chessComRating?: number;
  lichessRating?: number;
}

export interface Gathering {
  id: string;
  host: GatheringPerson;
  status: GatheringStatus;
  startsAt: string;
  endsAt: string;
  note?: string;
  // Only members see the venue and its exact point
  venueName?: string;
  location?: Location;
  approximateLocation: Location;
  distanceKm?: number;
  members: GatheringPerson[];
  memberCount: number;
  isMember: boolean;
  isHost: boolean;
  myPendingRequestId?: string;
  // Ended gatherings only: the people you've already reviewed
  reviewedByMe?: string[];
  createdAt: string;
}

export interface GatheringsResponse {
  gatherings: Gathering[];
  count: number;
}

export interface CreateGatheringRequest {
  venueName: string;
  latitude: number;
  longitude: number;
  startsAt: string;
  endsAt: string;
  note?: string;
}

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'withdrawn';

export interface JoinRequest {
  id: string;
  gatheringId: string;
  requester: GatheringPerson;
  message?: string;
  status: JoinRequestStatus;
  expiresAt: string;
  createdAt: string;
}

export interface JoinRequestsResponse {
  requests: JoinRequest[];
  count: number;
}

// Reviews: about the person and the meetup, never chess results. No score.
export type ReviewTag = 'friendly' | 'on_time' | 'good_company' | 'patient_with_beginners';

export interface CreateReviewRequest {
  gatheringId: string;
  revieweeId: string;
  tags: ReviewTag[];
  noShow: boolean;
  comment?: string;
}

export interface Review {
  id: string;
  gatheringId: string;
  reviewerId: string;
  reviewerUsername: string;
  reviewerPhotoUrl?: string;
  revieweeId: string;
  tags: ReviewTag[];
  noShow: boolean;
  comment?: string;
  createdAt: string;
}

export interface ReviewListResponse {
  reviews: Review[];
  count: number;
  tagCounts: { tag: ReviewTag; count: number }[];
  noShowCount: number;
}

// Blocking
export interface BlockedUser {
  id: string;
  blockedUsername: string;
  blockedAt: string;
  reason?: string;
}

export interface BlockListResponse {
  blockedUsers: BlockedUser[];
  count: number;
}

// API Errors
export interface ApiError {
  error: string;
  message: string;
  details?: Array<{
    field: string;
    message: string;
  }>;
}

// WebSocket Messages
export interface WebSocketMessage<T> {
  type: string;
  payload: T;
}

export interface JoinRequestReceivedPayload {
  requestId: string;
  gatheringId: string;
  requester: GatheringPerson;
  message?: string;
}

export interface JoinRequestResolvedPayload {
  requestId: string;
  gatheringId: string;
  status: JoinRequestStatus;
}

export interface MemberJoinedPayload {
  gatheringId: string;
  venueName: string;
  member: GatheringPerson;
  memberCount: number;
}

export interface GatheringUpdatedPayload {
  gatheringId: string;
  status: GatheringStatus;
  memberCount: number;
}

export interface UserAvailabilityChangedPayload {
  userId: string;
  isAvailable: boolean;
  hasBoard: boolean;
}

export interface UserCameOnlinePayload {
  userId: string;
  username: string;
}

// Navigation
export type RootStackParamList = {
  Auth: undefined;
  App: NavigatorScreenParams<AppTabParamList> | undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type AppTabParamList = {
  HomeStack: undefined;
  GatheringsStack: NavigatorScreenParams<GatheringsStackParamList> | undefined;
  ProfileStack: undefined;
  SettingsStack: undefined;
};

export type HomeStackParamList = {
  Map: undefined;
  UserProfile: { userId: string };
  SetAvailability: undefined;
};

export type GatheringsStackParamList = {
  GatheringsList: undefined;
  GatheringDetail: { gatheringId: string };
  CreateGathering: undefined;
  ReviewGathering: { gatheringId: string };
};

export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
};

export type SettingsStackParamList = {
  Settings: undefined;
  BlockList: undefined;
  About: undefined;
};

// State Management
export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface LocationState {
  currentLocation: Location | null;
  isAvailable: boolean;
  isLoading: boolean;
  error: string | null;
}

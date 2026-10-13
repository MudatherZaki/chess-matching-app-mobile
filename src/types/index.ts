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
  stats?: UserStats;
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

export interface UserStats {
  totalMatchesPlayed: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  winRate: number;
  avgOpponentRating?: number;
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
  stats?: UserStats;
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
  users: NearbyUser[];
  count: number;
}

// Proposals
export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled';

export interface Proposal {
  id: string;
  proposer: UserPublicProfile;
  status: ProposalStatus;
  message?: string;
  meetingLocation: Location;
  distanceFromYouKm: number;
  expiresAt: string;
  createdAt: string;
}

export interface CreateProposalRequest {
  receiverId: string;
  message?: string;
  meetingLatitude: number;
  meetingLongitude: number;
}

export interface CreateProposalResponse {
  id: string;
  proposerId: string;
  receiverId: string;
  status: ProposalStatus;
  message?: string;
  meetingLocation: Location;
  expiresAt: string;
  createdAt: string;
}

export interface IncomingProposalsResponse {
  proposals: Proposal[];
  count: number;
}

export interface AcceptProposalResponse {
  id: string;
  status: ProposalStatus;
  respondedAt: string;
  matchId: string;
}

// Matches
export type MatchOutcome = 'not_played' | 'player1_won' | 'player2_won' | 'draw';

export interface Match {
  id: string;
  opponent: UserPublicProfile;
  playedAt: string;
  outcome: MatchOutcome;
  playedWithBoard?: boolean;
  timeControl?: string;
  notes?: string;
  createdAt: string;
}

export interface CreateMatchRequest {
  opponentId: string;
  playedAt: string;
  outcome: MatchOutcome;
  playedWithBoard?: boolean;
  timeControl?: string;
  pgn?: string;
  notes?: string;
}

export interface MatchHistoryResponse {
  matches: Match[];
  count: number;
  total: number;
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

export interface ProposalReceivedPayload {
  proposalId: string;
  proposerId: string;
  proposerUsername: string;
  proposerPhotoUrl?: string;
  message?: string;
}

export interface ProposalRespondedPayload {
  proposalId: string;
  status: ProposalStatus;
  responderId: string;
}

export interface UserAvailabilityChangedPayload {
  userId: string;
  isAvailable: boolean;
  hasBoard: boolean;
  location?: Location;
}

export interface UserCameOnlinePayload {
  userId: string;
  username: string;
}

// Navigation
export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type AppTabParamList = {
  HomeStack: undefined;
  ProposalsStack: undefined;
  ProfileStack: undefined;
  SettingsStack: undefined;
};

export type HomeStackParamList = {
  Map: undefined;
  UserProfile: { userId: string };
  SetAvailability: undefined;
};

export type ProposalsStackParamList = {
  ProposalsList: undefined;
  ProposalDetail: { proposalId: string };
  RecordMatch: { matchId: string; opponentId: string; opponentUsername: string };
};

export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  MatchHistory: undefined;
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

export interface ProposalState {
  incomingProposals: Proposal[];
  outgoingProposals: Proposal[];
  isLoading: boolean;
  error: string | null;
}

export interface MatchState {
  matches: Match[];
  isLoading: boolean;
  error: string | null;
}

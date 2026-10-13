/**
 * Static fixtures for eyeballing the UI without other real players around.
 *
 * When USE_MOCK_DATA is on, apiClient appends these to the real results of the
 * nearby-players and proposal endpoints, and handles any action on a `mock-*` id
 * locally. Flip it to false (it's always off in release builds) to go fully live.
 */
import {
  NearbyUser,
  Proposal,
  ProposalStatus,
  UserPublicProfile,
  AcceptProposalResponse,
} from '@/types';

export const USE_MOCK_DATA = __DEV__ && true;

export const isMockId = (id?: string) => !!id && id.startsWith('mock-');

const avatar = (n: number) => `https://i.pravatar.cc/200?img=${n}`;

const minutesFromNow = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

const stats = (wins: number, losses: number, draws: number) => {
  const total = wins + losses + draws;
  return {
    totalMatchesPlayed: total,
    totalWins: wins,
    totalLosses: losses,
    totalDraws: draws,
    winRate: total ? Math.round((wins / total) * 100) : 0,
  };
};

// Each player exercises a different combination of card states
const PLAYERS: NearbyUser[] = [
  {
    // Everything filled in: photo, FIDE rating, board, long record
    id: 'mock-marcus',
    username: 'marcusv',
    fullName: 'Marcus Vance',
    photoUrl: avatar(12),
    bio: 'Blitz addict. Fountain Plaza tables most evenings.',
    hasBoard: true,
    fideRating: 1845,
    chessComRating: 1910,
    linkedAccounts: [
      {
        platform: 'chesscom',
        username: 'MarcusV_Blitz',
        profileUrl: 'https://www.chess.com/member/MarcusV_Blitz',
        verified: false,
        ratings: [
          { category: 'bullet', rating: 1820, best: 1903, games: 640, provisional: false },
          { category: 'blitz', rating: 1910, best: 1988, games: 2315, provisional: false },
          { category: 'rapid', rating: 1874, best: 1874, games: 188, provisional: false },
          { category: 'daily', rating: 1702, best: 1755, games: 41, provisional: false },
        ],
        gamesPlayed: 3184,
        wins: 1622,
        losses: 1381,
        draws: 181,
        memberSince: '2016-07-02T10:00:00Z',
        connectedAt: minutesFromNow(-60 * 24 * 12),
        lastSyncedAt: minutesFromNow(-240),
      },
    ],
    stats: stats(34, 12, 6),
    distanceKm: 0.15,
  },
  {
    // Chess.com rating only, no board
    id: 'mock-elena',
    username: 'elena_r',
    fullName: 'Elena Rostova',
    photoUrl: avatar(47),
    bio: 'Sipping coffee & ready. Prefer rapid.',
    hasBoard: false,
    chessComRating: 2010,
    stats: stats(8, 3, 1),
    distanceKm: 0.4,
  },
  {
    // No photo (initials placeholder), unrated, brand new: "New" / "Fresh challenger"
    id: 'mock-sam',
    username: 'sam_newbie',
    fullName: 'Sam Okafor',
    hasBoard: true,
    distanceKm: 0.9,
  },
  {
    // Long name for truncation, Lichess only
    id: 'mock-alexandra',
    username: 'alexandra.w',
    fullName: 'Alexandra Wilhelmina Van der Berg-Castellanos',
    photoUrl: avatar(32),
    hasBoard: false,
    lichessRating: 1655,
    linkedAccounts: [
      {
        platform: 'lichess',
        username: 'AlexW_Castles',
        profileUrl: 'https://lichess.org/@/AlexW_Castles',
        verified: true,
        ratings: [
          { category: 'bullet', rating: 1588, games: 412, provisional: false, progress: -14 },
          { category: 'blitz', rating: 1702, games: 1290, provisional: false, progress: 23 },
          { category: 'rapid', rating: 1655, games: 214, provisional: false, progress: 8 },
          { category: 'classical', rating: 1801, games: 9, provisional: true },
        ],
        gamesPlayed: 1925,
        wins: 951,
        losses: 873,
        draws: 101,
        memberSince: '2019-03-14T10:00:00Z',
        connectedAt: minutesFromNow(-60 * 24 * 30),
        lastSyncedAt: minutesFromNow(-95),
      },
    ],
    stats: stats(2, 5, 0),
    distanceKm: 1.8,
  },
  {
    // Far away, no full name (falls back to username), strong player
    id: 'mock-gm',
    username: 'the_grandmaster',
    photoUrl: avatar(68),
    hasBoard: true,
    fideRating: 2380,
    stats: stats(120, 14, 22),
    distanceKm: 7.4,
  },
];

const profileOf = ({ distanceKm: _d, ...p }: NearbyUser): UserPublicProfile => p;

const player = (id: string) => profileOf(PLAYERS.find(p => p.id === id)!);

type ProposalSeed = {
  id: string;
  from: string;
  status: ProposalStatus;
  message?: string;
  address?: string;
  distanceKm: number;
  createdMinsAgo: number;
  expiresInMins: number;
};

// Incoming: urgent countdown, normal, no message, long message
const INCOMING: ProposalSeed[] = [
  {
    id: 'mock-in-urgent',
    from: 'mock-marcus',
    status: 'pending',
    message: 'Quick 5+0? I have the board and clock set up already.',
    address: 'Table 4, Fountain Plaza',
    distanceKm: 0.15,
    createdMinsAgo: 26,
    expiresInMins: 4.5,
  },
  {
    id: 'mock-in-cafe',
    from: 'mock-elena',
    status: 'pending',
    message: 'Coffee & tactics at The Bean Cafe?',
    address: 'The Bean Cafe — indoor booth',
    distanceKm: 0.4,
    createdMinsAgo: 12,
    expiresInMins: 48,
  },
  {
    id: 'mock-in-plain',
    from: 'mock-sam',
    status: 'pending',
    distanceKm: 0.9,
    createdMinsAgo: 0,
    expiresInMins: 60,
  },
  {
    id: 'mock-in-long',
    from: 'mock-alexandra',
    status: 'pending',
    message:
      "Hi! I'm still learning and would love a relaxed game — happy to go over the moves together afterwards if you're up for it. I'll be on the bench by the north entrance, wearing a red jacket.",
    address: 'North Entrance Benches, Riverside Park Community Garden',
    distanceKm: 1.8,
    createdMinsAgo: 95,
    expiresInMins: 180,
  },
];

// Sent: one of every status so the tags/actions can be compared
const OUTGOING: ProposalSeed[] = [
  {
    id: 'mock-out-pending',
    from: 'mock-gm',
    status: 'pending',
    message: 'Would be an honour to play you!',
    address: 'Chess Pavilion, Central Square',
    distanceKm: 7.4,
    createdMinsAgo: 3,
    expiresInMins: 57,
  },
  {
    id: 'mock-out-accepted',
    from: 'mock-elena',
    status: 'accepted',
    address: 'The Bean Cafe',
    distanceKm: 0.4,
    createdMinsAgo: 40,
    expiresInMins: 20,
  },
  {
    id: 'mock-out-rejected',
    from: 'mock-marcus',
    status: 'rejected',
    message: 'Rematch?',
    distanceKm: 0.15,
    createdMinsAgo: 180,
    expiresInMins: -120,
  },
  {
    id: 'mock-out-expired',
    from: 'mock-sam',
    status: 'expired',
    distanceKm: 0.9,
    createdMinsAgo: 300,
    expiresInMins: -240,
  },
];

// Seeds are turned into proposals at fetch time so countdowns are relative to "now"
const build = (s: ProposalSeed): Proposal => {
  const p = player(s.from);
  return {
    id: s.id,
    proposer: p,
    status: s.status,
    message: s.message,
    meetingLocation: {
      latitude: 30.0444 + s.distanceKm / 111,
      longitude: 31.2357,
      address: s.address,
    },
    distanceFromYouKm: s.distanceKm,
    createdAt: minutesFromNow(-s.createdMinsAgo),
    expiresAt: minutesFromNow(s.expiresInMins),
  };
};

// Ids the user has accepted/declined/cancelled this session
const resolved = new Set<string>();

export const mockApi = {
  nearbyUsers(radiusKm: number, hasBoard?: boolean): NearbyUser[] {
    return PLAYERS.filter(p => p.distanceKm <= radiusKm && (!hasBoard || p.hasBoard));
  },

  userProfile(userId: string): UserPublicProfile | undefined {
    const p = PLAYERS.find(u => u.id === userId);
    return p && profileOf(p);
  },

  incoming(): Proposal[] {
    return INCOMING.filter(s => !resolved.has(s.id)).map(build);
  },

  outgoing(): Proposal[] {
    return OUTGOING.filter(s => !resolved.has(s.id)).map(build);
  },

  resolve(proposalId: string) {
    resolved.add(proposalId);
  },

  accept(proposalId: string): AcceptProposalResponse {
    resolved.add(proposalId);
    return {
      id: proposalId,
      status: 'accepted',
      respondedAt: new Date().toISOString(),
      matchId: `mock-match-${proposalId}`,
    };
  },
};

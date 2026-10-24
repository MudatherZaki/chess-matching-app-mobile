/**
 * Static fixtures for eyeballing the UI without other real players around.
 *
 * When USE_MOCK_DATA is on, apiClient appends these to the real results of the
 * nearby-players and gathering endpoints, and handles any action on a `mock-*` id
 * locally. Flip it to false (it's always off in release builds) to go fully live.
 */
import {
  User,
  NearbyUser,
  UserPublicProfile,
  Gathering,
  GatheringPerson,
  JoinRequest,
  JoinRequestStatus,
  ReviewListResponse,
} from '@/types';

// Off now that there's a real staging server; turn on to demo without a backend
export const USE_MOCK_DATA = __DEV__ && false;

export const isMockId = (id?: string) => !!id && id.startsWith('mock-');

const avatar = (n: number) => `https://i.pravatar.cc/200?img=${n}`;

const minutesFromNow = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

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
    distanceKm: 0.4,
  },
  {
    // No photo (initials placeholder), no rating linked
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
    distanceKm: 1.8,
  },
  {
    // Far away, no full name (falls back to username), strong player
    id: 'mock-gm',
    username: 'the_grandmaster',
    photoUrl: avatar(68),
    hasBoard: true,
    fideRating: 2380,
    distanceKm: 7.4,
  },
];

const profileOf = ({ distanceKm: _d, ...p }: NearbyUser): UserPublicProfile => p;

const person = (id: string): GatheringPerson => {
  const { id: pid, username, fullName, photoUrl, hasBoard, fideRating, chessComRating, lichessRating } =
    PLAYERS.find(p => p.id === id)!;
  return { id: pid, username, fullName, photoUrl, hasBoard, fideRating, chessComRating, lichessRating };
};

type GatheringSeed = {
  id: string;
  host: string;
  guests: string[];
  venueName: string;
  note?: string;
  distanceKm: number;
  startsInMins: number;
  hours: number;
  mine?: boolean;
};

// Nearby: open, gathered, a big one, one starting later; plus one you host
const GATHERINGS: GatheringSeed[] = [
  {
    id: 'mock-g-plaza',
    host: 'mock-marcus',
    guests: ['mock-elena'],
    venueName: 'Fountain Plaza tables',
    note: 'Blitz all evening, two boards and clocks.',
    distanceKm: 0.5,
    startsInMins: -30,
    hours: 3,
  },
  {
    id: 'mock-g-cafe',
    host: 'mock-alexandra',
    guests: [],
    venueName: 'The Bean Cafe',
    note: "Still learning, happy to go over games together. I'll have a red jacket on.",
    distanceKm: 2,
    startsInMins: 45,
    hours: 2,
  },
  {
    id: 'mock-g-club',
    host: 'mock-gm',
    guests: ['mock-marcus', 'mock-elena', 'mock-alexandra'],
    venueName: 'Central Square Chess Pavilion',
    note: 'Weekly meetup, all levels welcome.',
    distanceKm: 7.5,
    startsInMins: 180,
    hours: 4,
  },
  {
    id: 'mock-g-mine',
    host: 'me',
    guests: ['mock-sam'],
    venueName: 'Riverside Park benches',
    distanceKm: 1,
    startsInMins: 60,
    hours: 2,
    mine: true,
  },
];

// People asking to join your gathering, and your own requests
const REQUESTS_TO_APPROVE = [
  { id: 'mock-r-elena', gatheringId: 'mock-g-mine', from: 'mock-elena', message: 'Can I join? I can bring a clock.' },
  { id: 'mock-r-gm', gatheringId: 'mock-g-mine', from: 'mock-gm' },
];

const ME: GatheringPerson = { id: 'me', username: 'you', hasBoard: true };

// Signed-in user for "Try with demo data"; its id matches ME so the mock
// gathering you host and your join requests line up
export const MOCK_USER: User = {
  id: ME.id,
  email: 'you@demo.dev',
  username: ME.username,
  fullName: 'Demo Player',
  bio: 'Exploring BlitzMate with demo data.',
  isAvailable: false,
  hasBoard: true,
  lichess: { username: 'demo', rating: 1650 },
  createdAt: new Date().toISOString(),
};

// Session state for mock actions
const answered = new Map<string, JoinRequestStatus>();
const myRequests = new Map<string, JoinRequest>();
const closed = new Set<string>();

const buildGathering = (g: GatheringSeed): Gathering => {
  const members = [g.mine ? ME : person(g.host), ...g.guests.map(person)];
  const now = Date.now();
  const point = { latitude: 30.0444 + g.distanceKm / 111, longitude: 31.2357 };
  const pending = [...myRequests.values()].find(r => r.gatheringId === g.id && r.status === 'pending');
  return {
    id: g.id,
    host: members[0],
    status: closed.has(g.id) ? 'ended' : members.length > 1 ? 'gathered' : 'open',
    startsAt: new Date(now + g.startsInMins * 60_000).toISOString(),
    endsAt: new Date(now + (g.startsInMins + g.hours * 60) * 60_000).toISOString(),
    note: g.note,
    venueName: g.mine ? g.venueName : undefined,
    location: g.mine ? point : undefined,
    approximateLocation: {
      latitude: Math.round(point.latitude * 100) / 100,
      longitude: Math.round(point.longitude * 100) / 100,
    },
    distanceKm: g.distanceKm,
    members,
    memberCount: members.length,
    isMember: !!g.mine,
    isHost: !!g.mine,
    myPendingRequestId: pending?.id,
    createdAt: new Date(now - 20 * 60_000).toISOString(),
  };
};

export const mockApi = {
  nearbyUsers(radiusKm: number, hasBoard?: boolean): NearbyUser[] {
    return PLAYERS.filter(p => p.distanceKm <= radiusKm && (!hasBoard || p.hasBoard));
  },

  userProfile(userId: string): UserPublicProfile | undefined {
    const p = PLAYERS.find(u => u.id === userId);
    return p && profileOf(p);
  },

  nearbyGatherings(radiusKm: number): Gathering[] {
    return GATHERINGS.filter(g => !g.mine && !closed.has(g.id) && g.distanceKm <= radiusKm).map(
      buildGathering,
    );
  },

  myGatherings(): Gathering[] {
    return GATHERINGS.filter(g => g.mine).map(buildGathering);
  },

  gathering(id: string): Gathering {
    return buildGathering(GATHERINGS.find(g => g.id === id)!);
  },

  join(gatheringId: string, message?: string): JoinRequest {
    const now = Date.now();
    const request: JoinRequest = {
      id: `mock-mine-${now}`,
      gatheringId,
      requester: ME,
      message,
      status: 'pending',
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 15 * 60_000).toISOString(),
    };
    myRequests.set(request.id, request);
    return request;
  },

  withdraw(requestId: string) {
    const request = myRequests.get(requestId);
    if (request) request.status = 'withdrawn';
  },

  leave(gatheringId: string) {
    closed.add(gatheringId);
  },

  end(gatheringId: string) {
    closed.add(gatheringId);
  },

  requestsToApprove(): JoinRequest[] {
    const now = Date.now();
    return REQUESTS_TO_APPROVE.filter(r => !answered.has(r.id)).map(r => ({
      id: r.id,
      gatheringId: r.gatheringId,
      requester: person(r.from),
      message: r.message,
      status: 'pending',
      createdAt: new Date(now - 3 * 60_000).toISOString(),
      expiresAt: new Date(now + 12 * 60_000).toISOString(),
    }));
  },

  myRequests(): JoinRequest[] {
    return [...myRequests.values()];
  },

  answer(requestId: string, status: JoinRequestStatus): JoinRequest {
    const seed = REQUESTS_TO_APPROVE.find(r => r.id === requestId)!;
    answered.set(requestId, status);
    return {
      id: requestId,
      gatheringId: seed.gatheringId,
      requester: person(seed.from),
      status,
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
    };
  },

  reviewsFor(userId: string): ReviewListResponse {
    if (userId !== 'mock-marcus') return { reviews: [], count: 0, tagCounts: [], noShowCount: 0 };
    return {
      reviews: [
        {
          id: 'mock-review-1',
          gatheringId: 'mock-g-old',
          reviewerId: 'mock-elena',
          reviewerUsername: 'elena_r',
          revieweeId: userId,
          tags: ['friendly', 'good_company'],
          noShow: false,
          comment: 'Brought spare boards for everyone. Great evening.',
          createdAt: minutesFromNow(-60 * 24 * 3),
        },
      ],
      count: 1,
      tagCounts: [
        { tag: 'friendly', count: 6 },
        { tag: 'good_company', count: 4 },
        { tag: 'on_time', count: 3 },
      ],
      noShowCount: 0,
    };
  },
};

import { create } from 'zustand';
import { apiClient } from '@services/api';
import { CreateGatheringRequest, Gathering, JoinRequest } from '@/types';

const errorMessage = (error: any, fallback: string) => error?.response?.data?.message || fallback;

interface GatheringState {
  nearby: Gathering[];
  mine: Gathering[];
  // Pending requests to join gatherings you're in (drives the tab badge)
  requestsToApprove: JoinRequest[];
  myRequests: JoinRequest[];
  isLoading: boolean;
  error: string | null;

  fetchNearby: (latitude: number, longitude: number, radiusKm: number) => Promise<void>;
  fetchMine: () => Promise<void>;
  fetchRequests: () => Promise<void>;
  createGathering: (data: CreateGatheringRequest) => Promise<Gathering>;
  requestToJoin: (gatheringId: string, message?: string, hasBoard?: boolean) => Promise<JoinRequest>;
  withdrawRequest: (requestId: string) => Promise<void>;
  approveRequest: (requestId: string) => Promise<JoinRequest>;
  rejectRequest: (requestId: string) => Promise<JoinRequest>;
  leaveGathering: (gatheringId: string) => Promise<void>;
  endGathering: (gatheringId: string) => Promise<void>;
  cancelGathering: (gatheringId: string) => Promise<void>;
}

export const useGatheringStore = create<GatheringState>((set, get) => ({
  nearby: [],
  mine: [],
  requestsToApprove: [],
  myRequests: [],
  isLoading: false,
  error: null,

  fetchNearby: async (latitude, longitude, radiusKm) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.getNearbyGatherings(latitude, longitude, radiusKm);
      set({ nearby: response.gatherings || [], isLoading: false });
    } catch (error: any) {
      set({ error: errorMessage(error, 'Failed to load gatherings'), isLoading: false });
      throw error;
    }
  },

  fetchMine: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.getMyGatherings();
      set({ mine: response.gatherings || [], isLoading: false });
    } catch (error: any) {
      set({ error: errorMessage(error, 'Failed to load your gatherings'), isLoading: false });
      throw error;
    }
  },

  fetchRequests: async () => {
    try {
      const [toApprove, mine] = await Promise.all([
        apiClient.getRequestsToApprove(),
        apiClient.getMyRequests(),
      ]);
      set({ requestsToApprove: toApprove.requests || [], myRequests: mine.requests || [] });
    } catch (error: any) {
      set({ error: errorMessage(error, 'Failed to load join requests') });
      throw error;
    }
  },

  createGathering: async data => {
    const gathering = await apiClient.createGathering(data);
    set({ mine: [gathering, ...get().mine] });
    return gathering;
  },

  requestToJoin: async (gatheringId, message, hasBoard) => {
    const request = await apiClient.requestToJoin(gatheringId, message, hasBoard);
    set({
      myRequests: [request, ...get().myRequests],
      nearby: get().nearby.map(g =>
        g.id === gatheringId ? { ...g, myPendingRequestId: request.id } : g,
      ),
    });
    return request;
  },

  withdrawRequest: async requestId => {
    await apiClient.withdrawRequest(requestId);
    set({
      myRequests: get().myRequests.map(r =>
        r.id === requestId ? { ...r, status: 'withdrawn' } : r,
      ),
      nearby: get().nearby.map(g =>
        g.myPendingRequestId === requestId ? { ...g, myPendingRequestId: undefined } : g,
      ),
    });
  },

  approveRequest: async requestId => {
    const result = await apiClient.approveRequest(requestId);
    set({ requestsToApprove: get().requestsToApprove.filter(r => r.id !== requestId) });
    return result;
  },

  // A "no" only hides the request for you; it's declined once everyone says no
  rejectRequest: async requestId => {
    const result = await apiClient.rejectRequest(requestId);
    set({ requestsToApprove: get().requestsToApprove.filter(r => r.id !== requestId) });
    return result;
  },

  leaveGathering: async gatheringId => {
    await apiClient.leaveGathering(gatheringId);
    set({ mine: get().mine.filter(g => g.id !== gatheringId) });
  },

  endGathering: async gatheringId => {
    await apiClient.endGathering(gatheringId);
    set({ mine: get().mine.map(g => (g.id === gatheringId ? { ...g, status: 'ended' } : g)) });
  },

  cancelGathering: async gatheringId => {
    await apiClient.cancelGathering(gatheringId);
    set({ mine: get().mine.filter(g => g.id !== gatheringId) });
  },
}));

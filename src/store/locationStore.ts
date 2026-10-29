import { create } from 'zustand';
import { apiClient } from '@services/api';
import { useAuthStore } from './authStore';
import {
  Location,
  LocationState,
  NearbyUsersResponse,
  SetAvailabilityResponse,
  User,
} from '@/types';

// Single source of truth for the selectable search radii, shared by the
// Radar screen's cycle button and the Profile screen's segmented control so
// the two can't silently drift out of sync with each other.
export const RADIUS_OPTIONS_KM = [1, 2, 5, 10] as const;

export const useLocationStore = create<
  LocationState & {
    setAvailability: (
      location: Location,
      hasBoard: boolean,
      expiresInHours?: number,
    ) => Promise<void>;
    setUnavailable: () => Promise<void>;
    getNearbyUsers: (radiusKm: number, hasBoard?: boolean) => Promise<NearbyUsersResponse>;
    searchRadiusKm: number;
    setSearchRadius: (radiusKm: number) => void;
    clearError: () => void;
  }
>(set => ({
  currentLocation: null,
  isAvailable: false,
  isLoading: false,
  error: null,
  searchRadiusKm: 10,

  setSearchRadius: radiusKm => {
    set({ searchRadiusKm: radiusKm });
  },

  setAvailability: async (location, hasBoard, expiresInHours = 4) => {
    set({ isLoading: true, error: null });
    try {
      const response: SetAvailabilityResponse | undefined = await apiClient.setAvailability({
        isAvailable: true,
        latitude: location.latitude,
        longitude: location.longitude,
        hasBoard,
        expiresInHours,
      });

      set({
        currentLocation: location,
        isAvailable: true,
        isLoading: false,
      });

      // The beacon also updates the board flag and expiry on the profile. The
      // expiry must be the new one: the profile subscription below re-derives
      // isAvailable from it, and a stale one from a past beacon turns this one off
      const availabilityExpiresAt =
        response?.expiresAt ?? new Date(Date.now() + expiresInHours * 3_600_000).toISOString();
      const { user, updateUser } = useAuthStore.getState();
      if (user) updateUser({ ...user, hasBoard, isAvailable: true, availabilityExpiresAt });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to set availability';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  setUnavailable: async () => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.setAvailability({
        isAvailable: false,
        latitude: 0,
        longitude: 0,
        hasBoard: false,
      });

      set({
        isAvailable: false,
        isLoading: false,
      });

      const { user, updateUser } = useAuthStore.getState();
      if (user) updateUser({ ...user, isAvailable: false });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to set unavailable';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  getNearbyUsers: async (radiusKm, hasBoard) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.getNearbyUsers(radiusKm, hasBoard);
      set({ isLoading: false });
      return { ...response, users: response.users || [] };
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to fetch nearby users';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));

const beaconLive = (user: User | null) =>
  !!user?.isAvailable &&
  (!user.availabilityExpiresAt || new Date(user.availabilityExpiresAt).getTime() > Date.now());

// The profile is the server's record of your beacon, so whenever it loads (sign-in,
// app restart) or changes, the beacon status follows it
useAuthStore.subscribe((state, prev) => {
  if (state.user !== prev.user) useLocationStore.setState({ isAvailable: beaconLive(state.user) });
});

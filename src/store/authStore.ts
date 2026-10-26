import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, errorMessage, isSessionOver } from '@services/api';
import { LichessAuthCancelled, signInWithLichess } from '@services/lichessAuth';
import { USE_MOCK_DATA, MOCK_USER } from '@/mocks';
import {
  User,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  AuthState,
} from '@/types';

// Stores the tokens from a sign-in or sign-up and loads the full profile
async function startSession(response: AuthResponse) {
  await AsyncStorage.setItem('accessToken', response.accessToken);
  await AsyncStorage.setItem('refreshToken', response.refreshToken);
  await AsyncStorage.setItem('userId', response.userId);
  apiClient.setAuthToken(response.accessToken);

  const user = await apiClient.getMyProfile();
  return { user, accessToken: response.accessToken, refreshToken: response.refreshToken };
}

export const useAuthStore = create<
  AuthState & {
    register: (data: RegisterRequest) => Promise<void>;
    login: (data: LoginRequest) => Promise<void>;
    loginWithLichess: () => Promise<void>;
    logout: () => Promise<void>;
    restoreToken: () => Promise<void>;
    updateUser: (user: User) => void;
    clearError: () => void;
    signInWithDemo: () => void;
  }
>(set => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  error: null,

  register: async data => {
    set({ isLoading: true, error: null });
    try {
      const response: AuthResponse = await apiClient.register(data);
      set({ ...(await startSession(response)), isLoading: false });
    } catch (error: any) {
      const message = errorMessage(error, 'Registration failed');
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  login: async data => {
    set({ isLoading: true, error: null });
    try {
      const response: AuthResponse = await apiClient.login(data);
      set({ ...(await startSession(response)), isLoading: false });
    } catch (error: any) {
      const message = errorMessage(error, 'Login failed');
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  // Not tied to isLoading: the browser round trip shouldn't spin the Sign In
  // button, so screens show their own progress for it
  loginWithLichess: async () => {
    set({ error: null });
    try {
      const response = await signInWithLichess();
      set(await startSession(response));
    } catch (error: any) {
      // Backing out on Lichess isn't an error worth showing. Failures of the
      // browser round trip itself aren't network errors: show their own message.
      if (!(error instanceof LichessAuthCancelled)) {
        set({
          error: error?.isAxiosError
            ? errorMessage(error, 'Lichess sign-in failed')
            : error?.message || 'Lichess sign-in failed',
        });
      }
      throw error;
    }
  },

  logout: async () => {
    // Revoking the refresh token server-side is best-effort: the user must be
    // logged out locally even if any of this fails (offline, expired token,
    // storage error, ...).
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      if (refreshToken) {
        await apiClient.logout(refreshToken);
      } else {
        console.warn('Logout: no refreshToken in storage, server session was not revoked');
      }
    } catch (error) {
      console.warn('Server logout failed, clearing local session anyway:', error);
    }

    try {
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'userId']);
    } catch (error) {
      console.warn('Failed to clear stored auth tokens:', error);
    }
    apiClient.clearAuthToken();

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      error: null,
    });
  },

  restoreToken: async () => {
    set({ isLoading: true });
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      const refreshToken = await AsyncStorage.getItem('refreshToken');

      if (accessToken && refreshToken) {
        apiClient.setAuthToken(accessToken);

        // Fetch user profile to verify token is still valid; an expired access
        // token is refreshed on the way, so read the token back afterwards
        const userProfile = await apiClient.getMyProfile();

        set({
          user: userProfile,
          accessToken: (await AsyncStorage.getItem('accessToken')) ?? accessToken,
          refreshToken,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      // Keep the stored session if the backend just couldn't be reached, so the
      // next launch can still restore it; drop it only once it's been rejected
      if (isSessionOver(error)) {
        await AsyncStorage.removeItem('accessToken');
        await AsyncStorage.removeItem('refreshToken');
      }
      apiClient.clearAuthToken();

      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isLoading: false,
      });
    }
  },

  updateUser: user => {
    set({ user });
  },

  clearError: () => {
    set({ error: null });
  },

  // Dev builds only: browse the app as a mock user without a backend. Nothing
  // is stored, so a reload returns to the login screen.
  signInWithDemo: () => {
    if (!USE_MOCK_DATA) return;
    set({ user: MOCK_USER, accessToken: null, refreshToken: null, error: null, isLoading: false });
  },
}));

// A rejected refresh mid-session means signing in again
apiClient.setOnSessionOver(() => {
  apiClient.clearAuthToken();
  useAuthStore.setState({ user: null, accessToken: null, refreshToken: null });
});

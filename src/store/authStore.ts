import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, errorMessage, isSessionOver } from '@services/api';
import { signInWithLichess, LichessAuthCancelled } from '@services/lichessAuth';
import { USE_MOCK_DATA, MOCK_USER } from '@/mocks';
import {
  User,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  AuthState,
} from '@/types';

// Store the tokens, then load the profile they belong to
async function startSession(response: AuthResponse) {
  await AsyncStorage.setItem('accessToken', response.accessToken);
  await AsyncStorage.setItem('refreshToken', response.refreshToken);
  await AsyncStorage.setItem('userId', response.userId);
  apiClient.setAuthToken(response.accessToken);

  const user: User = await apiClient.getMyProfile();
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
    // Email verification
    verifyEmail: (code: string) => Promise<void>;
    resendVerificationCode: () => Promise<void>;
    setVerifyEmailLater: (later: boolean) => void;
  }
>(set => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  error: null,
  verifyEmailLater: false,
  verificationCodeSentAt: null,

  register: async data => {
    set({ isLoading: true, error: null });
    try {
      const response: AuthResponse = await apiClient.register(data);

      // The server emails the first code as part of signing up
      set({
        ...(await startSession(response)),
        isLoading: false,
        verifyEmailLater: false,
        verificationCodeSentAt: Date.now(),
      });
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

  // Signs in or signs up; cancelling on Lichess just leaves you where you were
  loginWithLichess: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await signInWithLichess();
      set({ ...(await startSession(response)), isLoading: false });
    } catch (error: any) {
      if (error instanceof LichessAuthCancelled) {
        set({ isLoading: false });
        return;
      }
      // Server errors carry a message; browser round-trip errors are plain Errors
      const message = error?.isAxiosError
        ? errorMessage(error, 'Lichess sign-in failed')
        : error?.message || 'Lichess sign-in failed';
      set({ error: message, isLoading: false });
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
      verifyEmailLater: false,
      verificationCodeSentAt: null,
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

  verifyEmail: async code => {
    await apiClient.verifyEmail(code);
    const user: User = await apiClient.getMyProfile();
    set({ user, verifyEmailLater: false });
  },

  resendVerificationCode: async () => {
    await apiClient.resendVerificationEmail();
    set({ verificationCodeSentAt: Date.now() });
  },

  // "Do this later" lets an unverified player into the app for this session,
  // with the meeting features locked
  setVerifyEmailLater: later => {
    set({ verifyEmailLater: later });
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
  useAuthStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    verifyEmailLater: false,
    verificationCodeSentAt: null,
  });
});

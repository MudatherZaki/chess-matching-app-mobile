import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@services/lichessAuth', () => {
  class LichessAuthCancelled extends Error {}
  return { LichessAuthCancelled, signInWithLichess: jest.fn() };
});
jest.mock('@services/api', () => ({
  apiClient: {
    getMyProfile: jest.fn(),
    setAuthToken: jest.fn(),
    clearAuthToken: jest.fn(),
    setOnSessionOver: jest.fn(),
  },
  errorMessage: (error: any, fallback: string) => error?.response?.data?.message ?? fallback,
  isSessionOver: () => false,
}));

const { signInWithLichess, LichessAuthCancelled } = require('@services/lichessAuth');
const { apiClient } = require('@services/api');
const { useAuthStore } = require('../authStore');

const PROFILE = { id: 'u1', username: 'Magnus_Fan' };

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, error: null });
});

it('stores the session and loads the profile', async () => {
  signInWithLichess.mockResolvedValue({
    userId: 'u1',
    email: 'fan@example.com',
    username: 'Magnus_Fan',
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresIn: 3600,
    isNewUser: true,
  });
  apiClient.getMyProfile.mockResolvedValue(PROFILE);

  await useAuthStore.getState().loginWithLichess();

  expect(useAuthStore.getState().user).toEqual(PROFILE);
  expect(await AsyncStorage.getItem('accessToken')).toBe('access');
  expect(await AsyncStorage.getItem('refreshToken')).toBe('refresh');
  expect(apiClient.setAuthToken).toHaveBeenCalledWith('access');
});

it('shows nothing when the player backs out on Lichess', async () => {
  signInWithLichess.mockRejectedValue(new LichessAuthCancelled('access_denied'));

  await expect(useAuthStore.getState().loginWithLichess()).rejects.toBeInstanceOf(LichessAuthCancelled);
  expect(useAuthStore.getState().error).toBeNull();
  expect(useAuthStore.getState().user).toBeNull();
});

it('says the sign-in didn\'t finish rather than blaming the network', async () => {
  signInWithLichess.mockRejectedValue(new Error("Lichess sign-in didn't finish. Please try again."));

  await expect(useAuthStore.getState().loginWithLichess()).rejects.toBeTruthy();
  expect(useAuthStore.getState().error).toBe("Lichess sign-in didn't finish. Please try again.");
});

it("shows the server's reason when the email already has an account", async () => {
  signInWithLichess.mockRejectedValue({
    isAxiosError: true,
    response: { status: 409, data: { message: "There's already a BlitzMate account for fan@example.com." } },
  });

  await expect(useAuthStore.getState().loginWithLichess()).rejects.toBeTruthy();
  expect(useAuthStore.getState().error).toBe("There's already a BlitzMate account for fan@example.com.");
});

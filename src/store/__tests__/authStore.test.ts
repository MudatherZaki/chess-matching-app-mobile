import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@services/lichessAuth', () => {
  class LichessAuthCancelled extends Error {}
  return { LichessAuthCancelled, signInWithLichess: jest.fn() };
});
jest.mock('@services/api', () => ({
  apiClient: {
    setAuthToken: jest.fn(),
    getMyProfile: jest.fn(async () => ({ id: 'u1', username: 'Magnus_Fan' })),
    setOnSessionOver: jest.fn(),
  },
  errorMessage: (_error: any, fallback: string) => fallback,
  isSessionOver: () => false,
}));

const { signInWithLichess, LichessAuthCancelled } = require('@services/lichessAuth');
const { useAuthStore } = require('../authStore');

beforeEach(async () => {
  await AsyncStorage.clear();
  useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, error: null, isLoading: false });
});

describe('loginWithLichess', () => {
  it('stores the session the backend returns', async () => {
    signInWithLichess.mockResolvedValue({ userId: 'u1', accessToken: 'a', refreshToken: 'r' });

    await useAuthStore.getState().loginWithLichess();

    expect(useAuthStore.getState().user).toEqual({ id: 'u1', username: 'Magnus_Fan' });
    expect(await AsyncStorage.getItem('refreshToken')).toBe('r');
  });

  it('shows no error when the user backs out on Lichess', async () => {
    signInWithLichess.mockRejectedValue(new LichessAuthCancelled('access_denied'));

    await useAuthStore.getState().loginWithLichess();

    expect(useAuthStore.getState()).toMatchObject({ user: null, error: null, isLoading: false });
  });

  it('says why when the browser round trip fails', async () => {
    signInWithLichess.mockRejectedValue(new Error("Lichess sign-in didn't finish. Please try again."));

    await useAuthStore.getState().loginWithLichess();

    expect(useAuthStore.getState().error).toMatch("didn't finish");
  });
});

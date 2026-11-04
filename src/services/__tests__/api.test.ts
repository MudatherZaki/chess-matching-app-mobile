import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Route = (config: InternalAxiosRequestConfig) => { status: number; data?: any } | 'network';

let route: Route;
const calls: { url: string; auth?: string }[] = [];

// Every request (the client's own instance and the bare axios.post used for
// refresh) goes through this adapter instead of the network
axios.defaults.adapter = async config => {
  const url = (config.url ?? '').replace(/^https?:\/\/[^/]+/, '');
  calls.push({ url, auth: config.headers?.Authorization as string | undefined });
  const result = route({ ...config, url });
  if (result === 'network') {
    throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
  }
  const response = { data: result.data, status: result.status, statusText: '', headers: {}, config };
  if (result.status >= 400) {
    throw new AxiosError(`Status ${result.status}`, AxiosError.ERR_BAD_REQUEST, config, null, response);
  }
  return response;
};

// Imported after the adapter is set, since axios.create copies the defaults
const { apiClient, isSessionOver } = require('../api');

const PROFILE = { id: 'u1', username: 'alice' };

beforeEach(async () => {
  calls.length = 0;
  await AsyncStorage.clear();
  await AsyncStorage.setItem('accessToken', 'expired-access');
  await AsyncStorage.setItem('refreshToken', 'refresh-1');
});

describe('token refresh', () => {
  it('keeps the refresh token when the backend returns only a new access token', async () => {
    route = ({ url, headers }) => {
      if (url === '/api/v1/auth/refresh') return { status: 200, data: { accessToken: 'fresh-access', expiresIn: 3600 } };
      if (url === '/api/v1/profile/me') {
        return headers.Authorization === 'Bearer fresh-access' ? { status: 200, data: PROFILE } : { status: 401 };
      }
      return { status: 404 };
    };

    await expect(apiClient.getMyProfile()).resolves.toEqual(PROFILE);
    expect(await AsyncStorage.getItem('accessToken')).toBe('fresh-access');
    expect(await AsyncStorage.getItem('refreshToken')).toBe('refresh-1');
    expect(calls.map(c => c.url)).toEqual(['/api/v1/profile/me', '/api/v1/auth/refresh', '/api/v1/profile/me']);
  });

  it('ends the session when the refresh token is rejected', async () => {
    const onSessionOver = jest.fn();
    apiClient.setOnSessionOver(onSessionOver);
    route = ({ url }) => (url === '/api/v1/auth/refresh' ? { status: 401 } : { status: 401 });

    await expect(apiClient.getMyProfile()).rejects.toBeTruthy();
    expect(await AsyncStorage.getItem('accessToken')).toBeNull();
    expect(await AsyncStorage.getItem('refreshToken')).toBeNull();
    expect(onSessionOver).toHaveBeenCalledTimes(1);
  });

  it('keeps the session when the refresh fails on the network', async () => {
    const onSessionOver = jest.fn();
    apiClient.setOnSessionOver(onSessionOver);
    route = ({ url }) => (url === '/api/v1/auth/refresh' ? 'network' : { status: 401 });

    await expect(apiClient.getMyProfile()).rejects.toBeTruthy();
    expect(await AsyncStorage.getItem('refreshToken')).toBe('refresh-1');
    expect(onSessionOver).not.toHaveBeenCalled();
  });

  it("doesn't try a refresh for a wrong password", async () => {
    route = () => ({ status: 401, data: { message: 'Invalid email or password' } });

    await expect(apiClient.login({ email: 'a@b.c', password: 'nope' })).rejects.toMatchObject({
      response: { data: { message: 'Invalid email or password' } },
    });
    expect(calls.map(c => c.url)).toEqual(['/api/v1/auth/login']);
  });

  it('refreshes an expired token before confirming an email code', async () => {
    route = ({ url, headers }) => {
      if (url === '/api/v1/auth/refresh') return { status: 200, data: { accessToken: 'fresh-access', expiresIn: 3600 } };
      if (url === '/api/v1/auth/email/verify') {
        return headers.Authorization === 'Bearer fresh-access'
          ? { status: 200, data: { emailVerified: true } }
          : { status: 401 };
      }
      return { status: 404 };
    };
    apiClient.setAuthToken('expired-access');

    await expect(apiClient.verifyEmail('123456')).resolves.toEqual({ emailVerified: true });
    expect(calls.map(c => c.url)).toEqual([
      '/api/v1/auth/email/verify',
      '/api/v1/auth/refresh',
      '/api/v1/auth/email/verify',
    ]);
  });
});

describe('isSessionOver', () => {
  it('is true only for a missing or rejected session', () => {
    expect(isSessionOver(new Error('No refresh token'))).toBe(true);
    expect(isSessionOver({ response: { status: 401 } })).toBe(true);
    expect(isSessionOver({ response: { status: 503 } })).toBe(false);
    expect(isSessionOver(new AxiosError('Network Error', AxiosError.ERR_NETWORK))).toBe(false);
  });
});

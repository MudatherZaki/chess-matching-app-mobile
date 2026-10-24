import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  UpdateProfileRequest,
  SetAvailabilityRequest,
  CreateGatheringRequest,
  CreateReviewRequest,
  Gathering,
  GatheringsResponse,
  JoinRequest,
  JoinRequestsResponse,
  ReviewListResponse,
  LichessAuthorizeResponse,
  LinkedAccount,
} from '@/types';
import { USE_MOCK_DATA, isMockId, mockApi } from '@/mocks';

// Staging on Render's free plan. To use a backend on your machine, point this at
// http://localhost:5001 (iOS Simulator) or http://10.0.2.2:5001 (Android emulator).
export const BASE_URL = 'https://blitzmate-api.onrender.com';

const NO_REFRESH_TOKEN = 'No refresh token';

// True when an error means the stored session can't be used any more (no
// refresh token, or the server rejected it), as opposed to a network failure
export const isSessionOver = (error: any): boolean => {
  if (error?.message === NO_REFRESH_TOKEN) return true;
  const status = error?.response?.status;
  return status === 400 || status === 401 || status === 403;
};

class ApiClient {
  private instance: AxiosInstance;
  private baseURL: string;
  private onSessionOver?: () => void;

  constructor() {
    this.baseURL = BASE_URL;
    this.instance = axios.create({
      baseURL: this.baseURL,
      // The free server sleeps when idle and can take up to a minute to wake
      timeout: 70000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.instance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const token = await AsyncStorage.getItem('accessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      error => Promise.reject(error),
    );

    // Add response interceptor to handle token refresh
    this.instance.interceptors.response.use(
      response => response,
      async error => {
        const originalRequest = error.config;

        // Auth endpoints answer 401 for a wrong password or a dead refresh
        // token; retrying them would replace that message with a refresh error
        const isAuthCall = originalRequest?.url?.startsWith('/api/v1/auth/');
        if (error.response?.status === 401 && !originalRequest._retry && !isAuthCall) {
          originalRequest._retry = true;

          try {
            const refreshToken = await AsyncStorage.getItem('refreshToken');
            if (!refreshToken) {
              throw new Error(NO_REFRESH_TOKEN);
            }

            const response = await axios.post(
              `${this.baseURL}/api/v1/auth/refresh`,
              { refreshToken },
            );

            const { accessToken, refreshToken: newRefreshToken } = response.data;

            await AsyncStorage.setItem('accessToken', accessToken);
            // The backend doesn't rotate refresh tokens, so the response usually
            // has none; storing undefined would throw and sign the user out
            if (newRefreshToken) {
              await AsyncStorage.setItem('refreshToken', newRefreshToken);
            }

            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return this.instance(originalRequest);
          } catch (refreshError: any) {
            // Only a missing or rejected refresh token ends the session; a network
            // blip during the refresh shouldn't sign the user out
            if (isSessionOver(refreshError)) {
              await AsyncStorage.removeItem('accessToken');
              await AsyncStorage.removeItem('refreshToken');
              this.onSessionOver?.();
            }
            throw refreshError;
          }
        }

        return Promise.reject(error);
      },
    );
  }

  // ===== AUTH ENDPOINTS =====

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await this.instance.post('/api/v1/auth/register', data);
    return response.data;
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await this.instance.post('/api/v1/auth/login', data);
    return response.data;
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const response = await this.instance.post('/api/v1/auth/refresh', {
      refreshToken,
    });
    return response.data;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.instance.post('/api/v1/auth/logout', { refreshToken });
  }

  // ===== PROFILE ENDPOINTS =====

  async getMyProfile() {
    const response = await this.instance.get('/api/v1/profile/me');
    return response.data;
  }

  async getUserProfile(userId: string) {
    if (USE_MOCK_DATA && isMockId(userId)) return mockApi.userProfile(userId);
    const response = await this.instance.get(`/api/v1/profile/${userId}`);
    return response.data;
  }

  async updateProfile(data: UpdateProfileRequest) {
    const response = await this.instance.put('/api/v1/profile/me', data);
    return response.data;
  }

  async uploadPhoto(uri: string, filename: string) {
    const formData = new FormData();
    formData.append('photo', {
      uri,
      type: 'image/jpeg',
      name: filename,
    } as any);

    const response = await this.instance.post(
      '/api/v1/profile/me/photo',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return response.data;
  }

  // ===== INTEGRATION ENDPOINTS =====

  async startLichessAuth(): Promise<LichessAuthorizeResponse> {
    const response = await this.instance.post('/api/v1/integrations/lichess/authorize', {});
    return response.data;
  }

  async completeLichessAuth(code: string, state: string): Promise<LinkedAccount> {
    const response = await this.instance.post('/api/v1/integrations/lichess/callback', {
      code,
      state,
    });
    return response.data;
  }

  async refreshLichess(): Promise<LinkedAccount> {
    const response = await this.instance.post('/api/v1/integrations/lichess/refresh', {});
    return response.data;
  }

  async unlinkLichess(): Promise<void> {
    await this.instance.delete('/api/v1/integrations/lichess');
  }

  async linkChessCom(username: string): Promise<LinkedAccount> {
    const response = await this.instance.put('/api/v1/integrations/chesscom', { username });
    return response.data;
  }

  async refreshChessCom(): Promise<LinkedAccount> {
    const response = await this.instance.post('/api/v1/integrations/chesscom/refresh', {});
    return response.data;
  }

  async unlinkChessCom(): Promise<void> {
    await this.instance.delete('/api/v1/integrations/chesscom');
  }

  // ===== AVAILABILITY ENDPOINTS =====

  async setAvailability(data: SetAvailabilityRequest) {
    const response = await this.instance.post('/api/v1/availability/set', data);
    return response.data;
  }

  async getNearbyUsers(radiusKm: number, hasBoard?: boolean, limit: number = 20) {
    const request = this.instance.get('/api/v1/availability/nearby', {
      params: {
        radiusKm,
        hasBoard,
        limit,
      },
    });
    if (!USE_MOCK_DATA) return (await request).data;
    return withMocks(request, 'users', mockApi.nearbyUsers(radiusKm, hasBoard), limit);
  }

  // ===== GATHERING ENDPOINTS =====

  async createGathering(data: CreateGatheringRequest): Promise<Gathering> {
    const response = await this.instance.post('/api/v1/gatherings', data);
    return response.data;
  }

  async getNearbyGatherings(
    latitude: number,
    longitude: number,
    radiusKm: number,
  ): Promise<GatheringsResponse> {
    const request = this.instance.get('/api/v1/gatherings/nearby', {
      params: { latitude, longitude, radiusKm },
    });
    if (!USE_MOCK_DATA) return (await request).data;
    return withMocks(request, 'gatherings', mockApi.nearbyGatherings(radiusKm));
  }

  async getMyGatherings(): Promise<GatheringsResponse> {
    const request = this.instance.get('/api/v1/gatherings/mine');
    if (!USE_MOCK_DATA) return (await request).data;
    return withMocks(request, 'gatherings', mockApi.myGatherings());
  }

  async getGathering(gatheringId: string): Promise<Gathering> {
    if (USE_MOCK_DATA && isMockId(gatheringId)) return mockApi.gathering(gatheringId);
    const response = await this.instance.get(`/api/v1/gatherings/${gatheringId}`);
    return response.data;
  }

  async requestToJoin(gatheringId: string, message?: string): Promise<JoinRequest> {
    if (USE_MOCK_DATA && isMockId(gatheringId)) return mockApi.join(gatheringId, message);
    const response = await this.instance.post(`/api/v1/gatherings/${gatheringId}/join`, { message });
    return response.data;
  }

  async leaveGathering(gatheringId: string): Promise<void> {
    if (USE_MOCK_DATA && isMockId(gatheringId)) return mockApi.leave(gatheringId);
    await this.instance.post(`/api/v1/gatherings/${gatheringId}/leave`, {});
  }

  async endGathering(gatheringId: string): Promise<void> {
    if (USE_MOCK_DATA && isMockId(gatheringId)) return mockApi.end(gatheringId);
    await this.instance.post(`/api/v1/gatherings/${gatheringId}/end`, {});
  }

  async cancelGathering(gatheringId: string): Promise<void> {
    if (USE_MOCK_DATA && isMockId(gatheringId)) return mockApi.end(gatheringId);
    await this.instance.post(`/api/v1/gatherings/${gatheringId}/cancel`, {});
  }

  // Pending requests to join gatherings you're in
  async getRequestsToApprove(): Promise<JoinRequestsResponse> {
    const request = this.instance.get('/api/v1/gatherings/requests');
    if (!USE_MOCK_DATA) return (await request).data;
    return withMocks(request, 'requests', mockApi.requestsToApprove());
  }

  async getMyRequests(): Promise<JoinRequestsResponse> {
    const request = this.instance.get('/api/v1/gatherings/requests/mine');
    if (!USE_MOCK_DATA) return (await request).data;
    return withMocks(request, 'requests', mockApi.myRequests());
  }

  async approveRequest(requestId: string): Promise<JoinRequest> {
    if (USE_MOCK_DATA && isMockId(requestId)) return mockApi.answer(requestId, 'approved');
    const response = await this.instance.post(`/api/v1/gatherings/requests/${requestId}/approve`, {});
    return response.data;
  }

  async rejectRequest(requestId: string): Promise<JoinRequest> {
    if (USE_MOCK_DATA && isMockId(requestId)) return mockApi.answer(requestId, 'rejected');
    const response = await this.instance.post(`/api/v1/gatherings/requests/${requestId}/reject`, {});
    return response.data;
  }

  async withdrawRequest(requestId: string): Promise<void> {
    if (USE_MOCK_DATA && isMockId(requestId)) return mockApi.withdraw(requestId);
    await this.instance.post(`/api/v1/gatherings/requests/${requestId}/withdraw`, {});
  }

  // ===== REVIEW ENDPOINTS =====

  async createReview(data: CreateReviewRequest) {
    if (USE_MOCK_DATA && isMockId(data.gatheringId)) return { id: `mock-review-${Date.now()}` };
    const response = await this.instance.post('/api/v1/reviews', data);
    return response.data;
  }

  async getReviewsForUser(userId: string): Promise<ReviewListResponse> {
    if (USE_MOCK_DATA && isMockId(userId)) return mockApi.reviewsFor(userId);
    const response = await this.instance.get(`/api/v1/reviews/user/${userId}`);
    return response.data;
  }

  // ===== BLOCK ENDPOINTS =====

  async blockUser(userId: string, reason?: string) {
    const response = await this.instance.post('/api/v1/blocks', {
      userId,
      reason,
    });
    return response.data;
  }

  async unblockUser(userId: string) {
    const response = await this.instance.delete(`/api/v1/blocks/${userId}`);
    return response.data;
  }

  async getBlockList() {
    const response = await this.instance.get('/api/v1/blocks');
    return response.data;
  }

  // ===== UTILITY =====

  setAuthToken(token: string) {
    this.instance.defaults.headers.common.Authorization = `Bearer ${token}`;
  }

  clearAuthToken() {
    delete this.instance.defaults.headers.common.Authorization;
  }

  // Called when a refresh is rejected, so the app can return to sign-in
  setOnSessionOver(handler: () => void) {
    this.onSessionOver = handler;
  }
}

// Appends mock items to a list response; if the real request fails (e.g. backend
// offline), the mocks are still returned so the UI can be exercised.
async function withMocks<T>(
  request: Promise<{ data: any }>,
  key: string,
  mocks: T[],
  limit?: number,
) {
  let data: any = {};
  try {
    data = (await request).data ?? {};
  } catch (error) {
    console.warn(`[mock] real request failed, showing mock ${key} only`, error);
  }
  let items = [...(data[key] ?? []), ...mocks];
  if (limit !== undefined) items = items.slice(0, limit);
  return { ...data, [key]: items, count: items.length };
}

export const apiClient = new ApiClient();

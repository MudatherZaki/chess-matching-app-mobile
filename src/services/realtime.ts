import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '@services/api';
import {
  GatheringUpdatedPayload,
  JoinRequestReceivedPayload,
  JoinRequestResolvedPayload,
  MemberJoinedPayload,
} from '@/types';

export interface RealtimeHandlers {
  onJoinRequestReceived?: (payload: JoinRequestReceivedPayload) => void;
  onJoinRequestResolved?: (payload: JoinRequestResolvedPayload) => void;
  onMemberJoined?: (payload: MemberJoinedPayload) => void;
  onGatheringUpdated?: (payload: GatheringUpdatedPayload) => void;
}

let connection: HubConnection | null = null;

/**
 * Connects to the backend's notification hub so join requests, approvals and
 * gathering changes show up without a manual refresh. Best effort: if the
 * connection fails the app still works through pull-to-refresh.
 */
export async function startRealtime(handlers: RealtimeHandlers) {
  await stopRealtime();

  connection = new HubConnectionBuilder()
    .withUrl(`${BASE_URL}/hub/notifications`, {
      accessTokenFactory: async () => (await AsyncStorage.getItem('accessToken')) ?? '',
    })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build();

  // Handlers must return nothing: SignalR treats a returned value (even a
  // promise) as a client result and logs an error, since the server sends
  // these as plain notifications.
  const on = <T>(event: string, handler?: (payload: T) => unknown) => {
    if (handler) {
      connection!.on(event, (payload: T) => {
        handler(payload);
      });
    }
  };
  on('JoinRequestReceived', handlers.onJoinRequestReceived);
  on('JoinRequestResolved', handlers.onJoinRequestResolved);
  on('MemberJoined', handlers.onMemberJoined);
  on('GatheringUpdated', handlers.onGatheringUpdated);

  // Sent by the hub but not used by the app yet; a handler keeps SignalR from
  // warning "No client method with the name ... found" on each one
  for (const unused of ['UserAvailabilityChanged', 'UserCameOnline', 'UserWentOffline', 'MessageReceived']) {
    connection.on(unused, () => {});
  }

  try {
    await connection.start();
  } catch (error) {
    console.warn('Live updates unavailable, falling back to refresh:', error);
  }
}

export async function stopRealtime() {
  const current = connection;
  connection = null;
  if (current && current.state !== HubConnectionState.Disconnected) {
    await current.stop().catch(() => {});
  }
}

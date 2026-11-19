import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ChatReceipt, GatheringPerson, GatheringsStackParamList } from '@/types';
import { errorMessage } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import {
  ChatMessage,
  DeliveryStatus,
  receiptSummary,
  toMs,
  useChatStore,
} from '@/store/chatStore';
import { Avatar, Button, EmptyState, LoadingSpinner } from '@/components';
import { colors, radius, spacing, typography } from '@/theme';
import { timeUtils } from '@/utils';

type Props = NativeStackScreenProps<GatheringsStackParamList, 'GatheringChat'>;

const MAX_LENGTH = 1000;
// Messages from the same person this close together share one name and avatar
const GROUP_WINDOW_MS = 5 * 60_000;

export default function GatheringChatScreen({ route, navigation }: Props) {
  const { gatheringId, title } = route.params;
  const user = useAuthStore(s => s.user);
  const thread = useChatStore(s => s.threads[gatheringId]);
  const load = useChatStore(s => s.load);
  const loadOlder = useChatStore(s => s.loadOlder);
  const send = useChatStore(s => s.send);
  const setOpenChat = useChatStore(s => s.setOpenChat);
  const markRead = useChatStore(s => s.markRead);

  const headerHeight = useHeaderHeight();
  const [draft, setDraft] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (title) navigation.setOptions({ headerTitle: title });
  }, [navigation, title]);

  const refresh = useCallback(() => {
    setLoadError(null);
    load(gatheringId).catch(e => setLoadError(errorMessage(e, "Couldn't load the chat")));
  }, [gatheringId, load]);

  useFocusEffect(
    useCallback(() => {
      setOpenChat(gatheringId);
      markRead(gatheringId);
      refresh();
      return () => setOpenChat(null);
    }, [gatheringId, markRead, refresh, setOpenChat]),
  );

  // Newest first, for the inverted list
  const messages = useMemo(() => [...(thread?.messages ?? [])].reverse(), [thread?.messages]);

  const submit = async () => {
    const body = draft.trim();
    if (!body || !user) return;
    const me: GatheringPerson = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      photoUrl: user.photoUrl,
      hasBoard: false,
    };
    setDraft('');
    try {
      await send(gatheringId, body, me);
    } catch (e) {
      // Give the text back so nothing typed is lost
      setDraft(current => current || body);
      Alert.alert('Message not sent', errorMessage(e, 'Please try again.'));
      // The chat may have just closed; pick up the new state
      refresh();
    }
  };

  const loadEarlier = () => {
    loadOlder(gatheringId).catch(e =>
      Alert.alert("Couldn't load earlier messages", errorMessage(e, 'Please try again.')),
    );
  };

  if (!thread?.loaded) {
    if (!loadError) return <LoadingSpinner message="Loading chat..." />;
    return (
      <View style={styles.flex}>
        <EmptyState icon="cloud-off" title="Chat unavailable" subtitle={loadError} />
        <Button title="Try again" variant="outline" onPress={refresh} style={styles.retry} />
      </View>
    );
  }

  const renderItem = ({ item, index }: { item: ChatMessage; index: number }) => {
    const older = messages[index + 1];
    const startsGroup =
      !older ||
      older.sender.id !== item.sender.id ||
      toMs(item.createdAt) - toMs(older.createdAt) > GROUP_WINDOW_MS;
    return (
      <MessageRow
        message={item}
        mine={item.sender.id === user?.id}
        startsGroup={startsGroup}
        receipts={thread.receipts}
      />
    );
  };

  const canSend = thread.canSend;
  const blank = draft.trim().length === 0;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      // Android resizes the window itself (adjustResize)
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}>
      {messages.length === 0 ? (
        <View style={styles.flex}>
          <EmptyState
            icon="chat-bubble-outline"
            title="No messages yet"
            subtitle={canSend ? 'Say hi, or let everyone know when you’ll get there.' : undefined}
          />
        </View>
      ) : (
        <FlatList
          inverted
          data={messages}
          keyExtractor={m => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          onEndReached={thread.hasMore ? loadEarlier : undefined}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            thread.loadingOlder ? <ActivityIndicator color={colors.primary} style={styles.older} /> : null
          }
        />
      )}

      {canSend ? (
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Message the group"
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={MAX_LENGTH}
          />
          <TouchableOpacity
            onPress={submit}
            disabled={blank}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            style={[styles.send, blank && styles.sendDisabled]}>
            <Icon name="send" size={20} color={colors.textInverse} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.closed}>
          <Icon name="lock-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.closedText}>This gathering is over, so the chat is read-only.</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const TICKS: Record<DeliveryStatus, { icon: string; label: string }> = {
  sending: { icon: 'clock-outline', label: 'Sending' },
  sent: { icon: 'check', label: 'Sent' },
  delivered: { icon: 'check-all', label: 'Delivered to everyone' },
  read: { icon: 'check-all', label: 'Read by everyone' },
};

const names = (people: GatheringPerson[]) => people.map(p => p.fullName || p.username).join(', ');

// Who in the group has received and seen one of your messages
const showReceipts = (message: ChatMessage, receipts: Record<string, ChatReceipt>) => {
  const { readBy, deliveredTo, waitingOn } = receiptSummary(message, receipts);
  const lines = [
    readBy.length > 0 && `Read by: ${names(readBy)}`,
    deliveredTo.length > 0 && `Delivered to: ${names(deliveredTo)}`,
    waitingOn.length > 0 && `Not delivered yet: ${names(waitingOn)}`,
  ].filter(Boolean);
  Alert.alert('Message info', lines.length > 0 ? lines.join('\n\n') : 'Nobody else is in this gathering yet.');
};

function MessageRow({
  message,
  mine,
  startsGroup,
  receipts,
}: {
  message: ChatMessage;
  mine: boolean;
  startsGroup: boolean;
  receipts: Record<string, ChatReceipt>;
}) {
  const { sender } = message;
  const time = timeUtils.formatTime(new Date(toMs(message.createdAt)));
  const status = mine ? receiptSummary(message, receipts).status : null;
  const tick = status ? TICKS[status] : null;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={!mine || message.pending}
      onPress={() => showReceipts(message, receipts)}
      accessibilityLabel={tick ? `${message.body}. ${tick.label}` : undefined}
      style={[styles.row, mine && styles.rowMine, startsGroup && styles.rowGroupStart]}>
      {!mine && (
        <View style={styles.avatarSlot}>
          {startsGroup && (
            <Avatar photoUrl={sender.photoUrl} username={sender.username} size={30} shape="circle" />
          )}
        </View>
      )}
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        {!mine && startsGroup && <Text style={styles.sender}>{sender.fullName || sender.username}</Text>}
        <Text style={[styles.body, mine && styles.bodyMine]}>{message.body}</Text>
        <View style={styles.meta}>
          <Text style={[styles.time, mine && styles.timeMine]}>{message.pending ? 'Sending…' : time}</Text>
          {tick && (
            <Icon
              name={tick.icon}
              size={15}
              color={status === 'read' ? colors.receiptRead : colors.textInverse}
              style={[styles.tick, status !== 'read' && styles.tickDim]}
            />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  retry: { marginHorizontal: spacing.lg, marginBottom: spacing.xxl },
  list: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  older: { marginVertical: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 2 },
  rowMine: { justifyContent: 'flex-end' },
  rowGroupStart: { marginTop: spacing.sm + 2 },
  avatarSlot: { width: 30, marginRight: spacing.sm },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: radius.sm },
  bubbleTheirs: { backgroundColor: colors.surfaceAlt, borderBottomLeftRadius: radius.sm },
  sender: { ...typography.caption, fontWeight: '700', color: colors.secondary, marginBottom: 2 },
  body: { ...typography.body, color: colors.textPrimary },
  bodyMine: { color: colors.textInverse },
  meta: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 2 },
  time: { ...typography.small, color: colors.textTertiary },
  timeMine: { color: colors.textInverse, opacity: 0.7 },
  tick: { marginLeft: 3 },
  tickDim: { opacity: 0.6 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    ...typography.body,
    flex: 1,
    maxHeight: 120,
    minHeight: 42,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: 11,
    paddingBottom: 11,
    marginRight: spacing.sm,
  },
  send: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
  closed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  closedText: { ...typography.caption, color: colors.textSecondary, marginLeft: spacing.sm },
});

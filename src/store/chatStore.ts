import { create } from 'zustand';
import { apiClient } from '@services/api';
import {
  ChatReceipt,
  GatheringChatReceiptPayload,
  GatheringMessage,
  GatheringPerson,
  UpdateChatReceiptRequest,
} from '@/types';

// A message you've sent that the server hasn't confirmed yet
export interface ChatMessage extends GatheringMessage {
  pending?: boolean;
}

export interface ChatThread {
  messages: ChatMessage[]; // oldest first
  hasMore: boolean;
  canSend: boolean;
  loaded: boolean;
  loadingOlder: boolean;
  // Each member's receipts, by user id
  receipts: Record<string, ChatReceipt>;
}

interface ChatState {
  threads: Record<string, ChatThread>;
  // Per gathering, all as message createdAt values: the latest message we know
  // of, and how far you've received and read. latestAt past lastReadAt is the
  // unread dot. Your receipts come from the server, so they follow you across devices.
  latestAt: Record<string, string>;
  lastReadAt: Record<string, string>;
  deliveredAt: Record<string, string>;
  // The chat on screen right now; messages arriving there count as read
  openChatId: string | null;
  userId: string | null;

  setUser: (userId: string) => void;
  reset: () => void;
  load: (gatheringId: string) => Promise<void>;
  loadOlder: (gatheringId: string) => Promise<void>;
  send: (gatheringId: string, body: string, me: GatheringPerson) => Promise<void>;
  receive: (message: GatheringMessage) => void;
  applyReceipt: (payload: GatheringChatReceiptPayload) => void;
  // What the gathering detail says: the latest message, and how far you've read
  noteGathering: (gatheringId: string, lastMessageAt?: string, myReadUpTo?: string) => void;
  setOpenChat: (gatheringId: string | null) => void;
  markRead: (gatheringId: string) => void;
  markDelivered: (gatheringId: string, upTo: string) => void;
}

// The server sends microseconds; keep milliseconds so every JS engine parses it
export const toMs = (iso: string) => Date.parse(iso.replace(/(\.\d{3})\d+/, '$1'));

const byTime = (a: GatheringMessage, b: GatheringMessage) =>
  toMs(a.createdAt) - toMs(b.createdAt) || (a.id < b.id ? -1 : 1);

const merge = (existing: ChatMessage[], incoming: GatheringMessage[]): ChatMessage[] => {
  const byId = new Map(existing.map(m => [m.id, m]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort(byTime);
};

const isAfter = (at: string | undefined, than: string | undefined) =>
  !!at && (!than || toMs(at) > toMs(than));
const later = (a: string | undefined, b: string | undefined) => (isAfter(b, a) ? b : a);
const reached = (upTo: string | undefined, at: string) => !!upTo && toMs(upTo) >= toMs(at);

const emptyThread: ChatThread = {
  messages: [],
  hasMore: false,
  canSend: true,
  loaded: false,
  loadingOlder: false,
  receipts: {},
};

export const hasUnread = (state: Pick<ChatState, 'latestAt' | 'lastReadAt'>, gatheringId: string) =>
  isAfter(state.latestAt[gatheringId], state.lastReadAt[gatheringId]);

export type DeliveryStatus = 'sending' | 'sent' | 'delivered' | 'read';

export interface ReceiptSummary {
  status: DeliveryStatus;
  readBy: GatheringPerson[];
  deliveredTo: GatheringPerson[];
  waitingOn: GatheringPerson[];
}

/**
 * Where one of your messages has got to with everyone else in the gathering:
 * delivered once it reached all of them, read once all of them have seen it.
 */
export const receiptSummary = (message: ChatMessage, receipts: Record<string, ChatReceipt>): ReceiptSummary => {
  const others = Object.values(receipts).filter(r => r.member.id !== message.sender.id);
  const readBy = others.filter(r => reached(r.readUpTo, message.createdAt));
  const deliveredTo = others.filter(
    r => !reached(r.readUpTo, message.createdAt) && reached(r.deliveredUpTo, message.createdAt),
  );
  const waitingOn = others.filter(r => !reached(r.deliveredUpTo, message.createdAt) && !readBy.includes(r));

  let status: DeliveryStatus = 'sent';
  if (message.pending) status = 'sending';
  else if (others.length > 0 && readBy.length === others.length) status = 'read';
  else if (others.length > 0 && waitingOn.length === 0) status = 'delivered';

  const people = (list: ChatReceipt[]) => list.map(r => r.member);
  return { status, readBy: people(readBy), deliveredTo: people(deliveredTo), waitingOn: people(waitingOn) };
};

export const useChatStore = create<ChatState>((set, get) => {
  const thread = (gatheringId: string) => get().threads[gatheringId] ?? emptyThread;

  const updateThread = (gatheringId: string, change: (current: ChatThread) => Partial<ChatThread>) =>
    set(state => {
      const current = state.threads[gatheringId] ?? emptyThread;
      return { threads: { ...state.threads, [gatheringId]: { ...current, ...change(current) } } };
    });

  // Best effort: a lost receipt only means someone's ticks lag until the next one
  const sendReceipt = (gatheringId: string, receipt: UpdateChatReceiptRequest) => {
    apiClient.updateChatReceipt(gatheringId, receipt).catch(error => {
      console.warn('Failed to send chat receipt:', error);
    });
  };

  const setLater = (key: 'latestAt' | 'lastReadAt' | 'deliveredAt', gatheringId: string, at?: string) => {
    if (!isAfter(at, get()[key][gatheringId])) return false;
    set(state => ({ [key]: { ...state[key], [gatheringId]: at! } }) as Partial<ChatState>);
    return true;
  };

  return {
    threads: {},
    latestAt: {},
    lastReadAt: {},
    deliveredAt: {},
    openChatId: null,
    userId: null,

    setUser: userId => set({ userId }),

    reset: () =>
      set({ threads: {}, latestAt: {}, lastReadAt: {}, deliveredAt: {}, openChatId: null, userId: null }),

    load: async gatheringId => {
      const page = await apiClient.getGatheringMessages(gatheringId);
      const receipts = Object.fromEntries(page.receipts.map(r => [r.member.id, r]));
      updateThread(gatheringId, current => {
        const confirmed = current.messages.filter(m => !m.pending);
        const newest = confirmed[confirmed.length - 1];
        // More than a page arrived since we last looked: drop what we had
        // rather than show the list with a hole in it
        const gap =
          page.hasMore &&
          !!newest &&
          page.messages.length > 0 &&
          toMs(newest.createdAt) < toMs(page.messages[0].createdAt);
        const fresh = !current.loaded || gap || confirmed.length === 0;
        const kept = gap ? current.messages.filter(m => m.pending) : current.messages;
        return {
          messages: merge(kept, page.messages),
          hasMore: fresh ? page.hasMore : current.hasMore,
          canSend: page.canSend,
          loaded: true,
          receipts,
        };
      });

      const mine = get().userId ? receipts[get().userId!] : undefined;
      setLater('lastReadAt', gatheringId, mine?.readUpTo);
      setLater('deliveredAt', gatheringId, mine?.deliveredUpTo);
      const last = page.messages[page.messages.length - 1];
      if (last) {
        setLater('latestAt', gatheringId, last.createdAt);
        if (get().openChatId === gatheringId) get().markRead(gatheringId);
        else get().markDelivered(gatheringId, last.createdAt);
      }
    },

    loadOlder: async gatheringId => {
      const current = thread(gatheringId);
      const oldest = current.messages.find(m => !m.pending);
      if (!current.hasMore || current.loadingOlder || !oldest) return;

      updateThread(gatheringId, () => ({ loadingOlder: true }));
      try {
        const page = await apiClient.getGatheringMessages(gatheringId, oldest.createdAt);
        updateThread(gatheringId, latest => ({
          messages: merge(latest.messages, page.messages),
          hasMore: page.hasMore,
          loadingOlder: false,
        }));
      } catch (error) {
        updateThread(gatheringId, () => ({ loadingOlder: false }));
        throw error;
      }
    },

    send: async (gatheringId, body, me) => {
      const local: ChatMessage = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        gatheringId,
        sender: me,
        body,
        createdAt: new Date().toISOString(),
        pending: true,
      };
      updateThread(gatheringId, current => ({ messages: [...current.messages, local] }));

      try {
        const sent = await apiClient.sendGatheringMessage(gatheringId, body);
        // The live event for it may have arrived first; merge keeps one copy
        updateThread(gatheringId, current => ({
          messages: merge(current.messages.filter(m => m.id !== local.id), [sent]),
        }));
        // The server already counts your own message as read by you
        setLater('latestAt', gatheringId, sent.createdAt);
        setLater('lastReadAt', gatheringId, sent.createdAt);
        setLater('deliveredAt', gatheringId, sent.createdAt);
      } catch (error) {
        updateThread(gatheringId, current => ({
          messages: current.messages.filter(m => m.id !== local.id),
        }));
        throw error;
      }
    },

    receive: message => {
      const { gatheringId } = message;
      if (get().threads[gatheringId]?.loaded) {
        updateThread(gatheringId, current => ({ messages: merge(current.messages, [message]) }));
      }
      setLater('latestAt', gatheringId, message.createdAt);

      if (message.sender.id === get().userId) {
        // Sent from another of your devices; the server marked it read for you
        setLater('lastReadAt', gatheringId, message.createdAt);
        setLater('deliveredAt', gatheringId, message.createdAt);
      } else if (get().openChatId === gatheringId) {
        get().markRead(gatheringId);
      } else {
        get().markDelivered(gatheringId, message.createdAt);
      }
    },

    applyReceipt: ({ gatheringId, userId, deliveredUpTo, readUpTo }) => {
      if (userId === get().userId) {
        // You, on another device
        setLater('lastReadAt', gatheringId, readUpTo);
        setLater('deliveredAt', gatheringId, deliveredUpTo);
      }
      const current = get().threads[gatheringId];
      if (!current?.loaded) return;
      const existing = current.receipts[userId];
      if (!existing) {
        // Someone new joined; reload to learn who they are
        if (get().openChatId === gatheringId) get().load(gatheringId).catch(() => {});
        return;
      }
      updateThread(gatheringId, latest => ({
        receipts: {
          ...latest.receipts,
          [userId]: {
            ...existing,
            deliveredUpTo: later(existing.deliveredUpTo, deliveredUpTo),
            readUpTo: later(existing.readUpTo, readUpTo),
          },
        },
      }));
    },

    noteGathering: (gatheringId, lastMessageAt, myReadUpTo) => {
      setLater('latestAt', gatheringId, lastMessageAt);
      setLater('lastReadAt', gatheringId, myReadUpTo);
      // Seeing that a message exists counts as receiving it
      if (lastMessageAt) get().markDelivered(gatheringId, lastMessageAt);
    },

    setOpenChat: gatheringId => set({ openChatId: gatheringId }),

    markRead: gatheringId => {
      const latest = get().latestAt[gatheringId];
      if (!latest || !hasUnread(get(), gatheringId)) return;
      setLater('lastReadAt', gatheringId, latest);
      setLater('deliveredAt', gatheringId, latest);
      sendReceipt(gatheringId, { readUpTo: latest });
    },

    markDelivered: (gatheringId, upTo) => {
      // Anything already read counts as delivered
      if (!isAfter(upTo, later(get().deliveredAt[gatheringId], get().lastReadAt[gatheringId]))) return;
      setLater('deliveredAt', gatheringId, upTo);
      sendReceipt(gatheringId, { deliveredUpTo: upTo });
    },
  };
});

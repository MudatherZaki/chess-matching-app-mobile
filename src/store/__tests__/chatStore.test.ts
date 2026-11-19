import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@services/api', () => ({
  apiClient: {
    getGatheringMessages: jest.fn(),
    sendGatheringMessage: jest.fn(),
    updateChatReceipt: jest.fn(),
  },
}));

const { apiClient } = require('@services/api');
const { useChatStore, hasUnread, receiptSummary } = require('../chatStore');

const ME = { id: 'me', username: 'me', hasBoard: false };
const ANA = { id: 'ana', username: 'ana', hasBoard: true };
const G = 'g1';

// Server-style timestamps, microsecond precision
const at = (minute: number) => `2026-11-19T18:${String(minute).padStart(2, '0')}:00.123456Z`;
const msg = (id: string, minute: number, sender = ANA) => ({
  id,
  gatheringId: G,
  sender,
  body: `body ${id}`,
  createdAt: at(minute),
});
const page = (messages: any[], hasMore = false, canSend = true, receipts: any[] = []) => ({
  messages,
  count: messages.length,
  hasMore,
  canSend,
  receipts,
});
const ids = () => useChatStore.getState().threads[G].messages.map((m: any) => m.id);

beforeEach(async () => {
  apiClient.getGatheringMessages.mockReset();
  apiClient.sendGatheringMessage.mockReset();
  apiClient.updateChatReceipt.mockReset();
  apiClient.updateChatReceipt.mockResolvedValue(undefined);
  await AsyncStorage.clear();
  useChatStore.getState().reset();
  useChatStore.setState({ userId: 'me' });
});

describe('loading', () => {
  it('keeps earlier pages when catching up, and pages back from the oldest message', async () => {
    apiClient.getGatheringMessages.mockResolvedValueOnce(page([msg('b', 2), msg('c', 3)], true));
    await useChatStore.getState().load(G);

    apiClient.getGatheringMessages.mockResolvedValueOnce(page([msg('a', 1)], false));
    await useChatStore.getState().loadOlder(G);
    expect(apiClient.getGatheringMessages).toHaveBeenLastCalledWith(G, at(2));

    apiClient.getGatheringMessages.mockResolvedValueOnce(page([msg('c', 3), msg('d', 4)], true));
    await useChatStore.getState().load(G);

    expect(ids()).toEqual(['a', 'b', 'c', 'd']);
    expect(useChatStore.getState().threads[G].hasMore).toBe(false);
  });

  it('drops what it had when more than a page arrived since, rather than leave a hole', async () => {
    apiClient.getGatheringMessages.mockResolvedValueOnce(page([msg('a', 1)]));
    await useChatStore.getState().load(G);

    apiClient.getGatheringMessages.mockResolvedValueOnce(page([msg('y', 30), msg('z', 31)], true));
    await useChatStore.getState().load(G);

    expect(ids()).toEqual(['y', 'z']);
    expect(useChatStore.getState().threads[G].hasMore).toBe(true);
  });
});

describe('sending', () => {
  it('shows the message right away and keeps one copy when the live event wins the race', async () => {
    let resolve!: (m: any) => void;
    apiClient.getGatheringMessages.mockResolvedValueOnce(page([]));
    apiClient.sendGatheringMessage.mockReturnValueOnce(new Promise(r => (resolve = r)));
    await useChatStore.getState().load(G);

    const sending = useChatStore.getState().send(G, 'On my way', ME);
    expect(useChatStore.getState().threads[G].messages[0]).toMatchObject({ body: 'On my way', pending: true });

    const confirmed = { ...msg('s1', 5, ME), body: 'On my way' };
    useChatStore.getState().receive(confirmed);
    resolve(confirmed);
    await sending;

    expect(ids()).toEqual(['s1']);
  });

  it('removes the message again when sending fails', async () => {
    apiClient.getGatheringMessages.mockResolvedValueOnce(page([]));
    apiClient.sendGatheringMessage.mockRejectedValueOnce(new Error('closed'));
    await useChatStore.getState().load(G);

    await expect(useChatStore.getState().send(G, 'hi', ME)).rejects.toThrow('closed');
    expect(ids()).toEqual([]);
  });
});

describe('unread and receipts', () => {
  it('flags new messages as unread and tells the server they were delivered', () => {
    useChatStore.getState().receive(msg('a', 1));

    expect(hasUnread(useChatStore.getState(), G)).toBe(true);
    expect(apiClient.updateChatReceipt).toHaveBeenCalledWith(G, { deliveredUpTo: at(1) });
  });

  it('marks messages read while their chat is open, and never your own', () => {
    useChatStore.getState().setOpenChat(G);
    useChatStore.getState().receive(msg('a', 1));
    expect(hasUnread(useChatStore.getState(), G)).toBe(false);
    expect(apiClient.updateChatReceipt).toHaveBeenCalledWith(G, { readUpTo: at(1) });

    useChatStore.getState().setOpenChat(null);
    apiClient.updateChatReceipt.mockClear();
    useChatStore.getState().receive(msg('b', 2, ME));
    expect(hasUnread(useChatStore.getState(), G)).toBe(false);
    expect(apiClient.updateChatReceipt).not.toHaveBeenCalled();
  });

  it('takes your read position from the server, so another device clears the dot', () => {
    useChatStore.getState().noteGathering(G, at(3), undefined);
    expect(hasUnread(useChatStore.getState(), G)).toBe(true);

    useChatStore.getState().applyReceipt({ gatheringId: G, userId: 'me', readUpTo: at(3) });
    expect(hasUnread(useChatStore.getState(), G)).toBe(false);
  });

  it("follows other members' receipts as they arrive", async () => {
    const receipts = [
      { member: ME, readUpTo: at(1) },
      { member: ANA },
    ];
    apiClient.getGatheringMessages.mockResolvedValueOnce(page([msg('m', 1, ME)], false, true, receipts));
    await useChatStore.getState().load(G);
    const status = () => {
      const thread = useChatStore.getState().threads[G];
      return receiptSummary(thread.messages[0], thread.receipts).status;
    };
    expect(status()).toBe('sent');

    useChatStore.getState().applyReceipt({ gatheringId: G, userId: 'ana', deliveredUpTo: at(1) });
    expect(status()).toBe('delivered');

    useChatStore.getState().applyReceipt({ gatheringId: G, userId: 'ana', readUpTo: at(1) });
    expect(status()).toBe('read');

    // A stale receipt never moves the ticks back
    useChatStore.getState().applyReceipt({ gatheringId: G, userId: 'ana', readUpTo: at(0) });
    expect(status()).toBe('read');
  });
});

describe('receiptSummary', () => {
  const BO = { id: 'bo', username: 'bo', hasBoard: false };
  const mine = msg('m', 5, ME);

  it('is only read once everyone else has read it', () => {
    const summary = receiptSummary(mine, {
      me: { member: ME, readUpTo: at(5) },
      ana: { member: ANA, deliveredUpTo: at(5), readUpTo: at(5) },
      bo: { member: BO, deliveredUpTo: at(6) },
    });
    expect(summary.status).toBe('delivered');
    expect(summary.readBy).toEqual([ANA]);
    expect(summary.deliveredTo).toEqual([BO]);
    expect(summary.waitingOn).toEqual([]);
  });

  it('stays sent while anyone has not received it, and while you are alone', () => {
    expect(
      receiptSummary(mine, { ana: { member: ANA, readUpTo: at(5) }, bo: { member: BO, deliveredUpTo: at(4) } })
        .status,
    ).toBe('sent');
    expect(receiptSummary(mine, { me: { member: ME } }).status).toBe('sent');
    expect(receiptSummary({ ...mine, pending: true }, {}).status).toBe('sending');
  });
});

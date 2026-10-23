import { incoming } from '@/test/factories';
import { createChatsStore } from './chatsStore';
import { selectSortedChats } from './selectSortedChats';
import { firstUnreadId, unreadCount } from './unread';

describe('chats store: sending', () => {
  it('shows an outgoing message as pending right away', () => {
    const store = createChatsStore('1101000001');

    const localId = store.getState().startSending('10000000', 'Hello');

    expect(store.getState().chats['10000000'].messages).toMatchObject([
      {
        id: localId,
        direction: 'outgoing',
        content: { kind: 'text', text: 'Hello' },
        status: 'pending',
      },
    ]);
    expect(
      store.getState().chats['10000000'].messages[0].idMessage,
    ).toBeUndefined();
  });
});

describe('chats store: unread messages', () => {
  const chatOf = (store: ReturnType<typeof createChatsStore>) =>
    store.getState().chats['10000000'];

  it('counts incoming messages as unread until the chat is read', () => {
    const store = createChatsStore('1101000001');

    store.getState().applyEvent(incoming({ idMessage: 'A1', timestamp: 100 }));
    store.getState().applyEvent(incoming({ idMessage: 'A2', timestamp: 200 }));

    expect(unreadCount(chatOf(store))).toBe(2);
    expect(firstUnreadId(chatOf(store))).toBe('A1');
  });

  it('has nothing unread once the chat is marked read, and counts only what comes after', () => {
    const store = createChatsStore('1101000001');
    store.getState().applyEvent(incoming({ idMessage: 'A1', timestamp: 100 }));

    store.getState().markRead('10000000');
    expect(unreadCount(chatOf(store))).toBe(0);
    expect(firstUnreadId(chatOf(store))).toBeUndefined();

    store.getState().applyEvent(incoming({ idMessage: 'A2', timestamp: 200 }));
    expect(unreadCount(chatOf(store))).toBe(1);
    expect(firstUnreadId(chatOf(store))).toBe('A2');
  });

  it('does not count messages written by the user', () => {
    const store = createChatsStore('1101000001');
    store.getState().applyEvent(incoming({ idMessage: 'A1', timestamp: 100 }));
    store
      .getState()
      .applyEvent(
        incoming({ direction: 'outgoing', idMessage: 'O1', timestamp: 200 }),
      );
    store.getState().applyEvent(incoming({ idMessage: 'A2', timestamp: 300 }));
    store.getState().markRead('10000000');

    store
      .getState()
      .applyEvent(
        incoming({ direction: 'outgoing', idMessage: 'O2', timestamp: 400 }),
      );

    expect(unreadCount(chatOf(store))).toBe(0);
  });

  it('counts a message written on the phone as read, as it was written by the user', () => {
    const store = createChatsStore('1101000001');
    store.getState().applyEvent(incoming({ idMessage: 'A1', timestamp: 100 }));
    store.getState().markRead('10000000');

    store
      .getState()
      .applyEvent(
        incoming({ direction: 'outgoing', idMessage: 'O1', timestamp: 200 }),
      );
    store.getState().applyEvent(incoming({ idMessage: 'A2', timestamp: 300 }));

    expect(firstUnreadId(chatOf(store))).toBe('A2');
  });

  it('treats everything as read after the user sends a message', () => {
    const store = createChatsStore('1101000001');
    store.getState().applyEvent(incoming({ idMessage: 'A1', timestamp: 100 }));
    store.getState().applyEvent(incoming({ idMessage: 'A2', timestamp: 200 }));

    store.getState().startSending('10000000', 'Reply');

    expect(unreadCount(chatOf(store))).toBe(0);
  });

  it('keeps the read marker when the message it pointed at is merged into the local one', () => {
    const store = createChatsStore('1101000001');
    const localId = store.getState().startSending('10000000', 'Hello');
    // An echo that does not match the pending text stays a separate message.
    store.getState().applyEvent(
      incoming({
        direction: 'outgoing',
        idMessage: 'API1',
        content: { kind: 'text', text: 'Hello (edited)' },
        timestamp: Math.floor(Date.now() / 1000),
      }),
    );
    store.getState().markRead('10000000'); // the marker is now the echo

    store.getState().confirmSent('10000000', localId, 'API1'); // echo is removed
    store.getState().applyEvent(
      incoming({
        idMessage: 'A2',
        timestamp: Math.floor(Date.now() / 1000) + 10,
      }),
    );

    expect(unreadCount(chatOf(store))).toBe(1);
  });

  it('has nothing unread in a chat without messages', () => {
    const store = createChatsStore('1101000001');
    store.getState().openChat({ chatId: '10000000' });

    expect(unreadCount(chatOf(store))).toBe(0);
    expect(firstUnreadId(chatOf(store))).toBeUndefined();
  });

  it('remembers what was read across a reload', () => {
    const first = createChatsStore('1101000001');
    first.getState().applyEvent(incoming({ idMessage: 'A1', timestamp: 100 }));
    first.getState().applyEvent(incoming({ idMessage: 'A2', timestamp: 200 }));
    first.getState().markRead('10000000');
    first.getState().applyEvent(incoming({ idMessage: 'A3', timestamp: 300 }));

    const reloaded = createChatsStore('1101000001');

    expect(unreadCount(chatOf(reloaded))).toBe(1);
    expect(firstUnreadId(chatOf(reloaded))).toBe('A3');
  });
});

describe('chats store: robustness', () => {
  it('returns the same sorted list until the chats change', () => {
    const store = createChatsStore('1101000001');
    store.getState().applyEvent(incoming());

    const before = store.getState();
    expect(selectSortedChats(before)).toBe(selectSortedChats(before));

    store.getState().applyEvent(incoming({ idMessage: 'A2' }));
    expect(selectSortedChats(store.getState())).not.toBe(
      selectSortedChats(before),
    );
  });

  it('puts messages in time order even when they arrive out of order', () => {
    const store = createChatsStore('1101000001');

    store
      .getState()
      .applyEvent(incoming({ idMessage: 'late', timestamp: 200 }));
    store
      .getState()
      .applyEvent(incoming({ idMessage: 'early', timestamp: 100 }));

    expect(
      store.getState().chats['10000000'].messages.map((m) => m.idMessage),
    ).toEqual(['early', 'late']);
  });

  it('learns the chat name from a later message', () => {
    const store = createChatsStore('1101000001');
    store.getState().startSending('10000000', 'Hello');

    store.getState().applyEvent(incoming({ chatName: 'Ivan' }));

    expect(store.getState().chats['10000000'].name).toBe('Ivan');
  });

  it('claims the echo of a message that was marked failed but did go out', () => {
    const store = createChatsStore('1101000001');
    const localId = store.getState().startSending('10000000', 'Hello');
    store.getState().failSent('10000000', localId, 'network');

    store.getState().applyEvent(
      incoming({
        direction: 'outgoing',
        idMessage: 'API1',
        content: { kind: 'text', text: 'Hello' },
      }),
    );

    expect(store.getState().chats['10000000'].messages).toMatchObject([
      { id: localId, idMessage: 'API1', status: 'sent' },
    ]);
  });
});

describe('chats store: persistence', () => {
  it('restores chats and known phone numbers for the same instance', () => {
    const first = createChatsStore('1101000001');
    first.getState().applyEvent(incoming());
    first.getState().rememberAccount('79991234567', '10000000');

    const reloaded = createChatsStore('1101000001');

    expect(reloaded.getState().chats['10000000'].messages).toHaveLength(1);
    expect(reloaded.getState().chatIdByPhone).toEqual({
      '79991234567': '10000000',
    });
  });

  it('keeps the chats of different instances apart', () => {
    createChatsStore('1101000001').getState().applyEvent(incoming());

    const other = createChatsStore('1101000002');

    expect(other.getState().chats).toEqual({});
  });

  it('shows a message that was still pending at reload as failed', () => {
    const first = createChatsStore('1101000001');
    first.getState().startSending('10000000', 'Hello');

    const reloaded = createChatsStore('1101000001');

    expect(reloaded.getState().chats['10000000'].messages[0]).toMatchObject({
      status: 'failed',
      errorKind: 'network',
    });
  });
});

describe('chats store: opening chats', () => {
  it('puts a newly opened empty chat first and keeps an existing chat intact', () => {
    const store = createChatsStore('1101000001');
    store.getState().applyEvent(incoming({ chatId: 'A', timestamp: 100 }));

    store.getState().openChat({ chatId: 'B', name: '+7 (999) 123-45-67' });
    store.getState().openChat({ chatId: 'A', name: 'Overwritten?' });

    const chats = selectSortedChats(store.getState());
    expect(chats.map((c) => c.chatId)).toEqual(['B', 'A']);
    expect(chats[0]).toMatchObject({
      name: '+7 (999) 123-45-67',
      messages: [],
    });
    expect(chats[1]).toMatchObject({ name: 'Ivan', messages: [{}] });
  });

  it('remembers which chat id belongs to a phone number', () => {
    const store = createChatsStore('1101000001');

    store.getState().rememberAccount('79991234567', '10000000');

    expect(store.getState().chatIdByPhone['79991234567']).toBe('10000000');
  });
});

describe('chats store: send outcome', () => {
  it('marks a pending message as sent once the API returns its id', () => {
    const store = createChatsStore('1101000001');
    const localId = store.getState().startSending('10000000', 'Hello');

    store.getState().confirmSent('10000000', localId, 'API1');

    expect(store.getState().chats['10000000'].messages).toMatchObject([
      { id: localId, idMessage: 'API1', status: 'sent' },
    ]);
  });

  it('lets later statuses find the message by its API id', () => {
    const store = createChatsStore('1101000001');
    const localId = store.getState().startSending('10000000', 'Hello');
    store.getState().confirmSent('10000000', localId, 'API1');

    store.getState().applyEvent({
      type: 'status',
      idMessage: 'API1',
      chatId: '10000000',
      status: 'read',
    });

    expect(store.getState().chats['10000000'].messages[0].status).toBe('read');
  });

  it('marks a pending message as failed and keeps the error kind', () => {
    const store = createChatsStore('1101000001');
    const localId = store.getState().startSending('10000000', 'Hello');

    store.getState().failSent('10000000', localId, 'quota');

    expect(store.getState().chats['10000000'].messages).toMatchObject([
      { id: localId, status: 'failed', errorKind: 'quota' },
    ]);
  });

  it('keeps one message when the API echo arrives before the send response', () => {
    const store = createChatsStore('1101000001');
    const localId = store.getState().startSending('10000000', 'Hello');

    store
      .getState()
      .applyEvent(incoming({ direction: 'outgoing', idMessage: 'API1' }));
    store.getState().applyEvent({
      type: 'status',
      idMessage: 'API1',
      chatId: '10000000',
      status: 'delivered',
    });
    store.getState().confirmSent('10000000', localId, 'API1');

    expect(store.getState().chats['10000000'].messages).toMatchObject([
      { id: localId, idMessage: 'API1', status: 'delivered' },
    ]);
  });
});

describe('chats store: applying events', () => {
  it('creates a chat for an incoming message from an unknown sender', () => {
    const store = createChatsStore('1101000001');

    store.getState().applyEvent(incoming());

    expect(store.getState().chats['10000000']).toMatchObject({
      chatId: '10000000',
      name: 'Ivan',
      messages: [
        {
          idMessage: 'A1',
          direction: 'incoming',
          content: { kind: 'text', text: 'Hi' },
          timestamp: 1700000000,
        },
      ],
    });
  });

  it('stores an outgoing message from the queue as sent', () => {
    const store = createChatsStore('1101000001');

    store
      .getState()
      .applyEvent(incoming({ direction: 'outgoing', idMessage: 'O1' }));

    expect(store.getState().chats['10000000'].messages[0]).toMatchObject({
      idMessage: 'O1',
      direction: 'outgoing',
      status: 'sent',
    });
  });

  it('moves an outgoing message forward through delivered and read, never back', () => {
    const store = createChatsStore('1101000001');
    const status = (s: 'delivered' | 'read') =>
      store.getState().applyEvent({
        type: 'status',
        idMessage: 'O1',
        chatId: '10000000',
        status: s,
      });
    const current = () => store.getState().chats['10000000'].messages[0].status;
    store
      .getState()
      .applyEvent(incoming({ direction: 'outgoing', idMessage: 'O1' }));

    status('delivered');
    expect(current()).toBe('delivered');
    status('read');
    expect(current()).toBe('read');
    status('delivered');
    expect(current()).toBe('read');
  });

  it('marks an outgoing message as failed when the status says so', () => {
    const store = createChatsStore('1101000001');
    store
      .getState()
      .applyEvent(incoming({ direction: 'outgoing', idMessage: 'O1' }));

    store.getState().applyEvent({
      type: 'status',
      idMessage: 'O1',
      chatId: '10000000',
      status: 'noAccount',
    });

    expect(store.getState().chats['10000000'].messages[0].status).toBe(
      'failed',
    );
  });

  it('ignores a status for a message it does not know', () => {
    const store = createChatsStore('1101000001');

    store.getState().applyEvent({
      type: 'status',
      idMessage: 'NOPE',
      chatId: '10000000',
      status: 'read',
    });

    expect(store.getState().chats).toEqual({});
  });

  it('lists chats by latest activity, newest first', () => {
    const store = createChatsStore('1101000001');
    const apply = (chatId: string, idMessage: string, timestamp: number) =>
      store.getState().applyEvent(incoming({ chatId, idMessage, timestamp }));

    apply('A', 'm1', 100);
    apply('B', 'm2', 200);
    expect(selectSortedChats(store.getState()).map((c) => c.chatId)).toEqual([
      'B',
      'A',
    ]);

    apply('A', 'm3', 300);
    expect(selectSortedChats(store.getState()).map((c) => c.chatId)).toEqual([
      'A',
      'B',
    ]);
  });

  it('ignores a message it has already stored', () => {
    const store = createChatsStore('1101000001');

    store.getState().applyEvent(incoming());
    store.getState().applyEvent(incoming());

    expect(store.getState().chats['10000000'].messages).toHaveLength(1);
  });
});

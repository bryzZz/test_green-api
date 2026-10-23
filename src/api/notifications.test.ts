import { parseNotification } from './notifications';

const instanceData = {
  idInstance: 1101000001,
  wid: '79990000000@c.us',
  typeInstance: 'max',
};

describe('parseNotification', () => {
  it('turns an incoming text message into a message event', () => {
    const event = parseNotification({
      typeWebhook: 'incomingMessageReceived',
      instanceData,
      timestamp: 1700000000,
      idMessage: 'BAE5367237E13A87',
      senderData: {
        chatId: '10000000',
        sender: '10000000',
        chatName: 'Ivan',
        senderName: 'Ivan',
      },
      messageData: {
        typeMessage: 'textMessage',
        textMessageData: { textMessage: 'Hello' },
      },
    });

    expect(event).toEqual({
      type: 'message',
      direction: 'incoming',
      idMessage: 'BAE5367237E13A87',
      chatId: '10000000',
      chatName: 'Ivan',
      timestamp: 1700000000,
      content: { kind: 'text', text: 'Hello' },
    });
  });

  it.each(['outgoingMessageReceived', 'outgoingAPIMessageReceived'])(
    'turns %s into an outgoing message event',
    (typeWebhook) => {
      const event = parseNotification({
        typeWebhook,
        instanceData,
        timestamp: 1700000002,
        idMessage: 'BAE5367237E13A89',
        senderData: {
          chatId: '10000000',
          sender: '79990000000@c.us',
          chatName: 'Ivan',
        },
        messageData: {
          typeMessage: 'textMessage',
          textMessageData: { textMessage: 'Hi there' },
        },
      });

      expect(event).toEqual({
        type: 'message',
        direction: 'outgoing',
        idMessage: 'BAE5367237E13A89',
        chatId: '10000000',
        chatName: 'Ivan',
        timestamp: 1700000002,
        content: { kind: 'text', text: 'Hi there' },
      });
    },
  );

  it('turns outgoingMessageStatus into a status event', () => {
    const event = parseNotification({
      typeWebhook: 'outgoingMessageStatus',
      instanceData,
      timestamp: 1700000003,
      idMessage: 'BAE5367237E13A89',
      chatId: '10000000',
      status: 'read',
      sendByApi: true,
    });

    expect(event).toEqual({
      type: 'status',
      idMessage: 'BAE5367237E13A89',
      chatId: '10000000',
      status: 'read',
    });
  });

  it('reads the text of a reply to another message', () => {
    const event = parseNotification({
      typeWebhook: 'incomingMessageReceived',
      instanceData,
      timestamp: 1700000005,
      idMessage: 'BAE5367237E13A91',
      senderData: { chatId: '10000000', sender: '10000000' },
      messageData: {
        typeMessage: 'quotedMessage',
        extendedTextMessageData: { text: 'Agreed' },
        quotedMessage: {
          stanzaId: 'BAE5367237E13A87',
          typeMessage: 'textMessage',
        },
      },
    });

    expect(event).toMatchObject({
      type: 'message',
      content: { kind: 'text', text: 'Agreed' },
    });
  });

  it('marks a non-text message as unsupported instead of failing', () => {
    const event = parseNotification({
      typeWebhook: 'incomingMessageReceived',
      instanceData,
      timestamp: 1700000004,
      idMessage: 'BAE5367237E13A90',
      senderData: { chatId: '10000000', sender: '10000000' },
      messageData: {
        typeMessage: 'imageMessage',
        fileMessageData: { downloadUrl: 'https://example.com/a.jpg' },
      },
    });

    expect(event).toMatchObject({
      type: 'message',
      idMessage: 'BAE5367237E13A90',
      content: { kind: 'unsupported' },
    });
  });

  it.each([
    ['an unrelated webhook type', { typeWebhook: 'stateInstanceChanged' }],
    ['a malformed message', { typeWebhook: 'incomingMessageReceived' }],
    ['a non-object body', null],
  ])('ignores %s instead of throwing', (_name, body) => {
    expect(parseNotification(body)).toEqual({ type: 'ignored' });
  });

  it('reads the text of an extended text message', () => {
    const event = parseNotification({
      typeWebhook: 'incomingMessageReceived',
      instanceData,
      timestamp: 1700000001,
      idMessage: 'BAE5367237E13A88',
      senderData: { chatId: '10000000', sender: '10000000' },
      messageData: {
        typeMessage: 'extendedTextMessage',
        extendedTextMessageData: { text: 'See https://example.com' },
      },
    });

    expect(event).toMatchObject({
      type: 'message',
      content: { kind: 'text', text: 'See https://example.com' },
    });
  });
});

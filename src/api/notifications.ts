import { z } from 'zod';

export type MessageContent =
  { kind: 'text'; text: string } | { kind: 'unsupported' };

export type MessageStatus =
  'delivered' | 'read' | 'failed' | 'noAccount' | 'notInGroup';

export type NotificationEvent =
  | {
      type: 'message';
      direction: 'incoming' | 'outgoing';
      idMessage: string;
      chatId: string;
      chatName?: string;
      timestamp: number;
      content: MessageContent;
    }
  | {
      type: 'status';
      idMessage: string;
      chatId: string;
      status: MessageStatus;
    }
  | { type: 'ignored' };

const textMessageSchema = z.object({
  typeMessage: z.literal('textMessage'),
  textMessageData: z.object({ textMessage: z.string() }),
});

const extendedTextMessageSchema = z.object({
  typeMessage: z.literal('extendedTextMessage'),
  extendedTextMessageData: z.object({ text: z.string() }),
});

// Anything that is not plain text is shown as a stub, except types that carry
// text in `extendedTextMessageData` (e.g. replies with `quotedMessage`).
const otherMessageSchema = z.object({
  typeMessage: z.string(),
  extendedTextMessageData: z.object({ text: z.string() }).optional(),
});

const messageDataSchema = z.union([
  textMessageSchema,
  extendedTextMessageSchema,
  otherMessageSchema,
]);

const directionByWebhook = {
  incomingMessageReceived: 'incoming',
  outgoingMessageReceived: 'outgoing',
  outgoingAPIMessageReceived: 'outgoing',
} as const;

const messageSchema = z.object({
  typeWebhook: z.enum([
    'incomingMessageReceived',
    'outgoingMessageReceived',
    'outgoingAPIMessageReceived',
  ]),
  timestamp: z.number(),
  idMessage: z.string(),
  senderData: z.object({
    chatId: z.string(),
    chatName: z.string().optional(),
  }),
  messageData: messageDataSchema,
});

const statusSchema = z.object({
  typeWebhook: z.literal('outgoingMessageStatus'),
  idMessage: z.string(),
  chatId: z.string(),
  status: z.enum(['delivered', 'read', 'failed', 'noAccount', 'notInGroup']),
});

const notificationSchema = z.discriminatedUnion('typeWebhook', [
  messageSchema,
  statusSchema,
]);

type MessageData = z.infer<typeof messageDataSchema>;

function toContent(data: MessageData): MessageContent {
  if ('textMessageData' in data) {
    return { kind: 'text', text: data.textMessageData.textMessage };
  }
  if ('extendedTextMessageData' in data && data.extendedTextMessageData) {
    return { kind: 'text', text: data.extendedTextMessageData.text };
  }
  return { kind: 'unsupported' };
}

export function parseNotification(body: unknown): NotificationEvent {
  const parsed = notificationSchema.safeParse(body);
  if (!parsed.success) {
    return { type: 'ignored' };
  }
  const n = parsed.data;

  if (n.typeWebhook === 'outgoingMessageStatus') {
    return {
      type: 'status',
      idMessage: n.idMessage,
      chatId: n.chatId,
      status: n.status,
    };
  }

  return {
    type: 'message',
    direction: directionByWebhook[n.typeWebhook],
    idMessage: n.idMessage,
    chatId: n.senderData.chatId,
    chatName: n.senderData.chatName,
    timestamp: n.timestamp,
    content: toContent(n.messageData),
  };
}

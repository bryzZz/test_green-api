import { z } from 'zod';

// What GREEN-API answers, as far as the app reads it.

export const stateInstanceSchema = z.object({
  stateInstance: z.string(),
});

const yesNo = z.enum(['yes', 'no']);

export const settingsSchema = z.object({
  webhookUrl: z.string(),
  incomingWebhook: yesNo,
  outgoingWebhook: yesNo,
  outgoingMessageWebhook: yesNo,
  outgoingAPIMessageWebhook: yesNo,
});

export type Settings = z.infer<typeof settingsSchema>;

/** `null` while the queue is empty. */
export const receivedSchema = z
  .object({ receiptId: z.number(), body: z.unknown() })
  .nullable();

export const sendMessageSchema = z.object({
  idMessage: z.string(),
});

export const checkAccountSchema = z.object({
  exist: z.boolean(),
  chatId: z.string().optional(),
});

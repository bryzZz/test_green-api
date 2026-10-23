import axios from 'axios';
import { z } from 'zod';
import { ApiError, toApiError } from './errors';
import { parseNotification } from './notifications';

export type Credentials = {
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
};

const stateInstanceSchema = z.object({
  stateInstance: z.string(),
});

const yesNo = z.enum(['yes', 'no']);

const settingsSchema = z.object({
  webhookUrl: z.string(),
  incomingWebhook: yesNo,
  outgoingWebhook: yesNo,
  outgoingMessageWebhook: yesNo,
  outgoingAPIMessageWebhook: yesNo,
});

export type Settings = z.infer<typeof settingsSchema>;

const receivedSchema = z
  .object({ receiptId: z.number(), body: z.unknown() })
  .nullable();

const sendMessageSchema = z.object({
  idMessage: z.string(),
});

const checkAccountSchema = z.object({
  exist: z.boolean(),
  chatId: z.string().optional(),
});

// A 2xx response that doesn't match the schema is a server-side problem.
function parseResponse<T extends z.ZodType>(
  schema: T,
  data: unknown,
): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError('server', { cause: result.error });
  }
  return result.data;
}

export function createGreenApiClient(
  { apiUrl, idInstance, apiTokenInstance }: Credentials,
  { timeout = 30_000 }: { timeout?: number } = {},
) {
  const http = axios.create({
    baseURL: `${apiUrl.replace(/\/+$/, '')}/waInstance${idInstance}`,
    timeout,
    adapter: 'fetch',
  });

  http.interceptors.response.use(undefined, (error: unknown) =>
    Promise.reject(toApiError(error)),
  );

  return {
    async getStateInstance() {
      const { data } = await http.get(`/getStateInstance/${apiTokenInstance}`);
      return parseResponse(stateInstanceSchema, data);
    },

    async getSettings() {
      const { data } = await http.get(`/getSettings/${apiTokenInstance}`);
      return parseResponse(settingsSchema, data);
    },

    async receiveNotification({
      receiveTimeout,
      signal,
    }: { receiveTimeout?: number; signal?: AbortSignal } = {}) {
      const { data } = await http.get(
        `/receiveNotification/${apiTokenInstance}`,
        {
          params: { receiveTimeout },
          signal,
          // The server holds the request for up to `receiveTimeout` seconds.
          timeout:
            receiveTimeout !== undefined
              ? (receiveTimeout + 10) * 1000
              : undefined,
        },
      );
      const notification = parseResponse(receivedSchema, data);
      if (!notification) return null;
      // An `ignored` event still has a receiptId: the caller must delete it
      // too, otherwise the same notification stays at the head of the queue.
      return {
        receiptId: notification.receiptId,
        event: parseNotification(notification.body),
      };
    },

    async deleteNotification(receiptId: number) {
      await http.delete(`/deleteNotification/${apiTokenInstance}/${receiptId}`);
    },

    async sendMessage(params: { chatId: string; message: string }) {
      const { data } = await http.post(
        `/sendMessage/${apiTokenInstance}`,
        params,
      );
      return parseResponse(sendMessageSchema, data);
    },

    async checkAccount(phoneNumber: number) {
      const { data } = await http.post(`/checkAccount/${apiTokenInstance}`, {
        phoneNumber,
      });
      return parseResponse(checkAccountSchema, data);
    },
  };
}

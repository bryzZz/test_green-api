import axios from 'axios';
import type { z } from 'zod';
import { ApiError, toApiError } from './ApiError';
import { parseNotification } from './parseNotification';
import {
  checkAccountSchema,
  receivedSchema,
  sendMessageSchema,
  settingsSchema,
  stateInstanceSchema,
} from './schemas';

export type Credentials = {
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
};

// A 2xx response that doesn't match the schema is a server-side problem.
const parseResponse = <T extends z.ZodType>(
  schema: T,
  data: unknown,
): z.infer<T> => {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError('server', { cause: result.error });
  }
  return result.data;
};

export const createGreenApiClient = (
  { apiUrl, idInstance, apiTokenInstance }: Credentials,
  { timeout = 30_000 }: { timeout?: number } = {},
) => {
  const http = axios.create({
    baseURL: `${apiUrl.replace(/\/+$/, '')}/waInstance${idInstance}`,
    timeout,
    adapter: 'fetch',
  });

  http.interceptors.response.use(undefined, (error: unknown) =>
    Promise.reject(toApiError(error)),
  );

  const getStateInstance = async () => {
    const { data } = await http.get(`/getStateInstance/${apiTokenInstance}`);
    return parseResponse(stateInstanceSchema, data);
  };

  const getSettings = async () => {
    const { data } = await http.get(`/getSettings/${apiTokenInstance}`);
    return parseResponse(settingsSchema, data);
  };

  const receiveNotification = async ({
    receiveTimeout,
    signal,
  }: { receiveTimeout?: number; signal?: AbortSignal } = {}) => {
    const { data } = await http.get(
      `/receiveNotification/${apiTokenInstance}`,
      {
        params: { receiveTimeout },
        signal,
        // The server holds the request for up to `receiveTimeout` seconds.
        timeout:
          receiveTimeout === undefined
            ? undefined
            : (receiveTimeout + 10) * 1000,
      },
    );

    const notification = parseResponse(receivedSchema, data);
    if (!notification) return null;
    // An `ignored` event still has a receiptId: the caller must delete it too,
    // otherwise the same notification stays at the head of the queue.
    return {
      receiptId: notification.receiptId,
      event: parseNotification(notification.body),
    };
  };

  const deleteNotification = async (receiptId: number) => {
    await http.delete(`/deleteNotification/${apiTokenInstance}/${receiptId}`);
  };

  const sendMessage = async (params: { chatId: string; message: string }) => {
    const { data } = await http.post(
      `/sendMessage/${apiTokenInstance}`,
      params,
    );
    return parseResponse(sendMessageSchema, data);
  };

  const checkAccount = async (phoneNumber: number) => {
    const { data } = await http.post(`/checkAccount/${apiTokenInstance}`, {
      phoneNumber,
    });
    return parseResponse(checkAccountSchema, data);
  };

  return {
    getStateInstance,
    getSettings,
    receiveNotification,
    deleteNotification,
    sendMessage,
    checkAccount,
  };
};

export type GreenApiClient = ReturnType<typeof createGreenApiClient>;

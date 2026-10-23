import type { GreenApiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import type { NotificationEvent } from '../../api/notifications';

type PollingOptions = {
  client: Pick<GreenApiClient, 'receiveNotification' | 'deleteNotification'>;
  /** Called for every notification that is worth showing, in queue order. */
  onEvent: (event: NotificationEvent) => void;
  /**
   * `onEvent` threw. That is a bug of ours, not a lost connection: the
   * notification is dropped (still deleted), so it cannot block the queue.
   */
  onEventError?: (error: unknown) => void;
  /** Called only when the state changes; the loop starts as connected. */
  onConnectionChange: (connected: boolean) => void;
  /** The credentials were rejected: the loop has stopped. */
  onUnauthorized: () => void;
  signal: AbortSignal;
  /** Seconds the server may hold an empty request (5..60). */
  receiveTimeout?: number;
  backoff?: { initialMs: number; maxMs: number };
  /**
   * After a failure, a request that is still waiting this long without an
   * error shows that the server is reachable (it is holding the request), so
   * the connection counts as back without waiting for the answer.
   */
  healthyAfterMs?: number;
};

/** Waits, but ends early when the browser comes back online or on abort. */
function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      window.removeEventListener('online', done);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    window.addEventListener('online', done);
    signal.addEventListener('abort', done);
    if (signal.aborted) done();
  });
}

/**
 * Reads the GREEN-API notification queue until aborted: receive one, hand it
 * over, delete it. A notification is deleted only after it was handed over, so
 * it is delivered at least once; the stores drop duplicates by message id.
 */
export async function runPolling({
  client,
  onEvent,
  onEventError = (error) =>
    console.error('Failed to handle a notification', error),
  onConnectionChange,
  onUnauthorized,
  signal,
  receiveTimeout = 20,
  backoff = { initialMs: 1_000, maxMs: 30_000 },
  healthyAfterMs = 1_500,
}: PollingOptions) {
  let connected = true;
  let waitMs = backoff.initialMs;

  const setConnected = (value: boolean) => {
    if (value === connected) return;
    connected = value;
    onConnectionChange(value);
  };

  while (!signal.aborted) {
    // A held request is the normal state of a healthy connection (up to
    // `receiveTimeout` seconds), so don't keep showing "offline" meanwhile.
    const healthyTimer = connected
      ? undefined
      : setTimeout(() => setConnected(true), healthyAfterMs);

    try {
      const received = await client.receiveNotification({
        receiveTimeout,
        signal,
      });
      if (received) {
        // Nothing to show for `ignored`, but it still has to leave the queue.
        if (received.event.type !== 'ignored') {
          try {
            onEvent(received.event);
          } catch (error) {
            onEventError(error);
          }
        }
        await client.deleteNotification(received.receiptId);
      }
      setConnected(true);
      waitMs = backoff.initialMs;
    } catch (error) {
      if (signal.aborted) return;
      if (error instanceof ApiError && error.kind === 'unauthorized') {
        onUnauthorized();
        return;
      }
      setConnected(false);
      await pause(waitMs, signal);
      waitMs = Math.min(waitMs * 2, backoff.maxMs);
    } finally {
      clearTimeout(healthyTimer);
    }
  }
}

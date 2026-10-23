type QueuedNotification = { receiptId: number; body: unknown };

/**
 * The notification queue of the fake GREEN-API. Like the real one it keeps a
 * notification until it is deleted, and it holds a request for an empty queue
 * until something arrives.
 */
export const createNotificationQueue = () => {
  let receiptCounter = 0;
  const notifications: QueuedNotification[] = [];
  const waiters = new Set<() => void>();

  const wakeWaiters = () => {
    for (const wake of waiters) wake();
  };

  const enqueue = (body: unknown) => {
    receiptCounter += 1;
    notifications.push({ receiptId: receiptCounter, body });
    wakeWaiters();
  };

  /** The oldest notification, which stays in the queue until `remove`d. */
  const first = () => notifications[0];

  const isEmpty = () => notifications.length === 0;

  /** Returns whether there was such a notification. */
  const remove = (receiptId: number) => {
    const index = notifications.findIndex(
      (item) => item.receiptId === receiptId,
    );
    if (index === -1) return false;
    notifications.splice(index, 1);
    return true;
  };

  /** Resolves when something is queued, `holdMs` ran out or `signal` aborted. */
  const waitForNotification = (holdMs: number, signal: AbortSignal) =>
    new Promise<void>((resolve) => {
      if (signal.aborted) {
        resolve();
        return;
      }
      const done = () => {
        clearTimeout(timer);
        waiters.delete(done);
        signal.removeEventListener('abort', done);
        resolve();
      };
      const timer = setTimeout(done, holdMs);
      waiters.add(done);
      signal.addEventListener('abort', done);
    });

  return {
    enqueue,
    first,
    isEmpty,
    remove,
    waitForNotification,
    /** Ends every wait, e.g. because a failure was switched on. */
    wakeWaiters,
  };
};

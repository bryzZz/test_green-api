import { setupWorker } from 'msw/browser';
import { createFakeGreenApi, type FakeFailure } from './createFakeGreenApi';

declare global {
  interface Window {
    /** Mock mode only: simulate network or server failures from the console. */
    fakeGreenApi?: { setFailure: (failure: FakeFailure) => void };
  }
}

/** Answers GREEN-API requests in the browser with the fake API (`pnpm dev:mock`). */
export const startMockApi = async () => {
  const fake = createFakeGreenApi();
  const worker = setupWorker(...fake.handlers);

  await worker.start({ onUnhandledFrame: 'bypass', quiet: true });
  window.fakeGreenApi = { setFailure: fake.setFailure };
};

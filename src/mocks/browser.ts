import { setupWorker } from 'msw/browser';
import { createFakeGreenApi, type FakeFailure } from './fake-green-api';

declare global {
  interface Window {
    /** Mock mode only: simulate network or server failures from the console. */
    fakeGreenApi?: { setFailure(failure: FakeFailure): void };
  }
}

export async function startMockApi() {
  const fake = createFakeGreenApi();
  const worker = setupWorker(...fake.handlers);

  await worker.start({ onUnhandledFrame: 'bypass', quiet: true });
  window.fakeGreenApi = { setFailure: fake.setFailure };
}

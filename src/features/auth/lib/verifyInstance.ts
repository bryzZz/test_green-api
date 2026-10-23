import {
  createGreenApiClient,
  type Credentials,
} from '@/api/createGreenApiClient';
import { NotAuthorizedError } from './describeLoginError';
import { findSettingsProblems } from './findSettingsProblems';

/**
 * Checks that the credentials work and the instance is signed in to MAX.
 * Resolves with the settings that would keep messages from arriving; throws
 * `ApiError` or `NotAuthorizedError` otherwise.
 */
export const verifyInstance = async (credentials: Credentials) => {
  const client = createGreenApiClient(credentials);

  const { stateInstance } = await client.getStateInstance();
  if (stateInstance !== 'authorized') throw new NotAuthorizedError();

  // The settings are only used for a hint, so a failure here (e.g. the 1 rps
  // limit) must not stop the user from logging in.
  const settings = await client.getSettings().catch(() => null);
  const problems = settings ? findSettingsProblems(settings) : [];

  return { credentials, problems };
};

import type { Settings } from '@/api/schemas';

// The HTTP API reads notifications from a queue, which works only without a
// webhook URL and with these notification types enabled.
const REQUIRED_FLAGS = [
  'incomingWebhook',
  'outgoingWebhook',
  'outgoingMessageWebhook',
  'outgoingAPIMessageWebhook',
] as const;

/** The names of the settings that keep the HTTP API from delivering messages. */
export const findSettingsProblems = (settings: Settings): string[] => {
  const problems = REQUIRED_FLAGS.filter((flag) => settings[flag] !== 'yes');
  if (settings.webhookUrl === '') return problems;
  return ['webhookUrl', ...problems];
};

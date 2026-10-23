import { isAxiosError, isCancel } from 'axios';

export type ApiErrorKind =
  | 'network'
  | 'unauthorized'
  | 'rateLimited'
  | 'quota'
  | 'badRequest'
  | 'server';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(
    kind: ApiErrorKind,
    options: { status?: number; cause?: unknown } = {},
  ) {
    super(`GREEN-API request failed: ${kind}`, { cause: options.cause });
    this.name = 'ApiError';
    this.kind = kind;
    this.status = options.status;
  }
}

function kindFromStatus(status: number): ApiErrorKind {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 429) return 'rateLimited';
  // GREEN-API: the correspondents limit of the tariff is exceeded.
  if (status === 466) return 'quota';
  if (status >= 400 && status < 500) return 'badRequest';
  return 'server';
}

export function toApiError(error: unknown): unknown {
  if (!isAxiosError(error)) return error;
  // An aborted request is a deliberate action, not a failure.
  if (isCancel(error)) return error;

  // The AxiosError is deliberately not kept as `cause`: its config holds the
  // request URL, and the API token is part of the URL path.
  if (error.response) {
    return new ApiError(kindFromStatus(error.response.status), {
      status: error.response.status,
    });
  }
  // No response: connection failure or timeout.
  return new ApiError('network');
}

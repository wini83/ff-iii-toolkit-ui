type ApiErrorPayload = {
  status?: unknown;
  message?: unknown;
  error?: unknown;
  detail?: unknown;
};

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toStatusCode(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function fromValidationDetails(detail: unknown): string | null {
  if (!Array.isArray(detail)) return null;

  const message = detail
    .map((item) => {
      if (!isObject(item)) return null;
      return toNonEmptyString(item.msg);
    })
    .filter((value): value is string => value !== null)
    .join('; ');

  return message || null;
}

export function normalizeApiError(
  error: unknown,
  fallback = 'Unknown API error',
  status?: number
): ApiError {
  if (error instanceof ApiError) {
    if (error.status === undefined && status !== undefined) {
      error.status = status;
    }
    return error;
  }

  if (error instanceof Error) {
    return new ApiError(error.message || fallback, status);
  }

  if (typeof error === 'string') {
    return new ApiError(error || fallback, status);
  }

  if (isObject(error)) {
    const payload = error as ApiErrorPayload;
    const resolvedStatus = toStatusCode(payload.status) ?? status;

    const validationMessage = fromValidationDetails(payload.detail);
    if (validationMessage) {
      return new ApiError(validationMessage, resolvedStatus);
    }

    const message =
      toNonEmptyString(payload.message) ??
      toNonEmptyString(payload.error) ??
      toNonEmptyString(payload.detail) ??
      fallback;

    return new ApiError(message, resolvedStatus);
  }

  return new ApiError(fallback, status);
}

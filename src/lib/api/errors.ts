export function normalizeApiError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  if (error && typeof error === 'object') {
    // openapi-client / fetch-style
    if ('status' in error) {
      return new Error(`HTTP ${String((error as any).status)}`);
    }

    if ('message' in error) {
      return new Error(String((error as any).message));
    }
  }

  return new Error('Unknown API error');
}

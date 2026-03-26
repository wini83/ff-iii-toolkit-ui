import { apiRequest } from './auth';
import { normalizeApiError, ApiError } from '$lib/api/errors';
import type { components } from '$lib/api/schema';

type CitiImportParseResponse = components['schemas']['CitiImportParseResponse'];
type CitiImportTextRequest = components['schemas']['CitiImportTextRequest'];

export async function uploadTextFile(
  formData: FormData,
  options: { include_positive: boolean; chunk_size: number },
  token?: string | null
): Promise<CitiImportParseResponse> {
  const { data, error, response } = await apiRequest(
    (api, headers) =>
      api.POST('/api/tools/citi/upload', {
        body: formData as unknown as never,
        headers,
        params: { query: options }
      }),
    { token }
  );

  if (!response.ok || error || !data) {
    throw normalizeApiError(error, `Failed to upload Citi file (${response.status})`, response.status);
  }

  return data;
}

export async function parseRawText(
  payload: CitiImportTextRequest,
  token?: string | null
): Promise<CitiImportParseResponse> {
  const { data, error, response } = await apiRequest(
    (api, headers) =>
      api.POST('/api/tools/citi/parse-text', {
        body: payload,
        headers
      }),
    { token }
  );

  if (!response.ok || error || !data) {
    throw normalizeApiError(error, `Failed to parse Citi text (${response.status})`, response.status);
  }

  return data;
}

export async function getFile(file_id: string, token?: string | null): Promise<CitiImportParseResponse> {
  const { data, error, response } = await apiRequest(
    (api, headers) =>
      api.GET('/api/tools/citi/files/{file_id}', {
        params: { path: { file_id } },
        headers
      }),
    { token }
  );

  if (!response.ok || error || !data) {
    throw normalizeApiError(error, `Failed to load Citi file (${response.status})`, response.status);
  }

  return data;
}

function parseFilename(contentDisposition: string | null, fallback: string) {
  if (!contentDisposition) return fallback;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const basicMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return basicMatch?.[1] ?? fallback;
}

export async function exportCsvZip(file_id: string): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`/api/tools/citi/files/${encodeURIComponent(file_id)}/export-csv`, {
    method: 'POST',
    credentials: 'include'
  });

  if (!response.ok) {
    let message = `Failed to export Citi CSV (${response.status})`;
    const textResponse = response.clone();

    try {
      const body = (await response.json()) as unknown;
      throw normalizeApiError(body, message, response.status);
    } catch (error) {
      if (error instanceof ApiError) throw error;
    }

    const text = await textResponse.text().catch(() => '');
    throw new ApiError(text || message, response.status);
  }

  const blob = await response.blob();
  const filename = parseFilename(response.headers.get('content-disposition'), `citi-${file_id}.zip`);

  return { blob, filename };
}

export const citi = {
  uploadTextFile,
  parseRawText,
  getFile,
  exportCsvZip
};

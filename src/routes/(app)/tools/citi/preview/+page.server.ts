import type { PageServerLoad } from './$types';
import type { components } from '$lib/api/schema';

type CitiPreviewResponse = components['schemas']['CitiImportParseResponse'];

export const load: PageServerLoad = async ({ cookies, url, fetch }) => {
  const fileId = url.searchParams.get('file_id')?.trim() ?? '';

  if (!fileId) {
    return {
      initialFileId: '',
      initialPreview: null,
      initialError: ''
    };
  }

  const token = cookies.get('access_token');
  const API_INTERNAL = process.env.INTERNAL_API_BASE ?? 'http://localhost:8000';

  try {
    const response = await fetch(
      `${API_INTERNAL}/api/tools/citi/files/${encodeURIComponent(fileId)}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return {
        initialFileId: fileId,
        initialPreview: null,
        initialError: text || `Failed to load preview (${response.status})`
      };
    }

    const preview = (await response.json()) as CitiPreviewResponse;

    return {
      initialFileId: fileId,
      initialPreview: preview,
      initialError: ''
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : 'Failed to load the preview for the provided file_id';

    return {
      initialFileId: fileId,
      initialPreview: null,
      initialError: message
    };
  }
};

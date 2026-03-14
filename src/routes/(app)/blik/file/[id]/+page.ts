import type { PageLoad } from './$types';

type PreviewData = {
  decoded_name?: string;
  size?: number;
  content?: unknown[];
};

export const load: PageLoad = async ({ fetch, params }) => {
  try {
    const res = await fetch(`/api/blik_files/${params.id}`);

    if (!res.ok) {
      const text = await res.text();
      return {
        fileId: params.id,
        preview: null,
        previewError: text || `Błąd API (${res.status})`
      };
    }

    const preview = (await res.json()) as PreviewData;

    return {
      fileId: params.id,
      preview,
      previewError: ''
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : 'Nie udało się pobrać podglądu pliku';

    return {
      fileId: params.id,
      preview: null,
      previewError: message
    };
  }
};

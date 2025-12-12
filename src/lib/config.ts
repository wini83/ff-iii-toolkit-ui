let cachedConfig: any = null;

export async function loadConfig() {
  // Jeśli już pobrane → nick chesa nie dublujemy fetchów
  if (cachedConfig) return cachedConfig;

  try {
    const res = await fetch('/config.json', { cache: 'no-store' });

    if (!res.ok) {
      console.warn("loadConfig(): config.json HTTP", res.status);
      cachedConfig = { API_BASE: null };
      return cachedConfig;
    }

    const cfg = await res.json();

    if (!cfg || !cfg.API_BASE) {
      console.warn("loadConfig(): brak API_BASE");
      cachedConfig = { API_BASE: null };
      return cachedConfig;
    }

    cachedConfig = cfg;
    return cachedConfig;

  } catch (err) {
    console.error("loadConfig(): fetch error", err);
    cachedConfig = { API_BASE: null };
    return cachedConfig;
  }
}

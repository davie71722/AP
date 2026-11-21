// GAS 版（HtmlService）不支援離線快取，以空函式取代 virtual:pwa-register
export function registerSW(_opts?: unknown): () => Promise<void> {
  return async () => {};
}

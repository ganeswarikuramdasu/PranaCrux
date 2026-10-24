/** Keep API requests and their authenticated session together. */
export function apiBase(): string {
  return (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') || '';
}
let originalFetch: typeof window.fetch | undefined;
export function installApiBase() {
  if (typeof window === 'undefined' || originalFetch) return;
  const base = apiBase();
  originalFetch = window.fetch.bind(window);
  const nativeFetch = originalFetch;
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      return nativeFetch(base ? base + input : input, { ...init, credentials: init?.credentials || 'include' });
    }
    return nativeFetch(input, init);
  };
}
export function uninstallApiBase() {
  if (typeof window !== 'undefined' && originalFetch) { window.fetch = originalFetch; originalFetch = undefined; }
}

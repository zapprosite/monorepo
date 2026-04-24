// Anti-hardcoded: all config via process.env
// Fetch client with injectable implementation for test isolation

export type FetchFn = typeof fetch;

/**
 * The active fetch implementation. Defaults to the global fetch.
 * Can be overridden for testing.
 */
let _fetch: FetchFn = globalThis.fetch.bind(globalThis);

/**
 * Set a custom fetch implementation (for testing).
 */
export function setFetch(fetchImpl: FetchFn): void {
  _fetch = fetchImpl;
}

/**
 * Get the current fetch implementation.
 */
export function getFetch(): FetchFn {
  return _fetch;
}

/**
 * Convenience: wraps fetch with the configured implementation.
 */
export const fetchClient: FetchFn = (...args: Parameters<FetchFn>) => _fetch(...args);

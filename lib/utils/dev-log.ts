/**
 * Log only in development.
 *
 * In production every call to console.log on the POS hot path (Realtime
 * subscriptions, checkout fallback) shows up in the browser console and
 * burns a small amount of CPU + memory per event. Use devLog for traces
 * that exist purely for debugging; keep console.error / console.warn for
 * real diagnostics that should reach production.
 */
export function devLog(...args: unknown[]): void {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log(...args)
  }
}

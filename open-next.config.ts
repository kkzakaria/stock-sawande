import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext Cloudflare Configuration
 *
 * This configuration enables Next.js to run on Cloudflare Workers.
 *
 * Optional configurations you can enable:
 *
 * 1. R2 Incremental Cache (for better performance):
 *    import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
 *    incrementalCache: r2IncrementalCache,
 *
 * 2. KV Tag Cache (for cache invalidation):
 *    import kvTagCache from "@opennextjs/cloudflare/overrides/tag-cache/kv-next-tag-cache";
 *    tagCache: kvTagCache,
 *
 * 3. Durable Objects Queue (for revalidation):
 *    import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
 *    queue: doQueue,
 */
export default defineCloudflareConfig({
  // Add custom configuration here as needed
  // For basic deployment, this empty config is sufficient
});

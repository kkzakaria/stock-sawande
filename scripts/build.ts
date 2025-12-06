#!/usr/bin/env tsx
/**
 * Smart Build Script for Next-Stock
 *
 * Automatically detects the deployment platform and runs the appropriate build:
 * - Cloudflare Pages: Runs OpenNext Cloudflare build
 * - Vercel: Runs standard Next.js build
 * - Local: Runs standard Next.js build
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

// Enhanced Cloudflare Pages detection with multiple fallbacks
const detectCloudflarePages = (): boolean => {
  // Method 1: Primary Cloudflare Pages environment variables
  if (process.env.CF_PAGES === '1' || process.env.CF_PAGES) {
    return true;
  }

  // Method 2: Check for Cloudflare Pages-specific variables
  if (process.env.CF_PAGES_BRANCH || process.env.CF_PAGES_URL) {
    return true;
  }

  // Method 3: Check for Cloudflare Pages commit SHA (set during build)
  if (process.env.CF_PAGES_COMMIT_SHA) {
    return true;
  }

  // Method 4: Manual override via FORCE_CLOUDFLARE environment variable
  if (process.env.FORCE_CLOUDFLARE === '1' || process.env.FORCE_CLOUDFLARE === 'true') {
    return true;
  }

  // Method 5: Check if wrangler config exists (indicates Cloudflare Workers/Pages project)
  // This is a heuristic - if wrangler config exists and we're in CI, assume Cloudflare
  const hasWranglerConfig =
    existsSync(join(process.cwd(), 'wrangler.toml')) ||
    existsSync(join(process.cwd(), 'wrangler.jsonc')) ||
    existsSync(join(process.cwd(), 'wrangler.json'));

  if (process.env.CI && hasWranglerConfig) {
    return true;
  }

  // Method 6: Check for Cloudflare-specific CI environment variables
  if (process.env.CI && (
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.CF_PAGES_PROJECT_NAME
  )) {
    return true;
  }

  return false;
};

const isCloudflarePages = detectCloudflarePages();
const isVercel = process.env.VERCEL === '1';

console.log('🔍 Detecting deployment platform...\n');

// Enhanced debug logging - always show in Cloudflare builds to help troubleshooting
// Check for wrangler config files
const hasWranglerToml = existsSync(join(process.cwd(), 'wrangler.toml'));
const hasWranglerJsonc = existsSync(join(process.cwd(), 'wrangler.jsonc'));
const hasWranglerJson = existsSync(join(process.cwd(), 'wrangler.json'));
const wranglerConfigFile = hasWranglerToml ? 'wrangler.toml' : hasWranglerJsonc ? 'wrangler.jsonc' : hasWranglerJson ? 'wrangler.json' : 'none';

console.log('📋 Environment detection:');
console.log(`  CF_PAGES: ${process.env.CF_PAGES || 'not set'}`);
console.log(`  CF_PAGES_BRANCH: ${process.env.CF_PAGES_BRANCH || 'not set'}`);
console.log(`  CF_PAGES_URL: ${process.env.CF_PAGES_URL || 'not set'}`);
console.log(`  CF_PAGES_COMMIT_SHA: ${process.env.CF_PAGES_COMMIT_SHA || 'not set'}`);
console.log(`  FORCE_CLOUDFLARE: ${process.env.FORCE_CLOUDFLARE || 'not set'}`);
console.log(`  VERCEL: ${process.env.VERCEL || 'not set'}`);
console.log(`  CI: ${process.env.CI || 'not set'}`);
console.log(`  Wrangler config: ${wranglerConfigFile}`);
console.log(`\n✅ Detection result: ${isCloudflarePages ? 'Cloudflare Pages' : isVercel ? 'Vercel' : 'Local/Other'}\n`);

if (isCloudflarePages) {
  console.log('🟠 Cloudflare Pages detected');
  console.log('📦 Running OpenNext Cloudflare build...\n');

  try {
    // Set Cloudflare build flag
    process.env.CLOUDFLARE_BUILD = 'true';

    // Run OpenNext Cloudflare build
    execSync('opennextjs-cloudflare build', {
      stdio: 'inherit',
      env: {
        ...process.env,
        CLOUDFLARE_BUILD: 'true',
      },
    });

    console.log('\n✅ Cloudflare build completed successfully!');
  } catch (_error) {
    console.error('\n❌ Cloudflare build failed!');
    process.exit(1);
  }
} else if (isVercel) {
  console.log('🔵 Vercel detected');
  console.log('📦 Running standard Next.js build...\n');

  try {
    execSync('next build', { stdio: 'inherit' });
    console.log('\n✅ Vercel build completed successfully!');
  } catch (_error) {
    console.error('\n❌ Vercel build failed!');
    process.exit(1);
  }
} else {
  console.log('💻 Local/Other platform detected');
  console.log('📦 Running standard Next.js build...\n');

  try {
    execSync('next build', { stdio: 'inherit' });
    console.log('\n✅ Build completed successfully!');
  } catch (_error) {
    console.error('\n❌ Build failed!');
    process.exit(1);
  }
}

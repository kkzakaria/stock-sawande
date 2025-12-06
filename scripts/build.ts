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

// Detect deployment platform
const isCloudflarePages = process.env.CF_PAGES === '1';
const isVercel = process.env.VERCEL === '1';

console.log('🔍 Detecting deployment platform...\n');

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

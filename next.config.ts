import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

// next-pwa is not yet fully compatible with Turbopack
// Disable in build for now - PWA will work with webpack in dev
const isPWADisabled = process.env.NODE_ENV === "development" || process.env.DISABLE_PWA === "true";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: isPWADisabled,
  runtimeCaching: [
    // App Shell - Cache First (fast loads)
    {
      urlPattern: /^\/_next\/static\/.*/,
      handler: "CacheFirst",
      options: {
        cacheName: "static-assets",
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    // Google Fonts - Cache First
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/,
      handler: "CacheFirst",
      options: {
        cacheName: "google-fonts",
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
        },
      },
    },
    // Product Images - Stale While Revalidate
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "images",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        },
      },
    },
    // Supabase Storage Images
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "supabase-storage",
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        },
      },
    },
    // POS Page - Stale While Revalidate
    {
      urlPattern: /\/pos$/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "pos-page",
        expiration: {
          maxEntries: 1,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        },
      },
    },
  ],
});

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  // Enable Turbopack (Next.js 16 default)
  turbopack: {},
};

export default withPWA(nextConfig);

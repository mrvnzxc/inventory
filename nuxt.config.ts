// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  // Avoids Vite "Failed to resolve import #app-manifest" during dev (Windows / Vite 7)
  experimental: {
    appManifest: false,
  },
  devtools: { enabled: true },
  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss', '@nuxtjs/supabase'],
  css: ['~/assets/css/main.css'],
  supabase: {
    // Use middleware/auth.global.ts only — avoids double redirects with the module's global-auth
    redirect: false,
    // `secure: true` cookies are not stored on http://localhost, which breaks session sync in dev
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
    redirectOptions: {
      login: '/login',
      callback: '/login',
      exclude: ['/login'],
    },
  },
  runtimeConfig: {
    public: {
      lowStockThreshold: 10,
      // Used in auth emails (signup confirm). Set in Vercel to your production URL.
      siteUrl:
        process.env.NUXT_PUBLIC_SITE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''),
    },
  },
  tailwindcss: {
    cssPath: '~/assets/css/main.css',
  },
})

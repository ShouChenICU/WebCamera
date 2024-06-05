// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  css: ['~/assets/main.css'],
  modules: ['@nuxtjs/seo', '@nuxtjs/i18n', '@nuxt/ui', '@vite-pwa/nuxt'],

  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0',
      link: [{ rel: 'icon', href: '/favicon.webp' }]
    }
  },

  site: {
    // url: 'http://localhost:3000',
    url: 'https://webcamera.cc',
    name: 'WebCamera',
    description: 'WebCamera'
    // defaultLocale: 'zh'
  },

  i18n: {
    vueI18n: './i18n.config.ts',
    baseUrl: 'https://webcamera.cc',
    locales: [
      { code: 'en', iso: 'en-US' },
      { code: 'zh', iso: 'zh-CN' }
    ],
    defaultLocale: 'en',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root'
    }
  },

  ogImage: {
    enabled: false
  },

  colorMode: {
    preference: 'system', // default value of $colorMode.preference
    fallback: 'light', // fallback value if not system preference found
    hid: 'nuxt-color-mode-script',
    globalName: '__NUXT_COLOR_MODE__',
    componentName: 'ColorScheme',
    classPrefix: '',
    classSuffix: '',
    storageKey: 'nuxt-color-mode'
  },

  pwa: {
    strategies: 'generateSW',
    registerType: 'autoUpdate',

    workbox: {
      runtimeCaching: [
        {
          urlPattern: () => true,
          handler: 'NetworkOnly'
        }
      ]
    },

    manifest: {
      name: 'Web Camera',
      short_name: 'WebCamera',
      theme_color: '#ffffff',

      icons: [
        {
          src: '/favicon.webp',
          sizes: '512x512',
          type: 'image/webp',
          purpose: 'any'
        }
      ]
    }
  }
})

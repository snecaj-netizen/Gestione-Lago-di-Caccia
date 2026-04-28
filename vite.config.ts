import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  
  // Try to load Firebase config for AI Studio preview
  let firebaseEnv = {};
  const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      firebaseEnv = {
        VITE_FIREBASE_API_KEY: config.apiKey,
        VITE_FIREBASE_AUTH_DOMAIN: config.authDomain,
        VITE_FIREBASE_PROJECT_ID: config.projectId,
        VITE_FIREBASE_STORAGE_BUCKET: config.storageBucket,
        VITE_FIREBASE_MESSAGING_SENDER_ID: config.messagingSenderId,
        VITE_FIREBASE_APP_ID: config.appId,
        VITE_FIREBASE_FIRESTORE_DB_ID: config.firestoreDatabaseId,
      };
    } catch (e) {
      console.warn("Error parsing firebase-applet-config.json", e);
    }
  }

  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'script',
        includeAssets: ['logo_lago.png'],
        manifest: {
          name: 'Gestione Lago',
          short_name: 'Lago',
          description: 'Gestione Lago di Caccia - Soci e Quotisti',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          theme_color: '#0a2e2a',
          background_color: '#fffffd',
          icons: [
            {
              src: 'logo_lago.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'logo_lago.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'logo_lago.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        },
        devOptions: {
          enabled: true,
          type: 'module',
          navigateFallback: 'index.html',
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      ...Object.keys(firebaseEnv).reduce((prev, key) => {
        prev[`import.meta.env.${key}`] = JSON.stringify(firebaseEnv[key]);
        return prev;
      }, {}),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  root: 'public',  // ⬅️ kasih tahu Vite root-nya di folder public
  plugins: [vue()],
  build: {
    outDir: '../dist',  // ⬅️ hasil build tetap keluar di folder dist
    emptyOutDir: true,
  },
})



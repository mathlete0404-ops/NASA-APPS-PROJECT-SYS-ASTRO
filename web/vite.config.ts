import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// BASE lets the static build live under a sub-path (e.g. GitHub Pages /crew-mirror/).
export default defineConfig({
  base: process.env.BASE ?? './',
  plugins: [react()],
  worker: { format: 'es' },
  server: {
    fs: { allow: ['..'] }, // shared/*.json rule tables live one level up
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  preview: { proxy: { '/api': 'http://127.0.0.1:8000' } },
})

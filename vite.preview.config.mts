// Nur zum Testen der Oberfläche im Browser (ohne Electron). Die App selbst baut electron-vite.
import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: resolve(import.meta.dirname, 'src/renderer'),
  resolve: { alias: { '@shared': resolve(import.meta.dirname, 'src/shared') } },
  plugins: [react()]
})

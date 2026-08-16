import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // The app is served from https://<user>.github.io/workout/ — this prefix has
  // to match the repository name, and later the service worker scope too.
  base: '/workout/',
  plugins: [react()],
})

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// `base` must match the repo name for GitHub Pages project sites
// (served from https://<user>.github.io/InclusiveMap/).
export default defineConfig({
  base: '/InclusiveMap/',
  plugins: [react()],
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true,
    target: 'es2015',        // forces const/let → var in output — kills TDZ permanently
    minify: 'esbuild',
  },
  esbuild: {
    target: 'es2015',        // same target for transform step
  },
})

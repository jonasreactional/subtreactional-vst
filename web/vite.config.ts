import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    outDir: 'dist',
    // viteSingleFile handles inlining; keep target broad for WKWebView compat
    target: 'es2020',
  },
});

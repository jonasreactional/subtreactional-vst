import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    outDir: 'dist',
    // viteSingleFile handles inlining; keep target broad for WKWebView compat
    target: 'es2020',
    // Inline all assets (including the about photo) into the single HTML file
    assetsInlineLimit: 1024 * 1024,
  },
});

import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/extension.ts'),
      formats: ['cjs'],
      fileName: () => 'extension.js'
    },
    rollupOptions: {
      external: [
        'vscode',
        'ollama',
        'axios',
        'fs',
        'path',
        'util',
        'http',
        'https',
        'url',
        'stream',
        'events',
        'crypto'
      ],
      output: {
        preserveModules: false,
        exports: 'named'
      }
    },
    outDir: 'dist',
    sourcemap: true,
    minify: false,
    target: 'node16'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  define: {
    'process.env.NODE_ENV': '"production"'
  }
}); 
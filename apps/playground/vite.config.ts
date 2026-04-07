import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@cliproot\/protocol\/hash$/,
        replacement: path.resolve(__dirname, '../../packages/protocol/src/hash.ts')
      },
      {
        find: /^@cliproot\/protocol\/schema-meta$/,
        replacement: path.resolve(__dirname, '../../packages/protocol/src/schema.ts')
      },
      {
        find: /^@cliproot\/protocol\/types$/,
        replacement: path.resolve(__dirname, '../../packages/protocol/src/types.ts')
      },
      {
        find: /^@cliproot\/protocol$/,
        replacement: path.resolve(__dirname, '../../packages/protocol/src/index.ts')
      },
      {
        find: /^@cliproot\/core$/,
        replacement: path.resolve(__dirname, '../../packages/core/src/index.ts')
      },
      {
        find: /^@cliproot\/tiptap$/,
        replacement: path.resolve(__dirname, '../../packages/tiptap/src/index.ts')
      }
    ]
  },
  plugins: [react(), tailwindcss()],
  base: './'
})

import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [dts({ include: ['src'] })],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'bitten',
      fileName: 'bitten',
      formats: ['es', 'umd'],
    },
    sourcemap: true,
  },
});

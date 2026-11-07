import { defineConfig } from 'vitest/config';
import { urlDeTest } from './test/util/base-de-test.js';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/util/preparar-base.ts'],
    // Los tests comparten la base: corren de a un archivo por vez.
    fileParallelism: false,
    env: { DATABASE_URL: urlDeTest() },
  },
});

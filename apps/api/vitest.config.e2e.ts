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
    // Los avisos arrancan apagados aunque el .env local tenga claves VAPID: cada test que los
    // necesita los enciende con crearAppDeTest({ push: PUSH_ACTIVO }).
    env: { DATABASE_URL: urlDeTest(), VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '', VAPID_SUBJECT: '' },
  },
});

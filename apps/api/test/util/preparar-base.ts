import { execSync } from 'node:child_process';
import pg from 'pg';
import { urlDeTest } from './base-de-test.js';

/** globalSetup de vitest: crea garabato_test si falta y le aplica las migraciones. */
export default async function prepararBase(): Promise<void> {
  const test = new URL(urlDeTest());
  const admin = new URL(test);
  admin.pathname = '/postgres';

  const cliente = new pg.Client({ connectionString: admin.toString() });
  await cliente.connect();
  const existe = await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', ['garabato_test']);
  if (existe.rowCount === 0) await cliente.query('CREATE DATABASE garabato_test');
  await cliente.end();

  execSync('npx prisma migrate deploy', {
    stdio: 'ignore',
    env: { ...process.env, DIRECT_URL: test.toString() },
  });
}

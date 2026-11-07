import { existsSync } from 'node:fs';

/** URL de la base de tests: la misma de .env, pero con la base garabato_test. */
export function urlDeTest(): string {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error('Falta DATABASE_URL en apps/api/.env.');
  const url = new URL(base);
  url.pathname = '/garabato_test';
  return url.toString();
}

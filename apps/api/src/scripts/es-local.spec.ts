import { apuntaALocalhost } from './es-local.js';

describe('apuntaALocalhost', () => {
  it.each([
    'postgresql://garabato:garabato@localhost:5432/garabato',
    'postgresql://u:p@127.0.0.1/garabato',
    'postgresql://u:p@[::1]:5432/garabato',
  ])('acepta %s', (url) => {
    expect(apuntaALocalhost(url)).toBe(true);
  });

  it.each([
    'postgresql://u:p@ep-algo-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require',
    'postgresql://u:p@localhost.evil.com/db',
    'postgresql://localhost:p@db.neon.tech/db',
    'no es una url',
    '',
    undefined,
  ])('rechaza %s', (url) => {
    expect(apuntaALocalhost(url)).toBe(false);
  });
});

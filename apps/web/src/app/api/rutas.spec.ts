import { esDeLaApi, rutaApi } from './rutas';

describe('rutas de la API', () => {
  it('en desarrollo (API_BASE vacío) son relativas', () => {
    expect(rutaApi('estado')).toBe('/api/estado');
  });

  it.each([
    ['/api/estado', '', true],
    ['/health', '', true],
    ['/assets/logo.svg', '', false],
    ['https://garabato-api.onrender.com/api/estado', 'https://garabato-api.onrender.com', true],
    ['https://garabato-api.onrender.com/health', 'https://garabato-api.onrender.com', true],
    ['https://fonts.googleapis.com/css2', 'https://garabato-api.onrender.com', false],
    ['https://garabato-api.onrender.com.evil.com/api/x', 'https://garabato-api.onrender.com', false],
  ])('%s con base "%s" → %s', (url, base, esperado) => {
    expect(esDeLaApi(url, base)).toBe(esperado);
  });
});

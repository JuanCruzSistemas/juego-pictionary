import { origenPermitido } from './cors.js';

describe('origenPermitido', () => {
  it.each([
    ['https://garabato.onrender.com', 'https://garabato.onrender.com'],
    ['https://garabato.onrender.com/', 'https://garabato.onrender.com'],
    ['  http://localhost:4200  ', 'http://localhost:4200'],
  ])('%j → %j', (valor, origen) => expect(origenPermitido(valor)).toBe(origen));

  it.each([undefined, '', '*', 'garabato.onrender.com', 'https://garabato.onrender.com/s/abc', 'ftp://x.com'])(
    'rechaza %j',
    (valor) => expect(origenPermitido(valor)).toBeNull(),
  );
});

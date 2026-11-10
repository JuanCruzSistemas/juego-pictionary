// Escribe src/app/api/api-base.ts con la variable de entorno API_BASE antes del build.
// En desarrollo queda vacía: la web llama a /api en su mismo origen y ng serve lo pasa a la API.
// En Render (que define RENDER) es obligatoria: sin ella la web llamaría a una API que no existe.
import { writeFileSync } from 'node:fs';

const valor = (process.env.API_BASE ?? '').trim().replace(/\/+$/, '');

if (process.env.RENDER && !valor) {
  console.error('Falta API_BASE: la URL de garabato-api, por ejemplo https://garabato-api.onrender.com');
  process.exit(1);
}
if (valor && !/^https?:\/\/[^/\s]+$/.test(valor)) {
  console.error(`API_BASE tiene que ser un origen sin ruta, como https://garabato-api.onrender.com, y es "${valor}".`);
  process.exit(1);
}

const destino = new URL('../src/app/api/api-base.ts', import.meta.url);
writeFileSync(
  destino,
  `// Lo escribe scripts/escribir-api-base.mjs en cada build. Vacío: mismo origen (desarrollo).\n` +
    `export const API_BASE = ${JSON.stringify(valor)};\n`,
);
console.log(`API_BASE = ${valor || '(mismo origen)'}`);

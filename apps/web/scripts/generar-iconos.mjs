// Genera los íconos PNG de la PWA a partir de iconos/g.svg (la "G" de Shantell Sans 800 como trazo).
// Uso: npm run iconos -w @garabato/web. Los PNG resultantes se commitean en public/icons.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const BIROME = '#1B2A7A';
const RESALTADOR = '#FFE74C';

const fuente = readFileSync(new URL('../iconos/g.svg', import.meta.url), 'utf8');
const [, ancho, alto] = fuente.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);
const trazo = fuente.match(/<path d="([^"]+)"/)[1];

/** La G centrada en un cuadrado de `lado`, con una altura de `proporcion` del lado. */
function letra(lado, proporcion, color) {
  const escala = (lado * proporcion) / alto;
  const x = (lado - ancho * escala) / 2;
  const y = (lado - alto * escala) / 2;
  return `<path d="${trazo}" fill="${color}" transform="translate(${x} ${y}) scale(${escala})"/>`;
}

const variantes = {
  // Como la insignia de Avisos.dc.html: círculo resaltador con borde birome.
  normal: (lado) => {
    const borde = lado * 0.05;
    return `<circle cx="${lado / 2}" cy="${lado / 2}" r="${(lado - borde) / 2}" fill="${RESALTADOR}" stroke="${BIROME}" stroke-width="${borde}"/>${letra(lado, 0.5, BIROME)}`;
  },
  // Android la recorta en cualquier forma: fondo completo y la G dentro de la zona segura.
  maskable: (lado) => `<rect width="${lado}" height="${lado}" fill="${RESALTADOR}"/>${letra(lado, 0.44, BIROME)}`,
  // iOS no usa transparencia: cuadrado lleno, la G un poco más grande.
  apple: (lado) => `<rect width="${lado}" height="${lado}" fill="${RESALTADOR}"/>${letra(lado, 0.5, BIROME)}`,
  // Barra de notificaciones de Android: un solo color sobre transparente.
  monocromo: (lado) => letra(lado, 0.7, '#FFFFFF'),
};

const salidas = [
  ['icon-192.png', 'normal', 192],
  ['icon-512.png', 'normal', 512],
  ['icon-maskable-192.png', 'maskable', 192],
  ['icon-maskable-512.png', 'maskable', 512],
  ['apple-touch-icon.png', 'apple', 180],
  ['badge-96.png', 'monocromo', 96],
  ['favicon-48.png', 'normal', 48],
];

const destino = new URL('../public/icons/', import.meta.url);
mkdirSync(destino, { recursive: true });
for (const [archivo, variante, lado] of salidas) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">${variantes[variante](lado)}</svg>`;
  const png = new Resvg(svg).render().asPng();
  writeFileSync(new URL(archivo, destino), png);
  console.log(`${archivo} (${lado}×${lado}, ${variante})`);
}

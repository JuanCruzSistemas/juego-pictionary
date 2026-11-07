import type { Stroke } from '@garabato/shared';

/** Paleta de apps/web/src/app/dibujo/herramientas.ts, más el blanco de la goma. */
export const COLORES_PERMITIDOS: ReadonlySet<string> = new Set([
  '#1B2A7A',
  '#111111',
  '#D6293E',
  '#FFD400',
  '#1E9E5A',
  '#8A4B2A',
  '#FFFFFF',
]);

/** Grosores relativos al lado: del fino del lápiz (0,01) a la goma gruesa (0,04 × 2). */
export const GROSOR_MINIMO = 0.01;
export const GROSOR_MAXIMO = 0.08;

export const TRAZOS_MAXIMOS = 200;
export const PUNTOS_MAXIMOS = 20_000;

/** Tamaño máximo del body JSON. El peor caso medido (240 Hz, dedo rápido) pesa ~110 KB. */
export const LIMITE_DEL_BODY = '1mb';

const coma = (n: number) => String(n).replace('.', ',');
const esNumero = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const esObjeto = (o: unknown): o is Record<string, unknown> => typeof o === 'object' && o !== null && !Array.isArray(o);

/**
 * Revisa un dibujo recibido. Devuelve un mensaje que dice qué está mal y dónde, o null si es válido.
 * Trazos y puntos se cuentan desde 1 en los mensajes.
 */
export function problemaDelDibujo(trazos: unknown): string | null {
  if (!Array.isArray(trazos)) return 'Falta la lista de trazos.';
  if (trazos.length === 0) return 'El dibujo no tiene trazos.';
  if (trazos.length > TRAZOS_MAXIMOS) return `El dibujo tiene ${trazos.length} trazos y el máximo es ${TRAZOS_MAXIMOS}.`;

  let total = 0;
  for (const [i, trazo] of trazos.entries()) {
    const donde = `Trazo ${i + 1}`;
    if (!esObjeto(trazo)) return `${donde}: no es un trazo.`;
    const sobran = Object.keys(trazo).filter((k) => !['color', 'width', 'points'].includes(k));
    if (sobran.length > 0) return `${donde}: tiene campos de más (${sobran.join(', ')}).`;

    if (typeof trazo['color'] !== 'string' || !COLORES_PERMITIDOS.has(trazo['color'])) {
      return `${donde}: el color ${JSON.stringify(trazo['color'])} no es de la paleta.`;
    }
    const w = trazo['width'];
    if (!esNumero(w) || w < GROSOR_MINIMO || w > GROSOR_MAXIMO) {
      return `${donde}: el grosor tiene que estar entre ${coma(GROSOR_MINIMO)} y ${coma(GROSOR_MAXIMO)}.`;
    }

    const puntos = trazo['points'];
    if (!Array.isArray(puntos) || puntos.length === 0) return `${donde}: no tiene puntos.`;
    total += puntos.length;
    if (total > PUNTOS_MAXIMOS) return `El dibujo tiene más de ${PUNTOS_MAXIMOS.toLocaleString('es-AR')} puntos.`;

    let anterior = -1;
    for (const [j, p] of puntos.entries()) {
      const punto = `${donde}, punto ${j + 1}`;
      if (!esObjeto(p) || Object.keys(p).length !== 3) return `${punto}: tiene que tener x, y y t.`;
      const { x, y, t } = p;
      if (!esNumero(x) || x < 0 || x > 1) return `${punto}: x tiene que estar entre 0 y 1.`;
      if (!esNumero(y) || y < 0 || y > 1) return `${punto}: y tiene que estar entre 0 y 1.`;
      if (!esNumero(t) || !Number.isInteger(t) || t < 0) return `${punto}: t tiene que ser un entero no negativo.`;
      // Dos puntos pueden caer en el mismo milisegundo; lo que no puede es ir para atrás.
      if (t < anterior) return `${punto}: t no puede ser menor que el del punto anterior.`;
      anterior = t;
    }
  }
  return null;
}

/** Duración del dibujo: el `t` más alto. */
export function duracionDe(trazos: readonly Stroke[]): number {
  return Math.max(0, ...trazos.map((t) => t.points.at(-1)?.t ?? 0));
}

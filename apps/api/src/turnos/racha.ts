import type { Racha } from '@garabato/shared';

/** Los días se cuentan en la hora de Argentina: la racha cambia de día a la medianoche de ustedes. */
export const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';

const formato = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit' });

/** El día de esa fecha en la zona horaria, como número de días: sirve para restar días. */
function numeroDeDia(fecha: Date): number {
  const [a, m, d] = formato.format(fecha).split('-').map(Number);
  return Date.UTC(a, m - 1, d) / 86_400_000;
}

/**
 * La racha compartida: días seguidos en los que alguno de los dos adivinó un dibujo del otro.
 * Si hoy todavía no adivinaron, la racha sigue viva (cuenta hasta ayer) hasta que termine el día.
 */
export function calcularRacha(aciertos: readonly Date[], ahora: Date): Racha {
  const dias = new Set(aciertos.map(numeroDeDia));
  const hoy = numeroDeDia(ahora);
  const hoyAdivinaron = dias.has(hoy);
  let dia = hoyAdivinaron ? hoy : hoy - 1;
  let cuenta = 0;
  while (dias.has(dia)) {
    cuenta++;
    dia--;
  }
  return { dias: cuenta, hoy: hoyAdivinaron };
}

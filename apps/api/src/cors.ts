/** Cuánto recuerda el navegador la respuesta a la consulta previa (preflight) del CORS. */
export const CORS_MAX_AGE_S = 600;

/**
 * El origen permitido a partir de WEB_ORIGIN: sin barra final, solo protocolo y host.
 * Devuelve null si no hay o no es un origen válido: en ese caso no se habilita CORS para nadie.
 */
export function origenPermitido(valor: string | undefined): string | null {
  const limpio = (valor ?? '').trim().replace(/\/+$/, '');
  if (!limpio) return null;
  try {
    const url = new URL(limpio);
    return url.origin === limpio && (url.protocol === 'https:' || url.protocol === 'http:') ? limpio : null;
  } catch {
    return null;
  }
}

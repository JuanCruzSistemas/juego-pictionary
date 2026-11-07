/** Borde del marco del lienzo, en px CSS. Igual en Lienzo y en DibujoVista. */
export const BORDE_DEL_MARCO = 2.5;

/**
 * Ajusta un canvas cuadrado al lugar disponible: el lado entero más grande que entra con el borde,
 * y el canvas en px reales según devicePixelRatio. Devuelve el lado en px CSS y el dpr usados.
 */
export function ajustarCuadrado(
  disponible: { width: number; height: number },
  marco: HTMLElement,
  canvases: HTMLCanvasElement[],
  dpr = window.devicePixelRatio || 1,
): { lado: number; dpr: number } {
  const lado = Math.max(0, Math.floor(Math.min(disponible.width, disponible.height) - 2 * BORDE_DEL_MARCO));
  marco.style.width = marco.style.height = `${lado + 2 * BORDE_DEL_MARCO}px`;
  for (const c of canvases) {
    c.width = c.height = Math.round(lado * dpr);
    if (c.isConnected) c.style.width = c.style.height = `${lado}px`;
  }
  return { lado, dpr };
}

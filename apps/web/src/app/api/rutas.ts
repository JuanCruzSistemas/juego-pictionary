import { API_BASE } from './api-base';

/** URL completa de un endpoint de la API: `rutaApi('estado')` → `${API_BASE}/api/estado`. */
export function rutaApi(ruta: string): string {
  return `${API_BASE}/api/${ruta}`;
}

/** true si la URL es de nuestra API (para los interceptores). */
export function esDeLaApi(url: string, base: string = API_BASE): boolean {
  return url.startsWith(`${base}/api/`) || url === `${base}/health`;
}

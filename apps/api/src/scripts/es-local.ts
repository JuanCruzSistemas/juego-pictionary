const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** true solo si la URL de Postgres apunta a esta máquina. */
export function apuntaALocalhost(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return HOSTS_LOCALES.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

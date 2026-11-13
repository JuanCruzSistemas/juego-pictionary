/** "Hoy, 03:47", "Ayer, 22:10" o "8 de nov., 18:05", en la hora del celular. */
export function cuando(iso: string, ahora: Date = new Date()): string {
  const fecha = new Date(iso);
  const hora = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((dia(ahora) - dia(fecha)) / 86_400_000);
  if (dias === 0) return `Hoy, ${hora}`;
  if (dias === 1) return `Ayer, ${hora}`;
  return `${fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}, ${hora}`;
}

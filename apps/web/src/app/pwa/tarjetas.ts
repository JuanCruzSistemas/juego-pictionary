export type TarjetaExtra = 'avisos' | 'instalar';

/** Las tarjetas que van debajo del turno en Inicio. Si están las dos, primero la de avisos. */
export function tarjetasExtra(ofrecer: { avisos: boolean; instalar: boolean }): TarjetaExtra[] {
  const t: TarjetaExtra[] = [];
  if (ofrecer.avisos) t.push('avisos');
  if (ofrecer.instalar) t.push('instalar');
  return t;
}

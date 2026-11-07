import { InjectionToken } from '@angular/core';

/** Almacenamiento del dispositivo. Nunca tira error: sin localStorage, no guarda y no lee nada. */
export type Almacen = {
  leer(clave: string): string | null;
  guardar(clave: string, valor: string): void;
  borrar(clave: string): void;
};

export const ALMACEN = new InjectionToken<Almacen>('Almacen', {
  providedIn: 'root',
  factory: () => ({
    leer: (clave) => {
      try {
        return localStorage.getItem(clave);
      } catch {
        return null;
      }
    },
    guardar: (clave, valor) => {
      try {
        localStorage.setItem(clave, valor);
      } catch {
        // Lleno o bloqueado: el borrador queda solo en memoria.
      }
    },
    borrar: (clave) => {
      try {
        localStorage.removeItem(clave);
      } catch {
        // Nada que borrar.
      }
    },
  }),
});

/** Almacén en memoria para los tests. */
export function almacenEnMemoria(): Almacen & { datos: Map<string, string> } {
  const datos = new Map<string, string>();
  return {
    datos,
    leer: (c) => datos.get(c) ?? null,
    guardar: (c, v) => void datos.set(c, v),
    borrar: (c) => void datos.delete(c),
  };
}

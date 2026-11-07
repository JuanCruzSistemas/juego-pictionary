import { Injectable, computed, signal } from '@angular/core';

export type AvisoDeConexion = 'despertando' | 'sin-red' | null;

/**
 * Cómo anda la conexión con la API, para el aviso de arriba.
 * "Despertando": algún pedido tarda más de lo normal, o el servidor no contesta mientras hay red
 * (en el plan gratis de Render el servicio se duerme y tarda en volver).
 * "Sin red": el dispositivo está desconectado.
 */
@Injectable({ providedIn: 'root' })
export class ConexionService {
  private readonly lentos = signal(0);
  private readonly servidorCaido = signal(false);
  private readonly offline = signal(typeof navigator !== 'undefined' && navigator.onLine === false);

  readonly aviso = computed<AvisoDeConexion>(() => {
    if (this.offline()) return 'sin-red';
    return this.lentos() > 0 || this.servidorCaido() ? 'despertando' : null;
  });

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => this.offline.set(false));
    window.addEventListener('offline', () => this.offline.set(true));
  }

  empiezaLento(): void {
    this.lentos.update((n) => n + 1);
  }

  terminaLento(): void {
    this.lentos.update((n) => Math.max(0, n - 1));
  }

  respondio(): void {
    this.servidorCaido.set(false);
    this.offline.set(false);
  }

  noRespondio(): void {
    if (navigator.onLine === false) this.offline.set(true);
    else this.servidorCaido.set(true);
  }
}

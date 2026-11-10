import { DOCUMENT, Injectable, InjectionToken, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/** Cada cuánto se busca una versión nueva mientras la app está abierta. */
export const INTERVALO_DE_BUSQUEDA_MS = 30 * 60 * 1000;

/** Recarga la página. Es inyectable para los tests. */
export const RECARGAR = new InjectionToken<() => void>('Recargar', {
  providedIn: 'root',
  factory: () => {
    const doc = inject(DOCUMENT);
    return () => doc.location.reload();
  },
});

/**
 * Versiones nuevas de la app (service worker). Busca al abrir, cada vez que la app vuelve a estar
 * visible y cada 30 minutos. Cuando una versión nueva está lista, avisa; nunca recarga sola.
 * Mientras tanto, la versión vieja sigue funcionando completa desde la caché.
 */
@Injectable({ providedIn: 'root' })
export class ActualizacionService {
  private readonly sw = inject(SwUpdate);
  private readonly doc = inject(DOCUMENT);
  private readonly recargar = inject(RECARGAR);

  private readonly lista = signal(false);
  private readonly rotaSenal = signal(false);
  private readonly actualizando = signal(false);
  /** Hay una versión nueva descargada y lista para usar. */
  readonly hayVersionNueva = this.lista.asReadonly();
  /** La caché del service worker quedó inservible: hay que recargar. */
  readonly rota = this.rotaSenal.asReadonly();
  readonly enCurso = this.actualizando.asReadonly();

  private iniciado = false;
  private buscando = false;

  iniciar(): void {
    if (this.iniciado || !this.sw.isEnabled) return;
    this.iniciado = true;

    this.sw.versionUpdates.subscribe((e) => {
      if (e.type === 'VERSION_READY') this.lista.set(true);
      if (e.type === 'VERSION_INSTALLATION_FAILED') console.warn('No se pudo instalar la versión nueva:', e.error);
    });
    this.sw.unrecoverable.subscribe(() => this.rotaSenal.set(true));

    this.buscar();
    this.doc.addEventListener('visibilitychange', () => {
      if (this.doc.visibilityState === 'visible') this.buscar();
    });
    setInterval(() => this.buscar(), INTERVALO_DE_BUSQUEDA_MS);
  }

  /** Busca una versión nueva. Si no hay red o falla, se vuelve a intentar en la próxima ocasión. */
  buscar(): void {
    if (this.buscando || this.lista()) return;
    this.buscando = true;
    this.sw
      .checkForUpdate()
      .catch(() => false)
      .finally(() => (this.buscando = false));
  }

  /** "Actualizar": activa la versión nueva y recarga. */
  async actualizar(): Promise<void> {
    if (this.actualizando()) return;
    this.actualizando.set(true);
    try {
      if (!this.rotaSenal()) await this.sw.activateUpdate();
    } catch {
      // Si no se pudo activar, la recarga igual toma la versión que el service worker tenga lista.
    }
    this.recargar();
  }
}

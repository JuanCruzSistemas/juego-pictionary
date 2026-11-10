import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';
import { ALMACEN } from '../comun/almacen';

/** El evento de Chrome para ofrecer la instalación. No está en los tipos estándar de TypeScript. */
type EventoDeInstalacion = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export const CLAVE_INSTALAR = 'garabato.instalar';

/**
 * La tarjeta "Instalá Garabato en tu celu". Se ofrece si el navegador lo permite
 * (`beforeinstallprompt`), si la app no está instalada y si en este dispositivo no se tocó "Ahora no".
 * Se crea al arrancar la app, porque el evento llega una sola vez, apenas carga la página.
 */
@Injectable({ providedIn: 'root' })
export class InstalacionService {
  private readonly ventana = inject(DOCUMENT).defaultView;
  private readonly almacen = inject(ALMACEN);

  private readonly evento = signal<EventoDeInstalacion | null>(null);
  private readonly instalada = signal(this.abiertaComoApp());
  private readonly descartada = signal(this.almacen.leer(CLAVE_INSTALAR) === 'no-ahora');

  readonly ofrecer = computed(() => this.evento() !== null && !this.instalada() && !this.descartada());

  constructor() {
    const v = this.ventana;
    if (!v) return;
    v.addEventListener('beforeinstallprompt', (e) => {
      // Sin esto Chrome muestra su propia barra; la oferta la hace la tarjeta.
      e.preventDefault();
      this.evento.set(e as EventoDeInstalacion);
    });
    v.addEventListener('appinstalled', () => {
      this.instalada.set(true);
      this.evento.set(null);
    });
    v.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', (e) => {
      if (e.matches) this.instalada.set(true);
    });
  }

  /** "Instalar": muestra el diálogo del navegador. El evento sirve una sola vez. */
  async instalar(): Promise<void> {
    const e = this.evento();
    if (!e) return;
    this.evento.set(null);
    await e.prompt();
    const { outcome } = await e.userChoice;
    if (outcome === 'accepted') this.instalada.set(true);
  }

  /** "Ahora no": no se vuelve a ofrecer en este dispositivo. */
  ahoraNo(): void {
    this.descartada.set(true);
    this.almacen.guardar(CLAVE_INSTALAR, 'no-ahora');
  }

  private abiertaComoApp(): boolean {
    const v = this.ventana as (Window & { navigator: Navigator & { standalone?: boolean } }) | null;
    return !!v && (v.matchMedia?.('(display-mode: standalone)').matches || v.navigator.standalone === true);
  }
}

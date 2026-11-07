import { DOCUMENT, DestroyRef, Injectable, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import type { Estado, TurnoActual } from '@garabato/shared';
import { ApiService } from '../api/api.service';
import { SesionService } from '../sesion/sesion.service';

export const INTERVALO_MS = 5000;

/**
 * Estado del juego, compartido por las pantallas. Mientras alguna lo sigue, se actualiza cada 5 s
 * con la pestaña visible; con la pestaña oculta se pausa, y al volver se actualiza en el acto.
 */
@Injectable({ providedIn: 'root' })
export class EstadoService {
  private readonly api = inject(ApiService);
  private readonly doc = inject(DOCUMENT);
  private readonly sesion = inject(SesionService);

  private readonly valor = signal<Estado | null>(null);
  private readonly fallo = signal(false);
  readonly estado = this.valor.asReadonly();
  /** true si la última actualización falló. Se sigue reintentando solo. */
  readonly error = this.fallo.asReadonly();

  private temporizador: ReturnType<typeof setInterval> | null = null;
  /** Sube con cada cambio local; una respuesta pedida antes de un cambio local llega vieja y se descarta. */
  private version = 0;
  private enCurso = false;
  private seguidores = 0;

  private readonly alCambiarVisibilidad = () => {
    if (this.visible()) {
      this.actualizar();
      this.programar();
    } else {
      this.desprogramar();
    }
  };

  /** Empieza a seguir el estado hasta que se destruya quien llama. */
  seguir(destroyRef: DestroyRef): void {
    this.seguidores++;
    if (this.seguidores === 1) {
      this.doc.addEventListener('visibilitychange', this.alCambiarVisibilidad);
      this.alCambiarVisibilidad();
    }
    destroyRef.onDestroy(() => {
      this.seguidores--;
      if (this.seguidores === 0) {
        this.doc.removeEventListener('visibilitychange', this.alCambiarVisibilidad);
        this.desprogramar();
      }
    });
  }

  /** Pide el estado ya. Si hay un pedido en curso, no lo duplica. */
  actualizar(): void {
    if (this.enCurso) return;
    this.enCurso = true;
    const version = this.version;
    this.api
      .estado()
      .pipe(finalize(() => (this.enCurso = false)))
      .subscribe({
        next: (e) => {
          this.completarInvitacion(e.invitacion);
          if (version !== this.version) return;
          this.valor.set(e);
          this.fallo.set(false);
        },
        error: () => this.fallo.set(true),
      });
  }

  /**
   * Aplica el turno que devolvió la API después de un cambio (por ejemplo, elegir la palabra),
   * sin esperar al próximo pedido. Las respuestas que estaban en camino se descartan.
   */
  aplicarTurno(turno: TurnoActual): void {
    this.version++;
    this.valor.update((e) => (e ? { ...e, turno } : e));
  }

  /** Al cerrar la sesión, para que otra persona en el mismo dispositivo no vea datos viejos. */
  olvidar(): void {
    this.version++;
    this.valor.set(null);
    this.fallo.set(false);
  }

  /** Para sesiones guardadas antes de que se guardara la invitación. */
  private completarInvitacion(invitacion: string): void {
    const s = this.sesion.actual();
    if (s && s.invitacion !== invitacion) this.sesion.guardar({ ...s, invitacion });
  }

  private visible(): boolean {
    return this.doc.visibilityState === 'visible';
  }

  private programar(): void {
    this.desprogramar();
    this.temporizador = setInterval(() => this.actualizar(), INTERVALO_MS);
  }

  private desprogramar(): void {
    if (this.temporizador !== null) clearInterval(this.temporizador);
    this.temporizador = null;
  }
}

import { DOCUMENT, DestroyRef, Injectable, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import type { Estado } from '@garabato/shared';
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
    this.api
      .estado()
      .pipe(finalize(() => (this.enCurso = false)))
      .subscribe({
        next: (e) => {
          this.completarInvitacion(e.invitacion);
          this.valor.set(e);
          this.fallo.set(false);
        },
        error: () => this.fallo.set(true),
      });
  }

  /** Al cerrar la sesión, para que otra persona en el mismo dispositivo no vea datos viejos. */
  olvidar(): void {
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

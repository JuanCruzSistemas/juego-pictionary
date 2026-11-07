import { Injectable, computed, signal } from '@angular/core';
import type { Stroke } from '@garabato/shared';
import { deshacer } from './trazos';

/**
 * El dibujo en curso, como Stroke[]. Lienzo lo manda con `paraEnviar()`.
 * Vive mientras la app está abierta y está atado a un turno: si cambia el turno, arranca vacío.
 */
@Injectable({ providedIn: 'root' })
export class DibujoService {
  private readonly lista = signal<Stroke[]>([]);
  readonly trazos = this.lista.asReadonly();
  readonly vacio = computed(() => this.lista().length === 0);
  readonly cantidadDePuntos = computed(() => this.lista().reduce((n, t) => n + t.points.length, 0));
  /** ms desde el primer punto hasta el último. */
  readonly duracionMs = computed(() => Math.max(0, ...this.lista().map((t) => t.points.at(-1)?.t ?? 0)));

  private turnoId: string | null = null;
  /** timeStamp del evento del primer punto del dibujo. */
  private origen: number | null = null;

  /** Asocia el dibujo a un turno. Si es otro turno, lo vacía. */
  usarTurno(turnoId: string): void {
    if (this.turnoId === turnoId) return;
    this.turnoId = turnoId;
    this.borrarTodo();
  }

  /** ms enteros desde el primer punto del dibujo. El primer punto fija el origen. */
  readonly tiempo = (timeStamp: number): number => {
    if (this.origen === null) this.origen = timeStamp;
    return Math.max(0, Math.round(timeStamp - this.origen));
  };

  agregar(trazo: Stroke): void {
    if (trazo.points.length === 0) return;
    this.lista.update((l) => [...l, trazo]);
  }

  /** Saca el último trazo completo. Si no queda ninguno, el próximo trazo vuelve a empezar en t = 0. */
  deshacer(): void {
    this.lista.update(deshacer);
    if (this.lista().length === 0) this.origen = null;
  }

  borrarTodo(): void {
    this.lista.set([]);
    this.origen = null;
  }

  /** El body de POST /api/turnos/:id/dibujo. La duración la calcula la API. */
  paraEnviar(): { trazos: Stroke[] } {
    return { trazos: this.lista() };
  }
}

import { Injectable, computed, inject, signal } from '@angular/core';
import type { Stroke } from '@garabato/shared';
import { ALMACEN } from '../comun/almacen';
import { deshacer } from './trazos';

export const CLAVE_BORRADOR = 'garabato.borrador';
/** Al seguir un borrador, el próximo trazo arranca este tiempo después del último. */
const PAUSA_AL_RETOMAR_MS = 500;

type Borrador = { turnoId: string; trazos: Stroke[] };

/**
 * El dibujo en curso, como Stroke[]. Lienzo lo manda con `paraEnviar()`.
 * Está atado a un turno y se guarda como borrador en el dispositivo después de cada cambio:
 * si se cierra la app o se recarga, al volver a Lienzo del mismo turno el dibujo sigue ahí.
 * Se borra al mandarlo, al borrar todo o cuando el turno cambia.
 */
@Injectable({ providedIn: 'root' })
export class DibujoService {
  private readonly almacen = inject(ALMACEN);

  private readonly lista = signal<Stroke[]>([]);
  readonly trazos = this.lista.asReadonly();
  readonly vacio = computed(() => this.lista().length === 0);
  readonly cantidadDePuntos = computed(() => this.lista().reduce((n, t) => n + t.points.length, 0));
  /** ms desde el primer punto hasta el último. */
  readonly duracionMs = computed(() => Math.max(0, ...this.lista().map((t) => t.points.at(-1)?.t ?? 0)));

  private turnoId: string | null = null;
  /** timeStamp del evento que corresponde a t = 0. */
  private origen: number | null = null;
  /** Al retomar un borrador, en qué t arranca el próximo trazo. */
  private retomarEn = 0;

  /** Asocia el dibujo a un turno. Si hay un borrador de ese turno, lo recupera; si es de otro, lo borra. */
  usarTurno(turnoId: string): void {
    if (this.turnoId === turnoId) return;
    this.turnoId = turnoId;
    this.origen = null;
    const borrador = this.leerBorrador();
    if (borrador?.turnoId === turnoId) {
      this.lista.set(borrador.trazos);
      this.retomarEn = this.vacio() ? 0 : this.duracionMs() + PAUSA_AL_RETOMAR_MS;
    } else {
      this.borrarTodo();
    }
  }

  /** Si el borrador guardado no es del turno indicado, lo borra. Inicio lo llama cuando cambia el turno. */
  descartarSiNoEs(turnoId: string | null): void {
    const borrador = this.leerBorrador();
    if (borrador && borrador.turnoId !== turnoId) this.almacen.borrar(CLAVE_BORRADOR);
    if (this.turnoId !== null && this.turnoId !== turnoId) {
      this.turnoId = null;
      this.lista.set([]);
      this.origen = null;
    }
  }

  /** ms enteros desde el primer punto del dibujo. El primer punto fija el origen. */
  readonly tiempo = (timeStamp: number): number => {
    if (this.origen === null) this.origen = timeStamp - this.retomarEn;
    return Math.max(0, Math.round(timeStamp - this.origen));
  };

  agregar(trazo: Stroke): void {
    if (trazo.points.length === 0) return;
    this.lista.update((l) => [...l, trazo]);
    this.guardarBorrador();
  }

  /** Saca el último trazo completo. Si no queda ninguno, el próximo trazo vuelve a empezar en t = 0. */
  deshacer(): void {
    this.lista.update(deshacer);
    if (this.vacio()) this.reiniciarTiempo();
    this.guardarBorrador();
  }

  borrarTodo(): void {
    this.lista.set([]);
    this.reiniciarTiempo();
    this.almacen.borrar(CLAVE_BORRADOR);
  }

  /** El body de POST /api/turnos/:id/dibujo. La duración la calcula la API. */
  paraEnviar(): { trazos: Stroke[] } {
    return { trazos: this.lista() };
  }

  private reiniciarTiempo(): void {
    this.origen = null;
    this.retomarEn = 0;
  }

  private guardarBorrador(): void {
    if (this.turnoId === null) return;
    if (this.vacio()) {
      this.almacen.borrar(CLAVE_BORRADOR);
      return;
    }
    const borrador: Borrador = { turnoId: this.turnoId, trazos: this.lista() };
    this.almacen.guardar(CLAVE_BORRADOR, JSON.stringify(borrador));
  }

  private leerBorrador(): Borrador | null {
    const crudo = this.almacen.leer(CLAVE_BORRADOR);
    if (!crudo) return null;
    try {
      const b = JSON.parse(crudo) as Partial<Borrador>;
      return typeof b.turnoId === 'string' && Array.isArray(b.trazos) ? (b as Borrador) : null;
    } catch {
      return null;
    }
  }
}

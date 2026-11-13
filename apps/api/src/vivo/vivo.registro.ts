import { Injectable } from '@nestjs/common';
import type { Stroke, StrokePoint, Vivo } from '@garabato/shared';

/** Cuánto espera una partida pausada a que vuelva quien se desconectó. */
export const ESPERA_RECONEXION_MS = 2 * 60_000;
/** Cuánto espera una invitación a que la otra persona entre. */
export const ESPERA_INVITACION_MS = 10 * 60_000;

type Partida = {
  estado: Vivo['estado'];
  invitadorId: string;
  /** Quiénes tienen abierta la pantalla en vivo, según el último aviso del gateway. */
  presentes: string[];
  /** El dibujo en curso del turno actual, tal como llega trazo por trazo. */
  turnoId: string | null;
  trazos: Stroke[];
  temporizador: ReturnType<typeof setTimeout> | null;
};

/**
 * Las partidas en vivo, en memoria. Hay una sola instancia de la API, así que alcanza.
 * Si la API se reinicia, las partidas se pierden: los turnos siguen por turnos y quien dibujaba
 * tiene el dibujo como borrador en su celular. Si las dos personas vuelven a la pantalla en vivo,
 * la partida se arma de nuevo sola.
 *
 * El gateway lleva la cuenta de quién está conectado y la pasa en `presentes`.
 */
@Injectable()
export class VivoRegistro {
  private readonly partidas = new Map<string, Partida>();
  /** Se llama cuando una partida cambia de estado o termina sola (para avisar a la sala). */
  alCambiar: (salaId: string) => void = () => undefined;

  vista(salaId: string): Vivo | null {
    const p = this.partidas.get(salaId);
    return p ? { estado: p.estado, invitadorId: p.invitadorId, presentes: [...p.presentes] } : null;
  }

  estaActiva(salaId: string): boolean {
    return this.partidas.get(salaId)?.estado === 'activa';
  }

  /** Crea la partida con quien invita, si no había una. */
  invitar(salaId: string, jugadorId: string, presentes: string[]): void {
    if (!this.partidas.has(salaId)) {
      this.partidas.set(salaId, { estado: 'esperando', invitadorId: jugadorId, presentes: [], turnoId: null, trazos: [], temporizador: null });
    }
    this.actualizar(salaId, presentes);
  }

  /**
   * Cambió quién está conectado. Dos personas: activa (si no había partida, se arma sola, por
   * ejemplo después de un reinicio de la API). Una: esperando si nunca arrancó, o pausada.
   * Nadie: termina.
   */
  actualizar(salaId: string, presentes: string[]): void {
    const unicos = [...new Set(presentes)];
    let p = this.partidas.get(salaId);
    if (!p) {
      if (unicos.length < 2) return;
      p = { estado: 'activa', invitadorId: unicos[0], presentes: unicos, turnoId: null, trazos: [], temporizador: null };
      this.partidas.set(salaId, p);
      this.alCambiar(salaId);
      return;
    }
    if (unicos.length === 0) {
      this.terminar(salaId);
      return;
    }
    const antes = { estado: p.estado, presentes: p.presentes.join() };
    p.presentes = unicos;
    if (unicos.length >= 2) p.estado = 'activa';
    else if (p.estado === 'activa') p.estado = 'pausada';

    if (p.temporizador) clearTimeout(p.temporizador);
    p.temporizador = null;
    if (p.estado !== 'activa') {
      const espera = p.estado === 'pausada' ? ESPERA_RECONEXION_MS : ESPERA_INVITACION_MS;
      p.temporizador = setTimeout(() => this.terminar(salaId), espera);
      p.temporizador.unref?.();
    }
    if (antes.estado !== p.estado || antes.presentes !== p.presentes.join()) this.alCambiar(salaId);
  }

  terminar(salaId: string): void {
    const p = this.partidas.get(salaId);
    if (!p) return;
    if (p.temporizador) clearTimeout(p.temporizador);
    this.partidas.delete(salaId);
    this.alCambiar(salaId);
  }

  // ---------- El dibujo en curso ----------

  /** Lo dibujado hasta ahora en el turno, o [] si es de otro turno. */
  trazosDe(salaId: string, turnoId: string): Stroke[] {
    const p = this.partidas.get(salaId);
    return p && p.turnoId === turnoId ? p.trazos : [];
  }

  iniciarTrazo(salaId: string, turnoId: string, indice: number, trazo: Stroke): boolean {
    const p = this.delTurno(salaId, turnoId);
    if (!p || indice > p.trazos.length) return false;
    p.trazos = [...p.trazos.slice(0, indice), trazo];
    return true;
  }

  agregarPuntos(salaId: string, turnoId: string, indice: number, puntos: StrokePoint[]): boolean {
    const p = this.delTurno(salaId, turnoId);
    const trazo = p?.trazos[indice];
    if (!trazo) return false;
    trazo.points.push(...puntos);
    return true;
  }

  reemplazarTrazos(salaId: string, turnoId: string, trazos: Stroke[]): boolean {
    const p = this.delTurno(salaId, turnoId);
    if (!p) return false;
    p.trazos = trazos;
    return true;
  }

  /** Cuando el turno se cierra, su dibujo en curso ya no sirve. */
  olvidarTurno(salaId: string, turnoId: string): void {
    const p = this.partidas.get(salaId);
    if (p && p.turnoId === turnoId) {
      p.turnoId = null;
      p.trazos = [];
    }
  }

  /** La partida, apuntada al turno indicado: si cambió de turno, arranca un dibujo vacío. */
  private delTurno(salaId: string, turnoId: string): Partida | null {
    const p = this.partidas.get(salaId);
    if (!p) return null;
    if (p.turnoId !== turnoId) {
      p.turnoId = turnoId;
      p.trazos = [];
    }
    return p;
  }
}

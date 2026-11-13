import { Injectable, inject, signal } from '@angular/core';
import { io, type Socket } from 'socket.io-client';
import type { EventosAlCliente, EventosAlServidor, Stroke, StrokePoint, Vivo } from '@garabato/shared';
import { API_BASE } from '../api/api-base';
import { SesionService } from '../sesion/sesion.service';
import { EstadoService } from '../estado/estado.service';

type SocketVivo = Socket<EventosAlCliente, EventosAlServidor>;

/**
 * La conexión del modo en vivo. La abre la pantalla en vivo y la cierra al salir: estar
 * conectado es "estar en la partida". El juego sigue por HTTP; por acá viajan la presencia,
 * la invitación y el dibujo mientras se dibuja. Si se corta, Socket.IO se reconecta solo.
 */
@Injectable({ providedIn: 'root' })
export class VivoService {
  private readonly sesion = inject(SesionService);
  private readonly estados = inject(EstadoService);

  /** La partida, o null si no hay. Vale después de `listo`. */
  readonly vivo = signal<Vivo | null>(null);
  /** true cuando el servidor ya validó la sesión y mandó el estado de la partida. */
  readonly listo = signal(false);
  readonly error = signal<string | null>(null);
  /** El dibujo de la otra persona mientras lo dibuja, y de qué turno es. */
  readonly trazos = signal<Stroke[]>([]);
  readonly trazosDelTurno = signal<string | null>(null);

  private socket: SocketVivo | null = null;
  /** Los puntos llegan muchas veces por segundo: se juntan y se muestran una vez por cuadro. */
  private pendientes: Stroke[] | null = null;
  private cuadro: number | null = null;

  conectar(): void {
    const token = this.sesion.actual()?.token;
    if (this.socket || !token) return;
    // Vacío = mismo origen (desarrollo, por el proxy de ng serve).
    const s: SocketVivo = io(API_BASE || undefined, { auth: { token } });
    this.socket = s;
    s.on('disconnect', () => this.listo.set(false));
    s.on('vivo:estado', (v) => {
      this.vivo.set(v);
      this.listo.set(true);
    });
    s.on('vivo:error', (m) => this.error.set(m));
    s.on('vivo:cambio', () => this.estados.actualizar());
    s.on('trazos:todos', ({ turnoId, trazos }) => this.mostrar(turnoId, trazos.map(copiar)));
    s.on('trazo:inicio', ({ turnoId, indice, trazo }) => {
      const lista = this.actuales(turnoId);
      this.mostrar(turnoId, [...lista.slice(0, indice), copiar(trazo)]);
    });
    s.on('trazo:puntos', ({ turnoId, indice, puntos }) => {
      const lista = this.actuales(turnoId);
      const trazo = lista[indice];
      if (!trazo) return;
      trazo.points.push(...puntos);
      this.mostrar(turnoId, lista);
    });
  }

  desconectar(): void {
    this.socket?.disconnect();
    this.socket = null;
    if (this.cuadro !== null) cancelAnimationFrame(this.cuadro);
    this.cuadro = null;
    this.pendientes = null;
    this.listo.set(false);
    this.vivo.set(null);
    this.error.set(null);
    this.trazos.set([]);
    this.trazosDelTurno.set(null);
  }

  invitar(): void {
    this.error.set(null);
    this.socket?.emit('vivo:invitar');
  }

  terminar(): void {
    this.socket?.emit('vivo:terminar');
  }

  enviarInicio(turnoId: string, indice: number, trazo: Stroke): void {
    this.socket?.emit('trazo:inicio', { turnoId, indice, trazo });
  }

  enviarPuntos(turnoId: string, indice: number, puntos: StrokePoint[]): void {
    this.socket?.emit('trazo:puntos', { turnoId, indice, puntos });
  }

  enviarTodos(turnoId: string, trazos: Stroke[]): void {
    this.socket?.emit('trazos:todos', { turnoId, trazos });
  }

  /** La lista que se está armando: la pendiente de mostrar, o la que se ve. Otro turno arranca vacío. */
  private actuales(turnoId: string): Stroke[] {
    if (this.trazosDelTurno() !== turnoId) return [];
    return this.pendientes ?? this.trazos().map(copiar);
  }

  private mostrar(turnoId: string, lista: Stroke[]): void {
    this.trazosDelTurno.set(turnoId);
    this.pendientes = lista;
    if (this.cuadro !== null) return;
    this.cuadro = requestAnimationFrame(() => {
      this.cuadro = null;
      if (this.pendientes) this.trazos.set(this.pendientes);
      this.pendientes = null;
    });
  }
}

function copiar(t: Stroke): Stroke {
  return { ...t, points: [...t.points] };
}

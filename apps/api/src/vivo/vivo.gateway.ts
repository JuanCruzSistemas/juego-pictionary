import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import type { EventosAlCliente, EventosAlServidor, Stroke, StrokePoint } from '@garabato/shared';
import { PrismaService } from '../db/prisma.service.js';
import { hashToken } from '../sesion/tokens.js';
import { NotificacionesService } from '../push/notificaciones.service.js';
import { avisos } from '../push/avisos.js';
import { PUNTOS_MAXIMOS, TRAZOS_MAXIMOS, problemaDelDibujo } from '../dibujos/reglas.js';
import { VivoRegistro } from './vivo.registro.js';
import { VivoCanal, salaDeSockets, type ServidorVivo } from './vivo.canal.js';

type DatosDelSocket = { jugadorId: string; salaId: string; nombre: string };
type SocketVivo = Socket<EventosAlServidor, EventosAlCliente, Record<string, never>, DatosDelSocket>;

/** Puntos por mensaje: un trazo se manda de a pedazos, cada cuadro de pantalla. */
const PUNTOS_POR_MENSAJE = 2000;

/**
 * El modo en vivo. Cada pantalla en vivo abre un socket con el token de sesión.
 * El juego (palabra, intentos, pistas, salteos) sigue por HTTP; por acá viajan la presencia,
 * la invitación y el dibujo mientras se dibuja. El CORS lo pone el adaptador de configurar.ts.
 *
 * La sesión se valida al conectarse, que es asíncrono: el primer `vivo:estado` le avisa al cliente
 * que ya está listo. Los eventos de un socket que todavía no se validó se ignoran.
 */
@WebSocketGateway()
export class VivoGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() private servidor!: ServidorVivo;
  private readonly log = new Logger('Vivo');
  /** Turnos ya validados para dibujar en vivo: turnoId → quién lo dibuja. Evita ir a la base en cada punto. */
  private readonly dibujantes = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly registro: VivoRegistro,
    private readonly canal: VivoCanal,
    private readonly notificaciones: NotificacionesService,
  ) {}

  afterInit(servidor: ServidorVivo): void {
    this.canal.usar(servidor);
  }

  async handleConnection(socket: SocketVivo): Promise<void> {
    const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
    const jugador =
      typeof token === 'string' && token ? await this.prisma.jugador.findUnique({ where: { sesionHash: hashToken(token) } }) : null;
    if (!jugador) {
      socket.emit('vivo:error', 'No encontramos tu sesión en este dispositivo.');
      socket.disconnect(true);
      return;
    }
    socket.data = { jugadorId: jugador.id, salaId: jugador.salaId, nombre: jugador.nombre };
    await socket.join(salaDeSockets(jugador.salaId));
    this.registro.actualizar(jugador.salaId, await this.presentes(jugador.salaId));
    socket.emit('vivo:estado', this.registro.vista(jugador.salaId));

    // Quien llega a mitad de un dibujo lo recibe entero.
    const turno = await this.turnoActual(jugador.salaId);
    if (turno) {
      const trazos = this.registro.trazosDe(jugador.salaId, turno.id);
      if (trazos.length > 0) socket.emit('trazos:todos', { turnoId: turno.id, trazos });
    }
  }

  async handleDisconnect(socket: SocketVivo): Promise<void> {
    const salaId = socket.data?.salaId;
    // Durante la desconexión el socket todavía puede figurar en la sala: se lo deja afuera.
    if (salaId) this.registro.actualizar(salaId, await this.presentes(salaId, socket.id));
  }

  @SubscribeMessage('vivo:invitar')
  async invitar(@ConnectedSocket() socket: SocketVivo): Promise<void> {
    if (!listo(socket)) return;
    const { salaId, jugadorId, nombre } = socket.data;
    const [turno, otro] = await Promise.all([
      this.turnoActual(salaId),
      this.prisma.jugador.findFirst({ where: { salaId, id: { not: jugadorId } } }),
    ]);
    if (!otro) {
      socket.emit('vivo:error', 'Todavía no entró la otra persona.');
      return;
    }
    if (!turno || (turno.estado !== 'eligiendo' && turno.estado !== 'dibujando')) {
      socket.emit('vivo:error', 'Hay un dibujo esperando que lo adivinen: terminen ese turno primero.');
      return;
    }
    const yaHabia = this.registro.vista(salaId) !== null;
    this.registro.invitar(salaId, jugadorId, await this.presentes(salaId));
    if (!yaHabia && !this.registro.estaActiva(salaId)) this.notificaciones.avisar(otro.id, salaId, avisos.vivo(nombre));
    socket.emit('vivo:estado', this.registro.vista(salaId));
  }

  @SubscribeMessage('vivo:terminar')
  terminar(@ConnectedSocket() socket: SocketVivo): void {
    if (listo(socket)) this.registro.terminar(socket.data.salaId);
  }

  @SubscribeMessage('trazo:inicio')
  async inicio(
    @ConnectedSocket() socket: SocketVivo,
    @MessageBody() d: { turnoId: string; indice: number; trazo: Stroke },
  ): Promise<void> {
    if (!(await this.puedeDibujar(socket, d?.turnoId)) || !Number.isInteger(d.indice) || d.indice < 0 || d.indice >= TRAZOS_MAXIMOS) return;
    if (problemaDelDibujo([d.trazo])) return;
    if (this.registro.iniciarTrazo(socket.data.salaId, d.turnoId, d.indice, d.trazo)) socket.to(salaDeSockets(socket.data.salaId)).emit('trazo:inicio', d);
  }

  @SubscribeMessage('trazo:puntos')
  async puntos(
    @ConnectedSocket() socket: SocketVivo,
    @MessageBody() d: { turnoId: string; indice: number; puntos: StrokePoint[] },
  ): Promise<void> {
    if (!(await this.puedeDibujar(socket, d?.turnoId)) || !Number.isInteger(d.indice)) return;
    if (!Array.isArray(d.puntos) || d.puntos.length === 0 || d.puntos.length > PUNTOS_POR_MENSAJE) return;
    // Mismas reglas que un trazo guardado: x e y de 0 a 1, t entero y creciente.
    if (problemaDelDibujo([{ color: '#111111', width: 0.02, points: d.puntos }])) return;
    const { salaId } = socket.data;
    if (contarPuntos(this.registro.trazosDe(salaId, d.turnoId)) + d.puntos.length > PUNTOS_MAXIMOS) return;
    if (this.registro.agregarPuntos(salaId, d.turnoId, d.indice, d.puntos)) socket.to(salaDeSockets(salaId)).emit('trazo:puntos', d);
  }

  @SubscribeMessage('trazos:todos')
  async todos(@ConnectedSocket() socket: SocketVivo, @MessageBody() d: { turnoId: string; trazos: Stroke[] }): Promise<void> {
    if (!(await this.puedeDibujar(socket, d?.turnoId))) return;
    // Al deshacer todo, la lista puede quedar vacía.
    if (!Array.isArray(d.trazos) || (d.trazos.length > 0 && problemaDelDibujo(d.trazos))) return;
    if (this.registro.reemplazarTrazos(socket.data.salaId, d.turnoId, d.trazos)) socket.to(salaDeSockets(socket.data.salaId)).emit('trazos:todos', d);
  }

  /** Solo quien dibuja el turno actual, con la palabra ya elegida, y con la partida activa. */
  private async puedeDibujar(socket: SocketVivo, turnoId: unknown): Promise<boolean> {
    if (!listo(socket)) return false;
    const { salaId, jugadorId } = socket.data;
    if (!salaId || typeof turnoId !== 'string' || !this.registro.estaActiva(salaId)) return false;
    let dibujante = this.dibujantes.get(turnoId);
    if (dibujante === undefined) {
      const turno = await this.turnoActual(salaId);
      if (!turno || turno.id !== turnoId || turno.estado !== 'dibujando') return false;
      dibujante = turno.dibujaId;
      if (this.dibujantes.size > 1000) this.dibujantes.clear();
      this.dibujantes.set(turnoId, dibujante);
    }
    return dibujante === jugadorId;
  }

  private turnoActual(salaId: string) {
    return this.prisma.turno.findFirst({ where: { salaId }, orderBy: { numero: 'desc' } });
  }

  /** Quiénes tienen la pantalla en vivo abierta ahora. */
  private async presentes(salaId: string, excepto?: string): Promise<string[]> {
    const sockets = await this.servidor.in(salaDeSockets(salaId)).fetchSockets();
    return sockets
      .filter((s) => s.id !== excepto)
      .map((s) => s.data.jugadorId).filter((id): id is string => typeof id === 'string');
  }
}

/** El socket ya pasó la validación de la sesión. */
function listo(socket: SocketVivo): boolean {
  return typeof socket.data?.jugadorId === 'string';
}

function contarPuntos(trazos: readonly Stroke[]): number {
  return trazos.reduce((n, t) => n + t.points.length, 0);
}

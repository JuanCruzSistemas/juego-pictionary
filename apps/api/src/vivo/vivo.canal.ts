import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';
import type { EventosAlCliente, EventosAlServidor } from '@garabato/shared';
import { VivoRegistro } from './vivo.registro.js';

export type ServidorVivo = Server<EventosAlServidor, EventosAlCliente>;

/** La sala de Socket.IO de una sala del juego. */
export const salaDeSockets = (salaId: string) => `sala:${salaId}`;

/**
 * Para avisarle a la sala que algo cambió, desde cualquier parte de la API. El gateway le pasa
 * el servidor de Socket.IO al arrancar; antes de eso (o en tests sin sockets), no hace nada.
 */
@Injectable()
export class VivoCanal {
  private servidor: ServidorVivo | null = null;

  constructor(private readonly registro: VivoRegistro) {
    registro.alCambiar = (salaId) => this.servidor?.to(salaDeSockets(salaId)).emit('vivo:estado', registro.vista(salaId));
  }

  usar(servidor: ServidorVivo): void {
    this.servidor = servidor;
  }

  /** Algo cambió en el juego: las pantallas vuelven a pedir el estado sin esperar al polling. */
  cambio(salaId: string): void {
    this.servidor?.to(salaDeSockets(salaId)).emit('vivo:cambio');
  }
}

import { Injectable } from '@nestjs/common';
import type { Salteos, SalteoRespuesta, TurnoActual } from '@garabato/shared';
import { Prisma, type Jugador, type Turno } from '../generated/prisma/client.js';
import { PrismaService } from '../db/prisma.service.js';
import { Reloj } from '../comun/reloj.js';
import { normalizar } from '../comun/texto.js';
import { datosInvalidos, noEsTuTurno, sinSalteos, turnoCerrado, turnoNoEncontrado } from '../comun/errores.js';
import { sortearOpciones } from './sorteo.js';
import { contarSalteos, inicioDeLaVentana } from './salteos.js';
import type { PalabraValidada } from './palabra.js';
import { vistaDelTurno } from './vista.js';

/** Estados en los que quien dibuja todavía puede cambiar la palabra o saltear. */
const ABIERTOS = ['eligiendo', 'dibujando'] as const;

type Tx = Prisma.TransactionClient;

@Injectable()
export class TurnosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reloj: Reloj,
  ) {}

  /** Crea un turno con sus 3 opciones ya sorteadas. Se llama dentro de una transacción. */
  async crear(
    tx: Tx,
    datos: { salaId: string; numero: number; dibujaId: string; adivinaId: string },
  ): Promise<Turno> {
    const palabras = await tx.palabra.findMany({
      where: { OR: [{ salaId: null }, { salaId: datos.salaId }] },
      select: { texto: true },
    });
    const opciones = sortearOpciones(palabras.map((p) => p.texto));
    return tx.turno.create({ data: { ...datos, opciones } });
  }

  /**
   * Si la sala tiene a sus dos personas y todavía no tiene turnos, crea el turno 1,
   * que dibuja quien entró primero (lugar 1). Si ya hay turnos o falta alguien, no hace nada.
   */
  async crearPrimerTurnoSiFalta(tx: Tx, salaId: string): Promise<void> {
    const [jugadores, turnos] = await Promise.all([
      tx.jugador.findMany({ where: { salaId }, orderBy: { lugar: 'asc' } }),
      tx.turno.count({ where: { salaId } }),
    ]);
    if (jugadores.length < 2 || turnos > 0) return;
    const [primero, segundo] = jugadores;
    await this.crear(tx, { salaId, numero: 1, dibujaId: primero.id, adivinaId: segundo.id });
  }

  /**
   * Repara salas que quedaron llenas sin turno, como las de gente que entró antes de que
   * existiera la creación del turno 1. Si dos pedidos chocan, la restricción única
   * (salaId, numero) deja uno solo y el otro se ignora.
   */
  async asegurarPrimerTurno(salaId: string): Promise<void> {
    try {
      await this.prisma.$transaction((tx) => this.crearPrimerTurnoSiFalta(tx, salaId));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return;
      throw e;
    }
  }

  /** Salteos que le quedan a la persona, según el reloj. */
  async salteosDe(jugadorId: string, tx: Tx = this.prisma): Promise<Salteos> {
    const ahora = this.reloj.ahora();
    const usos = await tx.salteo.findMany({
      where: { jugadorId, creadoEn: { gt: inicioDeLaVentana(ahora) } },
      select: { creadoEn: true },
    });
    return contarSalteos(
      usos.map((u) => u.creadoEn),
      ahora,
    );
  }

  /**
   * Guarda la palabra elegida y pasa el turno a "dibujando". Se puede cambiar mientras no se mande
   * el dibujo. La palabra se guarda tal cual y también normalizada, para comparar las respuestas.
   */
  async elegirPalabra(yo: Jugador, turnoId: string, body: PalabraValidada): Promise<TurnoActual> {
    const turno = await this.turnoQueDibujo(yo, turnoId, this.prisma);
    const cerrado = () => turnoCerrado('Ya mandaste el dibujo: la palabra no se puede cambiar.');
    if (!esAbierto(turno)) throw cerrado();

    let palabra: string;
    let origen: 'sugerida' | 'propia';
    if ('opcion' in body) {
      if (!turno.opciones.includes(body.opcion)) throw datosInvalidos('Esa palabra no es una de tus opciones.');
      palabra = body.opcion;
      origen = 'sugerida';
    } else {
      palabra = body.propia;
      origen = 'propia';
    }

    // La condición sobre el estado va en el UPDATE: si el dibujo se mandó mientras tanto, no cambia nada.
    const r = await this.prisma.turno.updateMany({
      where: { id: turno.id, dibujaId: yo.id, estado: { in: [...ABIERTOS] } },
      data: { palabra, palabraNormalizada: normalizar(palabra), origen, estado: 'dibujando' },
    });
    if (r.count === 0) throw cerrado();

    const actualizado = await this.prisma.turno.findUniqueOrThrow({
      where: { id: turno.id },
      include: { _count: { select: { intentos: true } } },
    });
    return vistaDelTurno(actualizado, yo.id, actualizado._count.intentos);
  }

  /**
   * Saltea el turno: gasta un salteo y crea el turno siguiente, que dibuja la otra persona con
   * 3 opciones nuevas. Todo en una transacción. Un doble toque manda dos pedidos: el UPDATE
   * condicionado al estado deja pasar solo al primero, y el segundo no gasta nada.
   */
  async saltear(yo: Jugador, turnoId: string): Promise<SalteoRespuesta> {
    const cerrado = () => turnoCerrado('Este turno ya no se puede saltear.');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const turno = await this.turnoQueDibujo(yo, turnoId, tx);
        if (!esAbierto(turno)) throw cerrado();
        if ((await this.salteosDe(yo.id, tx)).quedan === 0) throw sinSalteos();

        const r = await tx.turno.updateMany({
          where: { id: turno.id, dibujaId: yo.id, estado: { in: [...ABIERTOS] } },
          data: { estado: 'salteado' },
        });
        if (r.count === 0) throw cerrado();

        await tx.salteo.create({ data: { jugadorId: yo.id, turnoId: turno.id, creadoEn: this.reloj.ahora() } });
        await this.crear(tx, {
          salaId: turno.salaId,
          numero: turno.numero + 1,
          dibujaId: turno.adivinaId,
          adivinaId: yo.id,
        });
        return { salteos: await this.salteosDe(yo.id, tx) };
      });
    } catch (e) {
      // Dos pedidos que llegan juntos y chocan en las restricciones únicas: el segundo no saltea.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw cerrado();
      throw e;
    }
  }

  /** El turno, si es de la sala de quien pide y lo dibuja esa persona. */
  private async turnoQueDibujo(yo: Jugador, turnoId: string, tx: Tx): Promise<Turno> {
    const turno = await tx.turno.findFirst({ where: { id: turnoId, salaId: yo.salaId } });
    if (!turno) throw turnoNoEncontrado();
    if (turno.dibujaId !== yo.id) throw noEsTuTurno();
    return turno;
  }
}

function esAbierto(turno: Turno): boolean {
  return (ABIERTOS as readonly string[]).includes(turno.estado);
}

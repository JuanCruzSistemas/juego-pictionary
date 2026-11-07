import { Injectable } from '@nestjs/common';
import { Prisma, type Turno } from '../generated/prisma/client.js';
import { PrismaService } from '../db/prisma.service.js';
import { sortearOpciones } from './sorteo.js';

type Tx = Prisma.TransactionClient;

@Injectable()
export class TurnosService {
  constructor(private readonly prisma: PrismaService) {}

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
}

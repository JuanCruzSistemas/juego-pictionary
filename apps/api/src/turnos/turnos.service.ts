import { Injectable } from '@nestjs/common';
import type { Prisma, Turno } from '../generated/prisma/client.js';
import { sortearOpciones } from './sorteo.js';

type Tx = Prisma.TransactionClient;

@Injectable()
export class TurnosService {
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
}

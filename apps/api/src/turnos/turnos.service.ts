import { Injectable } from '@nestjs/common';
import type {
  DibujoGuardado,
  EnviarDibujoRespuesta,
  IntentoPublico,
  IntentoRespuesta,
  ResumenTurno,
  Salteos,
  SalteoRespuesta,
  Stroke,
  TurnoActual,
} from '@garabato/shared';
import { acierta } from './acierto.js';
import { NotificacionesService } from '../push/notificaciones.service.js';
import { avisos } from '../push/avisos.js';
import { Prisma, type Jugador, type Turno } from '../generated/prisma/client.js';
import { PrismaService } from '../db/prisma.service.js';
import { Reloj } from '../comun/reloj.js';
import { normalizar } from '../comun/texto.js';
import {
  datosInvalidos,
  dibujoNoDisponible,
  noEsTuTurno,
  resumenNoDisponible,
  sinSalteos,
  turnoCerrado,
  turnoNoEncontrado,
} from '../comun/errores.js';
import { duracionDe } from '../dibujos/reglas.js';
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
    private readonly notificaciones: NotificacionesService,
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
      const { respuesta, salaId, avisarA } = await this.prisma.$transaction(async (tx) => {
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
        return { respuesta: { salteos: await this.salteosDe(yo.id, tx) }, salaId: turno.salaId, avisarA: turno.adivinaId };
      });
      // Después de la transacción: un aviso que falla no afecta al salteo.
      this.notificaciones.avisar(avisarA, salaId, avisos.salteo(yo.nombre));
      return respuesta;
    } catch (e) {
      // Dos pedidos que llegan juntos y chocan en las restricciones únicas: el segundo no saltea.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw cerrado();
      throw e;
    }
  }

  /**
   * Guarda el dibujo y pasa el turno a "adivinando". Es idempotente: si el dibujo de este turno
   * ya se mandó (un reintento, un doble toque), no lo reemplaza y responde igual que la primera vez.
   */
  async enviarDibujo(yo: Jugador, turnoId: string, trazos: Stroke[]): Promise<EnviarDibujoRespuesta> {
    /** Si este pedido guardó el dibujo: a quién avisar. Un reintento no guarda nada y no avisa. */
    let guardado: { salaId: string; adivinaId: string } | null = null;
    try {
      await this.prisma.$transaction(async (tx) => {
        const turno = await this.turnoQueDibujo(yo, turnoId, tx);
        if (turno.estado === 'adivinando' || turno.estado === 'adivinado') return; // ya mandado
        if (turno.estado === 'eligiendo') throw turnoCerrado('Elegí la palabra antes de mandar el dibujo.');
        if (turno.estado === 'salteado') throw turnoCerrado('Este turno se salteó: el dibujo no se puede mandar.');

        // Si dos pedidos llegan juntos, el segundo espera el bloqueo de esta fila y no encuentra nada que cambiar.
        const r = await tx.turno.updateMany({
          where: { id: turno.id, estado: 'dibujando' },
          data: { estado: 'adivinando', enviadoEn: this.reloj.ahora() },
        });
        if (r.count === 0) return;
        await tx.dibujo.create({
          data: { turnoId: turno.id, autorId: yo.id, trazos, duracionMs: duracionDe(trazos), creadoEn: this.reloj.ahora() },
        });
        guardado = { salaId: turno.salaId, adivinaId: turno.adivinaId };
      });
    } catch (e) {
      guardado = null;
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
    }
    const aviso = guardado as { salaId: string; adivinaId: string } | null;
    if (aviso) this.notificaciones.avisar(aviso.adivinaId, aviso.salaId, avisos.dibujo(yo.nombre));

    const turno = await this.prisma.turno.findUniqueOrThrow({
      where: { id: turnoId },
      include: { _count: { select: { intentos: true } } },
    });
    return {
      turno: turno.estado === 'adivinando' ? vistaDelTurno(turno, yo.id, turno._count.intentos) : null,
    };
  }

  /** El dibujo del turno, para quien lo dibujó o quien adivina, una vez mandado. Nunca trae la palabra. */
  async dibujoDe(yo: Jugador, turnoId: string): Promise<DibujoGuardado> {
    const turno = await this.prisma.turno.findFirst({
      where: { id: turnoId, salaId: yo.salaId },
      include: { dibujo: true },
    });
    if (!turno) throw turnoNoEncontrado();
    if (!turno.dibujo) throw dibujoNoDisponible();
    return { trazos: turno.dibujo.trazos as Stroke[], duracionMs: turno.dibujo.duracionMs };
  }

  /** Los intentos del turno, del más nuevo al más viejo. Para quien adivina y quien dibujó. */
  async intentosDe(yo: Jugador, turnoId: string): Promise<IntentoPublico[]> {
    const turno = await this.prisma.turno.findFirst({ where: { id: turnoId, salaId: yo.salaId } });
    if (!turno) throw turnoNoEncontrado();
    return this.listarIntentos(this.prisma, turnoId);
  }

  /**
   * Prueba una respuesta. Si ya se había probado lo mismo (normalizado), no la guarda.
   * Si acierta, en la misma transacción cierra el turno y crea el siguiente, que dibuja quien adivinó.
   * La palabra solo sale en la respuesta cuando acierta.
   */
  async probar(yo: Jugador, turnoId: string, texto: string): Promise<IntentoRespuesta> {
    const { respuesta, avisarA } = await this.prisma.$transaction(async (tx) => {
      // Bloquea el turno: dos respuestas que llegan juntas se procesan de a una,
      // así una repetida no se guarda dos veces y un acierto doble no crea dos turnos.
      await tx.$queryRaw`SELECT id FROM turnos WHERE id = ${turnoId} FOR UPDATE`;
      const turno = await tx.turno.findFirst({ where: { id: turnoId, salaId: yo.salaId } });
      if (!turno) throw turnoNoEncontrado();
      if (turno.adivinaId !== yo.id) throw noEsTuTurno('Este turno lo adivina la otra persona.');
      if (turno.estado !== 'adivinando' || !turno.palabra) throw turnoCerrado('Este turno ya no admite respuestas.');

      const previos = await this.listarIntentos(tx, turno.id);
      const clave = normalizar(texto);
      if (previos.some((i) => normalizar(i.texto) === clave)) {
        return { respuesta: { resultado: 'repetido', intentos: previos } satisfies IntentoRespuesta, avisarA: null };
      }

      const correcto = acierta(texto, turno.palabra);
      if (correcto) {
        // Condicionado al estado: si dos aciertos llegan juntos, el segundo no crea otro turno.
        const r = await tx.turno.updateMany({
          where: { id: turno.id, estado: 'adivinando' },
          data: { estado: 'adivinado', adivinadoEn: this.reloj.ahora() },
        });
        if (r.count === 0) throw turnoCerrado('Este turno ya no admite respuestas.');
      }
      // creadoEn lo pone la base: solo sirve para ordenar, y así no depende del reloj simulado de los tests.
      await tx.intento.create({ data: { turnoId: turno.id, jugadorId: yo.id, texto, correcto } });
      if (correcto) {
        await this.crear(tx, {
          salaId: turno.salaId,
          numero: turno.numero + 1,
          dibujaId: yo.id,
          adivinaId: turno.dibujaId,
        });
      }

      const intentos = await this.listarIntentos(tx, turno.id);
      return correcto
        ? {
            respuesta: { resultado: 'correcto', intentos, palabra: turno.palabra } satisfies IntentoRespuesta,
            avisarA: { jugadorId: turno.dibujaId, salaId: turno.salaId, palabra: turno.palabra, turnoId: turno.id },
          }
        : { respuesta: { resultado: 'incorrecto', intentos } satisfies IntentoRespuesta, avisarA: null };
    });
    // Después de la transacción: un aviso que falla no afecta al acierto.
    if (avisarA) {
      this.notificaciones.avisar(avisarA.jugadorId, avisarA.salaId, avisos.acierto(avisarA.palabra, avisarA.turnoId));
    }
    return respuesta;
  }

  /**
   * Resumen de un turno adivinado: la palabra, el dibujo y los intentos. Es el único lugar, junto con
   * la respuesta del acierto, donde la palabra le llega a quien adivinaba. Solo para las dos personas
   * del turno, y solo si ya está adivinado.
   */
  async resumen(yo: Jugador, turnoId: string): Promise<ResumenTurno> {
    const turno = await this.prisma.turno.findFirst({
      where: { id: turnoId, salaId: yo.salaId },
      include: { dibujo: true, _count: { select: { intentos: true } } },
    });
    if (!turno || (turno.dibujaId !== yo.id && turno.adivinaId !== yo.id)) throw turnoNoEncontrado();
    if (turno.estado !== 'adivinado' || !turno.palabra || !turno.dibujo) throw resumenNoDisponible();
    return {
      turnoId: turno.id,
      numero: turno.numero,
      palabra: turno.palabra,
      intentos: turno._count.intentos,
      trazos: turno.dibujo.trazos as Stroke[],
      adivine: turno.adivinaId === yo.id,
    };
  }

  private async listarIntentos(tx: Tx, turnoId: string): Promise<IntentoPublico[]> {
    const intentos = await tx.intento.findMany({
      where: { turnoId },
      orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
    });
    return intentos.map((i) => ({ id: i.id, texto: i.texto, correcto: i.correcto, creadoEn: i.creadoEn.toISOString() }));
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

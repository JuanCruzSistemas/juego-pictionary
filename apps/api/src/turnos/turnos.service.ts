import { Injectable } from '@nestjs/common';
import type {
  DibujoGuardado,
  EnviarDibujoRespuesta,
  IntentoPublico,
  IntentoRespuesta,
  PistaPublica,
  Racha,
  RendirseRespuesta,
  ResumenTurno,
  Salteos,
  SalteoRespuesta,
  Stroke,
  TurnoActual,
} from '@garabato/shared';
import { acierta, contieneLaPalabra } from './acierto.js';
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
import { sortearConPropias } from './sorteo.js';
import { contarSalteos, inicioDeLaVentana } from './salteos.js';
import type { PalabraValidada } from './palabra.js';
import { vistaDelTurno } from './vista.js';
import { calcularRacha } from './racha.js';
import { VivoRegistro } from '../vivo/vivo.registro.js';
import { VivoCanal } from '../vivo/vivo.canal.js';

/** Estados en los que quien dibuja todavía puede cambiar la palabra o saltear. */
const ABIERTOS = ['eligiendo', 'dibujando'] as const;

type Tx = Prisma.TransactionClient;

@Injectable()
export class TurnosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reloj: Reloj,
    private readonly notificaciones: NotificacionesService,
    private readonly vivo: VivoRegistro,
    private readonly canal: VivoCanal,
  ) {}

  /**
   * ¿Se puede adivinar este turno ya? Por turnos, cuando llegó el dibujo. En vivo, también
   * mientras se dibuja, si ya hay algo dibujado.
   */
  private enJuego(turno: Turno): boolean {
    if (turno.estado === 'adivinando') return true;
    return turno.estado === 'dibujando' && this.vivo.estaActiva(turno.salaId) && this.vivo.trazosDe(turno.salaId, turno.id).length > 0;
  }

  /**
   * En vivo el dibujo no se "manda": al cerrar el turno se guarda lo dibujado hasta ese momento.
   * Por turnos el dibujo ya está guardado y esto no hace nada.
   */
  private async guardarDibujoEnVivo(tx: Tx, turno: Turno): Promise<void> {
    if (turno.estado !== 'dibujando') return;
    const trazos = this.vivo.trazosDe(turno.salaId, turno.id).map((t) => ({ ...t, points: [...t.points] }));
    await tx.dibujo.create({
      data: { turnoId: turno.id, autorId: turno.dibujaId, trazos, duracionMs: duracionDe(trazos), creadoEn: this.reloj.ahora() },
    });
  }

  /** Crea un turno con sus 3 opciones ya sorteadas. Se llama dentro de una transacción. */
  async crear(
    tx: Tx,
    datos: { salaId: string; numero: number; dibujaId: string; adivinaId: string },
  ): Promise<Turno> {
    const palabras = await tx.palabra.findMany({
      where: { OR: [{ salaId: null }, { salaId: datos.salaId }] },
      select: { texto: true, salaId: true },
    });
    const opciones = sortearConPropias(
      palabras.filter((p) => p.salaId === null).map((p) => p.texto),
      palabras.filter((p) => p.salaId !== null).map((p) => p.texto),
    );
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

  /** La racha compartida de la sala, según el reloj. */
  async rachaDe(salaId: string): Promise<Racha> {
    const aciertos = await this.prisma.turno.findMany({
      where: { salaId, estado: 'adivinado', adivinadoEn: { not: null } },
      select: { adivinadoEn: true },
    });
    return calcularRacha(
      aciertos.map((a) => a.adivinadoEn!),
      this.reloj.ahora(),
    );
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

    this.canal.cambio(turno.salaId);
    const actualizado = await this.prisma.turno.findUniqueOrThrow({
      where: { id: turno.id },
      include: { _count: { select: { intentos: true, pistas: true } } },
    });
    return vistaDelTurno(actualizado, yo.id, actualizado._count.intentos, actualizado._count.pistas);
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
      this.vivo.olvidarTurno(salaId, turnoId);
      this.canal.cambio(salaId);
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
        if (turno.estado === 'adivinando' || turno.estado === 'adivinado' || turno.estado === 'rendido') return; // ya mandado
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
    if (aviso) {
      this.canal.cambio(aviso.salaId);
      this.notificaciones.avisar(aviso.adivinaId, aviso.salaId, avisos.dibujo(yo.nombre));
    }

    const turno = await this.prisma.turno.findUniqueOrThrow({
      where: { id: turnoId },
      include: { _count: { select: { intentos: true, pistas: true } } },
    });
    return {
      turno: turno.estado === 'adivinando' ? vistaDelTurno(turno, yo.id, turno._count.intentos, turno._count.pistas) : null,
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
      if (!this.enJuego(turno) || !turno.palabra) {
        throw turnoCerrado(turno.estado === 'dibujando' ? 'Esperá a que empiece a dibujar.' : 'Este turno ya no admite respuestas.');
      }

      const previos = await this.listarIntentos(tx, turno.id);
      const clave = normalizar(texto);
      if (previos.some((i) => normalizar(i.texto) === clave)) {
        return { respuesta: { resultado: 'repetido', intentos: previos } satisfies IntentoRespuesta, avisarA: null };
      }

      const correcto = acierta(texto, turno.palabra);
      if (correcto) {
        // Condicionado al estado: si dos aciertos llegan juntos, el segundo no crea otro turno.
        const r = await tx.turno.updateMany({
          where: { id: turno.id, estado: turno.estado },
          data: { estado: 'adivinado', adivinadoEn: this.reloj.ahora(), enviadoEn: turno.enviadoEn ?? this.reloj.ahora() },
        });
        if (r.count === 0) throw turnoCerrado('Este turno ya no admite respuestas.');
        await this.guardarDibujoEnVivo(tx, turno);
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
    if (respuesta.resultado !== 'repetido') this.canal.cambio(yo.salaId);
    if (avisarA) {
      this.vivo.olvidarTurno(avisarA.salaId, avisarA.turnoId);
      this.notificaciones.avisar(avisarA.jugadorId, avisarA.salaId, avisos.acierto(avisarA.palabra, avisarA.turnoId));
    }
    return respuesta;
  }

  /**
   * Quien adivina se rinde: el turno pasa a "rendido", se revela la palabra y se crea el turno
   * siguiente, que dibuja quien se rindió, igual que con un acierto. No gasta salteos.
   * Bloquea el turno como `probar`: dos toques a la vez crean un solo turno nuevo.
   */
  async rendirse(yo: Jugador, turnoId: string): Promise<RendirseRespuesta> {
    const cerrado = () => turnoCerrado('Este turno ya terminó.');
    const r = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM turnos WHERE id = ${turnoId} FOR UPDATE`;
      const turno = await tx.turno.findFirst({ where: { id: turnoId, salaId: yo.salaId } });
      if (!turno) throw turnoNoEncontrado();
      if (turno.adivinaId !== yo.id) throw noEsTuTurno('Este turno lo adivina la otra persona.');
      if (!this.enJuego(turno) || !turno.palabra) throw cerrado();

      const u = await tx.turno.updateMany({
        where: { id: turno.id, estado: turno.estado },
        data: { estado: 'rendido', enviadoEn: turno.enviadoEn ?? this.reloj.ahora() },
      });
      if (u.count === 0) throw cerrado();
      await this.guardarDibujoEnVivo(tx, turno);
      await this.crear(tx, {
        salaId: turno.salaId,
        numero: turno.numero + 1,
        dibujaId: yo.id,
        adivinaId: turno.dibujaId,
      });
      return { turnoId: turno.id, palabra: turno.palabra, salaId: turno.salaId, avisarA: turno.dibujaId };
    });
    // Después de la transacción: un aviso que falla no afecta al juego.
    this.vivo.olvidarTurno(r.salaId, r.turnoId);
    this.canal.cambio(r.salaId);
    this.notificaciones.avisar(r.avisarA, r.salaId, avisos.rendicion(yo.nombre, r.palabra, r.turnoId));
    return { turnoId: r.turnoId, palabra: r.palabra };
  }

  /**
   * Resumen de un turno adivinado o rendido: la palabra, el dibujo y los intentos. Es el único lugar,
   * junto con las respuestas del acierto y de rendirse, donde la palabra le llega a quien adivinaba.
   * Solo para las dos personas del turno, y solo si ya terminó así.
   */
  async resumen(yo: Jugador, turnoId: string): Promise<ResumenTurno> {
    const turno = await this.prisma.turno.findFirst({
      where: { id: turnoId, salaId: yo.salaId },
      include: { dibujo: true, _count: { select: { intentos: true, pistas: true } } },
    });
    if (!turno || (turno.dibujaId !== yo.id && turno.adivinaId !== yo.id)) throw turnoNoEncontrado();
    const terminado = turno.estado === 'adivinado' || turno.estado === 'rendido';
    if (!terminado || !turno.palabra || !turno.dibujo) throw resumenNoDisponible();
    return {
      turnoId: turno.id,
      resultado: turno.estado as 'adivinado' | 'rendido',
      numero: turno.numero,
      palabra: turno.palabra,
      intentos: turno._count.intentos,
      trazos: turno.dibujo.trazos as Stroke[],
      adivine: turno.adivinaId === yo.id,
      pistas: turno._count.pistas,
      racha: await this.rachaDe(turno.salaId),
    };
  }

  /**
   * Quien dibuja le manda una pista a quien adivina, mientras adivina. Sin límite.
   * No puede contener la palabra (ni con tildes, plural o un error chico): sería regalarla.
   */
  async mandarPista(yo: Jugador, turnoId: string, texto: string): Promise<PistaPublica[]> {
    const turno = await this.turnoQueDibujo(yo, turnoId, this.prisma);
    const enVivo = turno.estado === 'dibujando' && this.vivo.estaActiva(turno.salaId);
    if ((turno.estado !== 'adivinando' && !enVivo) || !turno.palabra) throw turnoCerrado('Las pistas se mandan mientras la otra persona adivina.');
    if (contieneLaPalabra(texto, turno.palabra)) throw datosInvalidos('La pista no puede tener la palabra.');
    await this.prisma.pista.create({ data: { turnoId: turno.id, autorId: yo.id, texto } });
    // Después de guardarla: un aviso que falla no afecta a la pista. En vivo no hace falta el aviso.
    this.canal.cambio(turno.salaId);
    if (!enVivo) this.notificaciones.avisar(turno.adivinaId, turno.salaId, avisos.pista(texto));
    return this.listarPistas(turno.id);
  }

  /** Las pistas del turno, de la más vieja a la más nueva. Para las dos personas del turno. */
  async pistasDe(yo: Jugador, turnoId: string): Promise<PistaPublica[]> {
    const turno = await this.prisma.turno.findFirst({ where: { id: turnoId, salaId: yo.salaId } });
    if (!turno) throw turnoNoEncontrado();
    return this.listarPistas(turno.id);
  }

  private async listarPistas(turnoId: string): Promise<PistaPublica[]> {
    // creadoEn lo pone la base, como en los intentos: solo sirve para ordenar.
    const pistas = await this.prisma.pista.findMany({ where: { turnoId }, orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }] });
    return pistas.map((p) => ({ id: p.id, texto: p.texto, creadoEn: p.creadoEn.toISOString() }));
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

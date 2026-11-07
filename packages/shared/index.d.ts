/**
 * Tipos compartidos entre apps/web y apps/api.
 * Este paquete solo tiene declaraciones: importalo siempre con `import type`.
 */

// ---------- Trazos ----------

/** Un punto del trazo. `x` e `y` van de 0 a 1; `t` son milisegundos desde el inicio del dibujo. */
export type StrokePoint = { x: number; y: number; t: number };

/** Un trazo. `width` es relativo al lado del lienzo cuadrado. */
export type Stroke = {
  color: string;
  width: number;
  points: StrokePoint[];
};

// ---------- Errores ----------

export type CodigoError =
  | 'datos_invalidos'
  | 'sala_no_encontrada'
  | 'sala_llena'
  | 'sesion_invalida';

/** Cuerpo de toda respuesta de error de la API. */
export type ErrorApi = { codigo: CodigoError; mensaje: string };

// ---------- Endpoints ----------

/** GET /health */
export type Health = { ok: true };

/** GET /api/salas/:invitacion. `invitadoPor` es el nombre de quien ya entró, si entró alguien. */
export type SalaPublica =
  | { llena: false; invitadoPor: string | null }
  | { llena: true };

export type JugadorPublico = { id: string; nombre: string; lugar: number };

/** POST /api/salas/:invitacion/jugadores */
export type EntrarBody = { nombre: string };
export type EntrarRespuesta = { token: string; jugador: JugadorPublico };

/** Lo que hace cada persona en el turno. */
export type RolTurno = 'dibuja' | 'adivina';

/** Estados de un turno en curso. `adivinado` y `salteado` son de turnos cerrados. */
export type EstadoTurnoActual = 'eligiendo' | 'dibujando' | 'adivinando';

export type TurnoActual = {
  id: string;
  numero: number;
  rol: RolTurno;
  estado: EstadoTurnoActual;
  /** Intentos de quien adivina en este turno. */
  intentos: number;
  /** Solo para quien dibuja, mientras elige o dibuja. */
  opciones?: string[];
  /** Solo para quien dibuja, una vez elegida. Quien adivina nunca la recibe acá. */
  palabra?: string;
};

/** Cómo terminó el turno anterior, para el texto de Inicio. */
export type TurnoAnterior = {
  resultado: 'adivinado' | 'salteado';
  /** true si quien pregunta era quien dibujaba. */
  dibuje: boolean;
};

/** GET /api/estado */
export type Estado = {
  yo: JugadorPublico;
  otro: JugadorPublico | null;
  /** Para compartir el link mientras falta la otra persona. */
  invitacion: string;
  /** null mientras falta la otra persona. */
  turno: TurnoActual | null;
  anterior: TurnoAnterior | null;
};

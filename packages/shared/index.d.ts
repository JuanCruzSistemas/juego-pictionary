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

/** GET /api/estado. En el paso 4 se suma el turno actual. */
export type Estado = {
  yo: JugadorPublico;
  otro: JugadorPublico | null;
  /** Para compartir el link mientras falta la otra persona. */
  invitacion: string;
};

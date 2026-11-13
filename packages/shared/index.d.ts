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
  | 'sesion_invalida'
  | 'turno_no_encontrado'
  | 'no_es_tu_turno'
  /** El turno ya no admite el cambio: por ejemplo, el dibujo ya se mandó. */
  | 'turno_cerrado'
  | 'sin_salteos'
  /** El dibujo todavía no se mandó. */
  | 'dibujo_no_disponible'
  /** El turno todavía no se adivinó: no hay resumen. */
  | 'resumen_no_disponible'
  /** Todavía no entró la otra persona: no hay a quién dejarle un dibujo. */
  | 'falta_la_otra_persona'
  /** No existe ese dibujo libre en la sala. */
  | 'libre_no_encontrado'
  /** No existe esa palabra propia en la sala. */
  | 'palabra_no_encontrada';

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

/** Estados de un turno en curso. `adivinado`, `salteado` y `rendido` son de turnos cerrados. */
export type EstadoTurnoActual = 'eligiendo' | 'dibujando' | 'adivinando';

export type TurnoActual = {
  id: string;
  numero: number;
  rol: RolTurno;
  estado: EstadoTurnoActual;
  /** Intentos de quien adivina en este turno. */
  intentos: number;
  /** Pistas que mandó quien dibuja en este turno. */
  pistas: number;
  /** Solo para quien dibuja, mientras elige o dibuja. */
  opciones?: string[];
  /** Solo para quien dibuja, una vez elegida. Quien adivina nunca la recibe acá. */
  palabra?: string;
};

/** Cómo terminó el turno anterior, para el texto de Inicio. */
export type TurnoAnterior = {
  resultado: 'adivinado' | 'salteado' | 'rendido';
  /** true si quien pregunta era quien dibujaba. */
  dibuje: boolean;
};

/** Salteos de quien pregunta. Cada uno vuelve 30 minutos después de usado. */
export type Salteos = {
  quedan: number;
  maximo: number;
  /** ISO 8601. Cuándo vuelve el próximo, o null si están todos. */
  proximoEn: string | null;
};

/** POST /api/turnos/:id/palabra: una de las opciones o una propia, no las dos. */
export type PalabraBody = { opcion: string } | { propia: string };

/** POST /api/turnos/:id/salteo */
export type SalteoRespuesta = { salteos: Salteos };

/** POST /api/turnos/:id/dibujo. La duración la calcula la API con el último `t`. */
export type EnviarDibujoBody = { trazos: Stroke[] };

/** `turno` es null si el turno ya se cerró (por ejemplo, un reintento después de que adivinaron). */
export type EnviarDibujoRespuesta = { turno: TurnoActual | null };

/** GET /api/turnos/:id/dibujo */
export type DibujoGuardado = { trazos: Stroke[]; duracionMs: number };

export type IntentoPublico = { id: string; texto: string; correcto: boolean; creadoEn: string };

/** GET y POST /api/turnos/:id/pistas. La lista va de la más vieja a la más nueva. */
export type PistaPublica = { id: string; texto: string; creadoEn: string };
export type PistaBody = { texto: string };

/** POST /api/turnos/:id/intentos */
export type IntentoBody = { texto: string };

/**
 * `repetido`: ya se había probado lo mismo (sin tildes ni mayúsculas) y no se guardó.
 * `palabra` solo viene si acertó. `intentos` va del más nuevo al más viejo.
 */
export type IntentoRespuesta = {
  resultado: 'correcto' | 'incorrecto' | 'repetido';
  intentos: IntentoPublico[];
  palabra?: string;
};

/** GET /api/turnos/:id/resumen: solo de un turno adivinado o rendido, para una de sus dos personas. */
export type ResumenTurno = {
  turnoId: string;
  /** `rendido`: quien adivinaba se rindió y vio la palabra. */
  resultado: 'adivinado' | 'rendido';
  numero: number;
  palabra: string;
  /** Intentos de quien adivinaba, contando el que acertó si acertó. */
  intentos: number;
  trazos: Stroke[];
  /** true si quien pide es quien adivinaba. */
  adivine: boolean;
  /** Pistas que mandó quien dibujó. */
  pistas: number;
  /** La racha de la sala en este momento. */
  racha: Racha;
};

/** POST /api/turnos/:id/rendirse: se revela la palabra y se crea el turno siguiente. */
export type RendirseRespuesta = { turnoId: string; palabra: string };

/** GET /api/push/clave. `clavePublica` es null si los avisos están apagados en el servidor. */
export type ClavePush = { clavePublica: string | null };

/** POST /api/push/suscripciones: lo que da PushSubscription.toJSON() en el navegador. */
export type SuscripcionBody = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};

/** DELETE /api/push/suscripciones */
export type DesuscripcionBody = { endpoint: string };

/** POST /api/libres: un dibujo sin nada que adivinar para la otra persona. */
export type DejarLibreBody = { trazos: Stroke[] };
export type DejarLibreRespuesta = { id: string };

/** GET /api/libres/:id. Al abrirlo quien lo recibió, queda visto. */
export type LibreGuardado = {
  id: string;
  /** Nombre de quien lo dibujó. */
  autor: string;
  /** true si lo dibujó quien pide. */
  mio: boolean;
  /** ISO 8601. */
  creadoEn: string;
  trazos: Stroke[];
  duracionMs: number;
};

/** El último dibujo libre que te dejaron y todavía no abriste. */
export type LibreNuevo = { id: string; creadoEn: string };

/** GET y POST /api/palabras: las palabras propias de la sala, de la más nueva a la más vieja. */
export type PalabraPropia = { id: string; texto: string };
export type PalabraNuevaBody = { texto: string };

/** Días seguidos en los que alguno de los dos adivinó un dibujo del otro, en hora de Argentina. */
export type Racha = {
  dias: number;
  /** true si hoy ya adivinaron: la racha está a salvo hasta mañana. */
  hoy: boolean;
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
  salteos: Salteos;
  /** El último dibujo libre sin abrir que te dejó la otra persona, o null. */
  libreNuevo: LibreNuevo | null;
  racha: Racha;
};

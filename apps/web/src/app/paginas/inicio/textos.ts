import type { Estado } from '@garabato/shared';

export type Tarjeta = {
  /** Etiqueta chica arriba del título. */
  etiqueta: string;
  titulo: string;
  texto: string;
  accion?: { texto: string; ruta: string };
  /** Muestra el link para compartir. */
  compartir?: boolean;
};

/** Qué tarjeta va en Inicio según el estado. Usa el nombre real de la otra persona en todos los textos. */
export function tarjetaDeInicio(e: Estado): Tarjeta {
  const otro = e.otro?.nombre;
  if (!otro) {
    return {
      etiqueta: 'Falta una persona',
      titulo: 'Esperando que entre',
      texto: 'Mandale este link a la otra persona. Cuando entre, arrancás dibujando vos.',
      compartir: true,
    };
  }

  // La API crea el turno 1 apenas están las dos personas; esto cubre el instante entre una cosa y otra.
  if (!e.turno) {
    return { etiqueta: 'Turno 1', titulo: 'Preparando el primer turno', texto: `Ya están vos y ${otro}. En un momento arrancan.` };
  }

  const { turno, anterior } = e;
  const etiqueta = `Turno ${turno.numero}`;

  if (turno.rol === 'dibuja') {
    if (turno.estado === 'adivinando') {
      return {
        etiqueta,
        titulo: `${otro} está adivinando`,
        texto: textoDeIntentos(turno.intentos),
        accion: { texto: 'Ver intentos y mandar pista', ruta: '/seguimiento' },
      };
    }
    return {
      etiqueta,
      titulo: 'Te toca dibujar',
      texto: !anterior
        ? `Arrancás vos. Elegí una palabra y dibujásela a ${otro}.`
        : anterior.resultado === 'salteado'
          ? `${otro} salteó su turno, así que te toca a vos.`
          : anterior.resultado === 'rendido'
            ? `Te rendiste con su último dibujo. Ahora le toca adivinar a ${otro}.`
            : `Adivinaste su último dibujo. Ahora le toca adivinar a ${otro}.`,
      accion:
        turno.estado === 'eligiendo'
          ? { texto: 'Elegir palabra', ruta: '/elegir' }
          : { texto: 'Seguir dibujando', ruta: '/dibujar' },
    };
  }

  if (turno.estado === 'adivinando') {
    return {
      etiqueta,
      titulo: 'Te toca adivinar',
      texto: `${otro} te dibujó algo. Fijate si sabés qué es.`,
      accion: { texto: 'Ver el dibujo', ruta: '/adivinar' },
    };
  }

  const despues = 'Cuando lo mande, te toca adivinar.';
  return {
    etiqueta,
    titulo: turno.estado === 'eligiendo' ? `${otro} está eligiendo qué dibujar` : `${otro} está dibujando`,
    texto: !anterior
      ? despues
      : anterior.resultado === 'salteado'
        ? `Salteaste tu turno. ${despues}`
        : anterior.resultado === 'rendido'
          ? `Se rindió con tu dibujo. ${despues}`
          : `Adivinó tu dibujo. ${despues}`,
  };
}

function textoDeIntentos(n: number): string {
  if (n === 0) return 'Todavía no probó ninguna palabra.';
  return n === 1 ? 'Lleva 1 intento.' : `Lleva ${n} intentos.`;
}

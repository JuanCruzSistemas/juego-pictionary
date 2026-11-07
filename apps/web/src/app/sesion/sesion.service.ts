import { Injectable, computed, signal } from '@angular/core';
import type { JugadorPublico } from '@garabato/shared';

/**
 * `invitacion` es la de la sala de esta sesión. Las sesiones guardadas antes de que existiera
 * no la tienen: EstadoService la completa con la primera respuesta de /api/estado.
 */
export type Sesion = { token: string; jugador: JugadorPublico; invitacion?: string };

const CLAVE = 'garabato.sesion';

/** Guarda la sesión en el dispositivo. Si localStorage no está disponible, dura lo que la pestaña. */
@Injectable({ providedIn: 'root' })
export class SesionService {
  private readonly sesion = signal<Sesion | null>(leer());

  readonly actual = this.sesion.asReadonly();
  readonly activa = computed(() => this.sesion() !== null);

  guardar(sesion: Sesion): void {
    this.sesion.set(sesion);
    try {
      localStorage.setItem(CLAVE, JSON.stringify(sesion));
    } catch {
      // Sin almacenamiento: la sesión queda en memoria.
    }
  }

  cerrar(): void {
    this.sesion.set(null);
    try {
      localStorage.removeItem(CLAVE);
    } catch {
      // Nada que borrar.
    }
  }
}

function leer(): Sesion | null {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const s = JSON.parse(crudo) as Partial<Sesion>;
    return typeof s.token === 'string' && s.jugador ? (s as Sesion) : null;
  } catch {
    return null;
  }
}

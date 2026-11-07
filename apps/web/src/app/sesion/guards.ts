import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { SesionService } from './sesion.service';

/** Sin sesión, a la pantalla que pide abrir el link. */
export const conSesion: CanActivateFn = () =>
  inject(SesionService).activa() || inject(Router).createUrlTree(['/entrar']);

/** Si ya hay sesión en este dispositivo, el link lleva directo al inicio. */
export const sinSesion: CanActivateFn = () =>
  !inject(SesionService).activa() || inject(Router).createUrlTree(['/']);

import type { Routes } from '@angular/router';
import { conSesion, sinSesion } from './sesion/guards';

export const routes: Routes = [
  {
    // Sin guard: Bienvenida decide según la sesión del dispositivo y la sala del link.
    path: 's/:invitacion',
    loadComponent: () => import('./paginas/bienvenida/bienvenida').then((m) => m.BienvenidaPage),
  },
  {
    path: 'entrar',
    canActivate: [sinSesion],
    loadComponent: () => import('./paginas/entrar/entrar').then((m) => m.EntrarPage),
  },
  {
    path: '',
    pathMatch: 'full',
    canActivate: [conSesion],
    loadComponent: () => import('./paginas/inicio/inicio').then((m) => m.InicioPage),
  },
  {
    path: 'elegir',
    canActivate: [conSesion],
    loadComponent: () => import('./paginas/elegir/elegir').then((m) => m.ElegirPage),
  },
  {
    path: 'dibujar',
    canActivate: [conSesion],
    loadComponent: () => import('./paginas/lienzo/lienzo').then((m) => m.LienzoPage),
  },
  { path: '**', redirectTo: '' },
];

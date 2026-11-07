import type { Routes } from '@angular/router';
import { conSesion, sinSesion } from './sesion/guards';

export const routes: Routes = [
  {
    path: 's/:invitacion',
    canActivate: [sinSesion],
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
  { path: '**', redirectTo: '' },
];

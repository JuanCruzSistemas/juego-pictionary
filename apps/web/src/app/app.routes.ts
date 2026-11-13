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
  {
    path: 'adivinar',
    canActivate: [conSesion],
    loadComponent: () => import('./paginas/adivinar/adivinar').then((m) => m.AdivinarPage),
  },
  {
    path: 'acierto/:turnoId',
    canActivate: [conSesion],
    loadComponent: () => import('./paginas/acierto/acierto').then((m) => m.AciertoPage),
  },
  {
    path: 'seguimiento',
    canActivate: [conSesion],
    loadComponent: () => import('./paginas/seguimiento/seguimiento').then((m) => m.SeguimientoPage),
  },
  {
    path: 'palabras',
    canActivate: [conSesion],
    loadComponent: () => import('./paginas/palabras/palabras').then((m) => m.PalabrasPage),
  },
  {
    path: 'historial',
    canActivate: [conSesion],
    loadComponent: () => import('./paginas/historial/historial').then((m) => m.HistorialPage),
  },
  {
    path: 'vivo',
    canActivate: [conSesion],
    loadComponent: () => import('./paginas/vivo/vivo').then((m) => m.VivoPage),
  },
  {
    path: 'libre',
    canActivate: [conSesion],
    loadComponent: () => import('./paginas/libre/libre').then((m) => m.LibrePage),
  },
  {
    path: 'recibido/:id',
    canActivate: [conSesion],
    loadComponent: () => import('./paginas/recibido/recibido').then((m) => m.RecibidoPage),
  },
  { path: '**', redirectTo: '' },
];

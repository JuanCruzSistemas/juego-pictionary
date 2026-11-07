import { Routes } from '@angular/router';

export const routes: Routes = [
  // Provisoria para el paso 1: se reemplaza por Inicio en el paso 4.
  { path: '', loadComponent: () => import('./paginas/muestra/muestra').then((m) => m.MuestraPage) },
  { path: '**', redirectTo: '' },
];

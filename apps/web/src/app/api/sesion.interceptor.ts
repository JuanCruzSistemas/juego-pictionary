import { inject } from '@angular/core';
import type { HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SesionService } from '../sesion/sesion.service';
import { EstadoService } from '../estado/estado.service';
import { errorDeApi } from './errores';

/** Suma el token a las llamadas a /api. Si la API no reconoce la sesión, la borra. */
export const sesionInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) return next(req);

  const sesion = inject(SesionService);
  const router = inject(Router);
  const estados = inject(EstadoService);
  const token = sesion.actual()?.token;
  const conToken = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(conToken).pipe(
    catchError((e: unknown) => {
      if (token && errorDeApi(e)?.codigo === 'sesion_invalida') {
        sesion.cerrar();
        estados.olvidar();
        void router.navigate(['/entrar']);
      }
      return throwError(() => e);
    }),
  );
};

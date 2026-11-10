import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AvisoConexion } from './comun/aviso-conexion';
import { AvisoVersion } from './pwa/aviso-version';
import { ActualizacionService } from './pwa/actualizacion.service';
import { InstalacionService } from './pwa/instalacion.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AvisoConexion, AvisoVersion],
  template: `
    <div class="avisos-arriba">
      <app-aviso-conexion />
      <app-aviso-version />
    </div>
    <router-outlet />
  `,
  styles: `
    /* Avisos fijos arriba, uno debajo del otro, sin tapar los botones de abajo de cada pantalla. */
    .avisos-arriba {
      position: fixed;
      top: max(8px, env(safe-area-inset-top));
      left: 0;
      right: 0;
      z-index: 200;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      pointer-events: none;
    }
  `,
})
export class App {
  constructor() {
    inject(ActualizacionService).iniciar();
    // Se crea ya: el evento para ofrecer la instalación llega una sola vez, al cargar.
    inject(InstalacionService);
  }
}

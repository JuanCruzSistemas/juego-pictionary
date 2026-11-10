import { Component, inject } from '@angular/core';
import { ConexionService } from '../api/conexion.service';

/** Aviso de arriba, en todas las pantallas, mientras el servidor despierta o no hay red. Lo ubica App. */
@Component({
  selector: 'app-aviso-conexion',
  template: `
    <div class="contenedor" aria-live="polite">
      @switch (conexion.aviso()) {
        @case ('despertando') {
          <p class="aviso" role="status"><span class="punto" aria-hidden="true"></span>Despertando el servidor…</p>
        }
        @case ('sin-red') {
          <p class="aviso" role="status">Sin conexión. Reintentamos cuando vuelva.</p>
        }
      }
    </div>
  `,
  styles: `
    .contenedor {
      display: flex;
      justify-content: center;
    }
    .aviso {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      background: var(--resaltador);
      border: 2px solid var(--birome);
      border-radius: 22px;
      box-shadow: var(--sombra-boton);
      font-size: 14px;
      font-weight: 700;
    }
    .punto {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--birome);
      animation: latido 1s ease-in-out infinite;
    }
    @keyframes latido {
      50% { opacity: 0.2; }
    }
    @media (prefers-reduced-motion: reduce) {
      .punto { animation: none; }
    }
  `,
})
export class AvisoConexion {
  protected readonly conexion = inject(ConexionService);
}

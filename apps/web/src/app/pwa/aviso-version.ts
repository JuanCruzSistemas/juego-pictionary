import { Component, inject } from '@angular/core';
import { ActualizacionService } from './actualizacion.service';

/** "Hay una versión nueva · Actualizar". Va arriba, para no tapar los botones de abajo. */
@Component({
  selector: 'app-aviso-version',
  template: `
    @if (act.rota()) {
      <div class="aviso" role="alert">
        <span>La app necesita recargarse</span>
        <button type="button" [disabled]="act.enCurso()" (click)="act.actualizar()">Recargar</button>
      </div>
    } @else if (act.hayVersionNueva()) {
      <div class="aviso" role="status">
        <span>Hay una versión nueva</span>
        <button type="button" [disabled]="act.enCurso()" (click)="act.actualizar()">
          {{ act.enCurso() ? 'Actualizando…' : 'Actualizar' }}
        </button>
      </div>
    }
  `,
  styles: `
    .aviso {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 6px 6px 16px;
      background: var(--birome);
      color: var(--hoja);
      border: 2px solid var(--birome);
      border-radius: 26px;
      box-shadow: var(--sombra-boton);
      font-size: 14px;
      font-weight: 700;
      pointer-events: auto;
    }
    button {
      min-height: 40px;
      padding: 0 16px;
      background: var(--resaltador);
      color: var(--birome);
      border: 2px solid var(--hoja);
      border-radius: 20px;
      font-family: var(--fuente-titulo);
      font-weight: 700;
      font-size: 15px;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.6;
    }
  `,
})
export class AvisoVersion {
  protected readonly act = inject(ActualizacionService);
}

import { Component } from '@angular/core';

/**
 * Con el celular acostado tapa la pantalla con "Girá el celu para dibujar".
 * Es solo CSS: lo que hay debajo (el lienzo, el dibujo) sigue ahí y vuelve al girar.
 * Solo aparece en pantallas bajas (celulares); en una tablet acostada el lienzo entra bien.
 * La orientación vertical fija va en el manifest de la PWA, en la etapa 3.
 */
@Component({
  selector: 'app-aviso-girar',
  template: `
    <div class="aviso" role="alert">
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" stroke="var(--birome)" stroke-width="3"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="22" y="8" width="28" height="48" rx="5"></rect>
        <path d="M32 50h8"></path>
        <path d="M60 30c0-10-6-18-15-21" stroke="var(--correccion)"></path>
        <path d="m41 5 4 4-4 4" stroke="var(--correccion)"></path>
      </svg>
      <p class="titulo">Girá el celu para dibujar</p>
    </div>
  `,
  styles: `
    :host {
      display: none;
    }
    @media (orientation: landscape) and (max-height: 500px) {
      :host {
        position: fixed;
        inset: 0;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background-color: var(--hoja);
        background-image:
          linear-gradient(var(--cuadricula) 1px, transparent 1px),
          linear-gradient(90deg, var(--cuadricula) 1px, transparent 1px);
        background-size: 24px 24px;
      }
    }
    .aviso {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      text-align: center;
    }
    .titulo {
      font-size: 28px;
    }
  `,
})
export class AvisoGirar {}

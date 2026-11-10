import { Component } from '@angular/core';

/** Las dos figuras con el corazón de Bienvenida.dc.html. */
@Component({
  selector: 'app-ilustracion-pareja',
  template: `
    <svg viewBox="0 0 342 220" fill="none" stroke="var(--birome)" stroke-width="5" stroke-linecap="round"
      stroke-linejoin="round" aria-hidden="true">
      <path d="M78 58c26-30 66-14 62 18-3 27-44 28-52 2"></path>
      <path d="M99 92c-2 42 4 70 8 98M100 118l-34 20M101 118l36 16M107 190l-24 18M107 190l26 18"></path>
      <path d="M202 58c26-30 66-14 62 18-3 27-44 28-52 2"></path>
      <path d="M238 92c2 42-4 70-8 98M238 118l34 20M237 118l-34 16M230 190l-24 18M230 190l26 18"></path>
      <path stroke="var(--correccion)" d="M171 96c-14-11-19-18-16-25 3-6 12-7 16 0 4-7 13-6 16 0 3 7-2 14-16 25Z"></path>
    </svg>
  `,
  styles: `
    /* Se achica si falta alto: el svg ocupa la altura que le quede y mantiene la proporción. */
    :host { display: flex; justify-content: center; min-height: 0; }
    svg { display: block; height: 100%; max-height: 220px; width: auto; max-width: 100%; aspect-ratio: 342 / 220; }
  `,
})
export class IlustracionPareja {}

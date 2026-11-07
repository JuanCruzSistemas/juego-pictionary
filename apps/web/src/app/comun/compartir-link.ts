import { Component, input, signal } from '@angular/core';

type Navegador = Navigator & { share?: Navigator['share']; clipboard?: Navigator['clipboard'] };

/**
 * Comparte un link con la hoja de compartir del sistema; si no está, con un botón de copiar.
 * Las dos APIs exigen HTTPS: por http en la red local no existen, y queda el link en un campo
 * de solo lectura. También aparece si compartir o copiar fallan.
 */
@Component({
  selector: 'app-compartir-link',
  template: `
    @if (puedeCompartir) {
      <button type="button" class="btn-principal" (click)="compartir()">Compartir link</button>
    } @else if (puedeCopiar) {
      <button type="button" class="btn-principal" (click)="copiar()">
        {{ copiado() ? '¡Copiado!' : 'Copiar link' }}
      </button>
    }
    @if (mostrarCampo()) {
      <div class="grupo">
        <label for="link-invitacion" class="etiqueta">Link para compartir</label>
        <input
          id="link-invitacion"
          class="campo"
          type="text"
          readonly
          [value]="url()"
          (focus)="$any($event.target).select()"
        />
        <p class="ayuda texto-suave">Mantené apretado el link para copiarlo.</p>
      </div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 12px; }
    .grupo { display: flex; flex-direction: column; gap: 8px; }
    .ayuda { font-size: 14px; }
  `,
})
export class CompartirLink {
  readonly url = input.required<string>();

  private readonly nav = navigator as Navegador;
  protected readonly puedeCompartir = typeof this.nav.share === 'function';
  protected readonly puedeCopiar = typeof this.nav.clipboard?.writeText === 'function';
  protected readonly mostrarCampo = signal(!this.puedeCompartir && !this.puedeCopiar);
  protected readonly copiado = signal(false);

  protected compartir(): void {
    this.nav
      .share!({ title: 'Garabato', text: 'Te invito a dibujar en Garabato.', url: this.url() })
      .catch((e: unknown) => {
        // Cerrar la hoja de compartir no es un error.
        if (!(e instanceof DOMException && e.name === 'AbortError')) this.mostrarCampo.set(true);
      });
  }

  protected copiar(): void {
    this.nav.clipboard!.writeText(this.url()).then(
      () => {
        this.copiado.set(true);
        setTimeout(() => this.copiado.set(false), 2000);
      },
      () => this.mostrarCampo.set(true),
    );
  }
}

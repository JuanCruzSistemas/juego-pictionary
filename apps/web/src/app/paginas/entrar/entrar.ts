import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IlustracionPareja } from '../../comun/ilustracion-pareja';
import { leerInvitacion } from './invitacion';

/**
 * Sin sesión y sin link. Pasa, por ejemplo, si se instala la app antes de entrar a una sala:
 * la app abre en "/" y no tiene el link. Se puede pegar el link de invitación acá.
 */
@Component({
  selector: 'app-entrar',
  imports: [IlustracionPareja],
  template: `
    <main class="pantalla">
      <p class="titulo logo"><span class="resaltado">Garabato</span></p>
      <app-ilustracion-pareja />
      <div class="encabezado">
        <h1 class="titulo">Abrí tu link para entrar</h1>
        <p class="cuerpo">
          Garabato se usa con el link de invitación que te pasaron. Abrilo desde este celular, o pegalo acá.
        </p>
      </div>

      <form class="formulario" novalidate (submit)="entrar($event)">
        <div class="campo-grupo">
          <label for="link" class="etiqueta">Link de invitación</label>
          <input
            id="link"
            type="url"
            class="campo"
            placeholder="https://…/s/…"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
            enterkeyhint="go"
            [value]="texto()"
            [attr.aria-invalid]="problema() ? true : null"
            [attr.aria-describedby]="problema() ? 'link-error' : null"
            (input)="escribir($any($event.target).value)"
          />
          @if (problema(); as p) {
            <p id="link-error" class="mensaje-error" role="alert">{{ p }}</p>
          }
        </div>
        <div class="acciones">
          <button type="submit" class="btn-principal">Entrar</button>
        </div>
      </form>
    </main>
  `,
  styleUrl: '../bienvenida/bienvenida.css',
})
export class EntrarPage {
  private readonly router = inject(Router);
  protected readonly texto = signal('');
  protected readonly problema = signal<string | null>(null);

  protected escribir(valor: string): void {
    this.texto.set(valor);
    this.problema.set(null);
  }

  /** Lleva a Bienvenida de esa sala, que muestra "Este link no anda" si la sala no existe. */
  protected entrar(evento: Event): void {
    evento.preventDefault();
    const r = leerInvitacion(this.texto());
    if ('problema' in r) {
      this.problema.set(r.problema);
      return;
    }
    void this.router.navigate(['/s', r.invitacion]);
  }
}

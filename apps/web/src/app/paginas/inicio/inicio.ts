import { Component, inject, signal } from '@angular/core';
import type { Estado } from '@garabato/shared';
import { ApiService } from '../../api/api.service';

/** Provisoria del paso 3: confirma la sesión. En el paso 4 pasa a ser Main con los estados del turno. */
@Component({
  selector: 'app-inicio',
  template: `
    <main class="pantalla">
      <h1 class="titulo logo"><span class="resaltado">Garabato</span></h1>
      <section class="tarjeta">
        @if (estado(); as e) {
          <p class="etiqueta texto-suave">Sesión iniciada</p>
          <h2 class="titulo subtitulo">Hola, {{ e.yo.nombre }}</h2>
          <p class="cuerpo">
            @if (e.otro) {
              También está {{ e.otro.nombre }}. Ya son dos.
            } @else {
              Falta que entre la otra persona.
            }
          </p>
        } @else if (error()) {
          <p class="cuerpo">No pudimos cargar la sala. Revisá tu conexión.</p>
          <button type="button" class="btn-principal" (click)="cargar()">Probar de nuevo</button>
        } @else {
          <p class="cuerpo texto-suave" role="status">Cargando…</p>
        }
      </section>
    </main>
  `,
  styles: `
    .pantalla { gap: 20px; padding: 24px 20px; }
    .logo { font-size: 30px; line-height: 1.1; }
    .subtitulo { font-size: 30px; }
    .cuerpo { font-size: 16px; line-height: 1.4; }
  `,
})
export class InicioPage {
  private readonly api = inject(ApiService);
  protected readonly estado = signal<Estado | null>(null);
  protected readonly error = signal(false);

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.error.set(false);
    this.api.estado().subscribe({
      next: (e) => this.estado.set(e),
      error: () => this.error.set(true),
    });
  }
}

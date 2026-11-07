import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Health } from '@garabato/shared';

type EstadoApi = 'probando' | 'ok' | 'error';

/** Pantalla provisoria del paso 1: muestra el sistema visual y verifica la conexión con la API. */
@Component({
  selector: 'app-muestra',
  templateUrl: './muestra.html',
  styleUrl: './muestra.css',
})
export class MuestraPage {
  private readonly http = inject(HttpClient);
  protected readonly api = signal<EstadoApi>('probando');

  constructor() {
    this.probar();
  }

  protected probar(): void {
    this.api.set('probando');
    this.http.get<Health>('/health').subscribe({
      next: (r) => this.api.set(r.ok ? 'ok' : 'error'),
      error: () => this.api.set('error'),
    });
  }
}

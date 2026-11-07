import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { Stroke } from '@garabato/shared';
import { ApiService } from '../../api/api.service';
import { EstadoService } from '../../estado/estado.service';
import { DibujoVista } from '../../dibujo/dibujo-vista';
import { AvisoGirar } from '../../comun/aviso-girar';

/**
 * Adivinar. Diseño: docs/diseno/Adivinar.dc.html.
 * Paso 7: muestra el dibujo. Los intentos llegan en el paso 8; la reproducción y las pistas, en la etapa 2.
 */
@Component({
  selector: 'app-adivinar',
  imports: [RouterLink, DibujoVista, AvisoGirar],
  templateUrl: './adivinar.html',
  styleUrl: './adivinar.css',
})
export class AdivinarPage {
  private readonly api = inject(ApiService);
  private readonly estados = inject(EstadoService);
  private readonly router = inject(Router);

  protected readonly trazos = signal<Stroke[] | null>(null);
  protected readonly error = signal(false);
  private turnoCargado: string | null = null;

  constructor() {
    this.estados.seguir(inject(DestroyRef));
    effect(() => {
      const e = this.estados.estado();
      if (!e) return;
      const t = e.turno;
      if (!t || t.rol !== 'adivina' || t.estado !== 'adivinando') {
        void this.router.navigate(['/'], { replaceUrl: true });
        return;
      }
      if (this.turnoCargado !== t.id) {
        this.turnoCargado = t.id;
        this.cargar(t.id);
      }
    });
  }

  protected reintentar(): void {
    if (this.turnoCargado) this.cargar(this.turnoCargado);
  }

  private cargar(turnoId: string): void {
    this.error.set(false);
    this.api.dibujo(turnoId).subscribe({
      next: (d) => this.trazos.set(d.trazos),
      error: () => this.error.set(true),
    });
  }
}

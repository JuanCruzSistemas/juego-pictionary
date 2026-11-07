import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { Stroke } from '@garabato/shared';
import { EstadoService } from '../../estado/estado.service';
import { DibujoService } from '../../dibujo/dibujo.service';
import { LienzoCanvas } from '../../dibujo/lienzo-canvas';
import { AvisoGirar } from '../../comun/aviso-girar';
import { COLOR_HOJA } from '../../dibujo/trazos';
import { COLORES, FACTOR_GOMA, GROSORES, type Grosor } from '../../dibujo/herramientas';

/** Cuánto espera el segundo toque de "Borrar todo". */
const ESPERA_CONFIRMACION_MS = 3000;

/**
 * Dibujar. Diseño: docs/diseno/Lienzo.dc.html.
 * En el paso 6 el dibujo queda en el dispositivo; el envío llega en el paso 7.
 */
@Component({
  selector: 'app-lienzo',
  imports: [RouterLink, LienzoCanvas, AvisoGirar],
  templateUrl: './lienzo.html',
  styleUrl: './lienzo.css',
})
export class LienzoPage {
  private readonly estados = inject(EstadoService);
  private readonly router = inject(Router);
  protected readonly dibujo = inject(DibujoService);

  protected readonly colores = COLORES;
  protected readonly grosores = Object.entries(GROSORES) as [Grosor, (typeof GROSORES)[Grosor]][];

  protected readonly palabra = computed(() => this.estados.estado()?.turno?.palabra ?? '');
  protected readonly color = signal<string>(COLORES[0].hex);
  protected readonly grosor = signal<Grosor>('medio');
  protected readonly goma = signal(false);
  protected readonly confirmandoBorrado = signal(false);
  protected readonly aviso = signal<string | null>(null);

  protected readonly colorDelTrazo = computed(() => (this.goma() ? COLOR_HOJA : this.color()));
  protected readonly anchoDelTrazo = computed(
    () => GROSORES[this.grosor()].valor * (this.goma() ? FACTOR_GOMA : 1),
  );

  private temporizadorBorrado: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.estados.seguir(inject(DestroyRef));
    inject(DestroyRef).onDestroy(() => this.cancelarBorrado());

    effect(() => {
      const t = this.estados.estado()?.turno;
      if (this.estados.estado() === null) return;
      // Solo quien dibuja, con la palabra ya elegida y antes de mandar el dibujo.
      if (!t || t.rol !== 'dibuja' || t.estado === 'adivinando') {
        void this.router.navigate(['/'], { replaceUrl: true });
      } else if (t.estado === 'eligiendo') {
        void this.router.navigate(['/elegir'], { replaceUrl: true });
      } else {
        this.dibujo.usarTurno(t.id);
      }
    });
  }

  protected elegirColor(hex: string): void {
    this.color.set(hex);
    this.goma.set(false);
  }

  protected elegirGrosor(g: Grosor): void {
    this.grosor.set(g);
  }

  protected alternarGoma(): void {
    this.goma.update((g) => !g);
  }

  protected trazoTerminado(trazo: Stroke): void {
    this.dibujo.agregar(trazo);
    this.aviso.set(null);
    this.cancelarBorrado();
  }

  protected deshacer(): void {
    this.dibujo.deshacer();
    this.cancelarBorrado();
  }

  /** Primer toque: pide confirmación. Segundo toque dentro de 3 s: borra todo. */
  protected borrarTodo(): void {
    if (this.dibujo.vacio()) return;
    if (this.confirmandoBorrado()) {
      this.dibujo.borrarTodo();
      this.cancelarBorrado();
      return;
    }
    this.confirmandoBorrado.set(true);
    this.temporizadorBorrado = setTimeout(() => this.confirmandoBorrado.set(false), ESPERA_CONFIRMACION_MS);
  }

  protected mandar(): void {
    this.cancelarBorrado();
    if (this.dibujo.vacio()) {
      this.aviso.set('Dibujá algo antes de mandarlo.');
      return;
    }
    // Paso 7: mandar this.dibujo.paraEnviar() a POST /api/turnos/:id/dibujo.
    this.aviso.set('El envío llega en el paso 7. Por ahora el dibujo queda en este celular.');
  }

  private cancelarBorrado(): void {
    if (this.temporizadorBorrado !== null) clearTimeout(this.temporizadorBorrado);
    this.temporizadorBorrado = null;
    this.confirmandoBorrado.set(false);
  }
}

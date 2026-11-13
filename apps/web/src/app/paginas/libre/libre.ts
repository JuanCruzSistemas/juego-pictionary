import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { Stroke } from '@garabato/shared';
import { ApiService } from '../../api/api.service';
import { errorDeApi, mensajeDeError } from '../../api/errores';
import { EstadoService } from '../../estado/estado.service';
import { DibujoLibreService, ID_LIBRE } from '../../dibujo/dibujo.service';
import { LienzoCanvas } from '../../dibujo/lienzo-canvas';
import { AvisoGirar } from '../../comun/aviso-girar';
import { COLOR_HOJA } from '../../dibujo/trazos';
import { COLORES, FACTOR_GOMA, GROSORES, type Grosor } from '../../dibujo/herramientas';

/** Cuánto espera el segundo toque de "Borrar todo". */
const ESPERA_CONFIRMACION_MS = 3000;

/**
 * Dibujo libre: un dibujo sin nada que adivinar para la otra persona.
 * Diseño: docs/diseno/Libre.dc.html. Las mismas herramientas que Lienzo, con su propio borrador.
 */
@Component({
  selector: 'app-libre',
  imports: [RouterLink, LienzoCanvas, AvisoGirar],
  templateUrl: './libre.html',
  styleUrl: '../lienzo/lienzo.css',
})
export class LibrePage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly estados = inject(EstadoService);
  protected readonly dibujo = inject(DibujoLibreService);

  protected readonly colores = COLORES;
  protected readonly grosores = Object.entries(GROSORES) as [Grosor, (typeof GROSORES)[Grosor]][];

  protected readonly color = signal<string>(COLORES[0].hex);
  protected readonly grosor = signal<Grosor>('medio');
  protected readonly goma = signal(false);
  protected readonly confirmandoBorrado = signal(false);
  protected readonly aviso = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly fallo = signal<string | null>(null);
  protected readonly otro = computed(() => this.estados.estado()?.otro?.nombre ?? null);

  protected readonly colorDelTrazo = computed(() => (this.goma() ? COLOR_HOJA : this.color()));
  protected readonly anchoDelTrazo = computed(() => GROSORES[this.grosor()].valor * (this.goma() ? FACTOR_GOMA : 1));

  private temporizadorBorrado: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.estados.seguir(inject(DestroyRef));
    inject(DestroyRef).onDestroy(() => this.cancelarBorrado());
    // Recupera el borrador si se cerró la app a mitad del dibujo.
    this.dibujo.usarTurno(ID_LIBRE);
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

  protected dejar(): void {
    this.cancelarBorrado();
    if (this.enviando()) return;
    if (this.dibujo.vacio()) {
      this.aviso.set('Dibujá algo antes de dejárselo.');
      return;
    }
    this.aviso.set(null);
    this.fallo.set(null);
    this.enviando.set(true);
    this.api.dejarLibre(this.dibujo.paraEnviar()).subscribe({
      next: () => {
        this.dibujo.borrarTodo();
        void this.router.navigate(['/'], { replaceUrl: true });
      },
      error: (e: unknown) => {
        // El dibujo sigue en pantalla y en el borrador.
        this.enviando.set(false);
        const err = errorDeApi(e);
        this.fallo.set(
          err?.codigo === 'falta_la_otra_persona'
            ? 'Todavía no entró la otra persona. Tu dibujo queda guardado acá.'
            : mensajeDeError(e, 'No se pudo mandar. Tu dibujo sigue acá: reintentá.'),
        );
      },
    });
  }

  private cancelarBorrado(): void {
    if (this.temporizadorBorrado !== null) clearTimeout(this.temporizadorBorrado);
    this.temporizadorBorrado = null;
    this.confirmandoBorrado.set(false);
  }
}

import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { Stroke } from '@garabato/shared';
import { ApiService } from '../../api/api.service';
import { errorDeApi, mensajeDeError, servidorNoRespondio } from '../../api/errores';
import { EstadoService } from '../../estado/estado.service';
import { DibujoService } from '../../dibujo/dibujo.service';
import { LienzoCanvas } from '../../dibujo/lienzo-canvas';
import { AvisoGirar } from '../../comun/aviso-girar';
import { COLOR_HOJA } from '../../dibujo/trazos';
import { COLORES, FACTOR_GOMA, GROSORES, type Grosor } from '../../dibujo/herramientas';

/** Cuánto espera el segundo toque de "Borrar todo". */
const ESPERA_CONFIRMACION_MS = 3000;

/** Dibujar. Diseño: docs/diseno/Lienzo.dc.html. */
@Component({
  selector: 'app-lienzo',
  imports: [RouterLink, LienzoCanvas, AvisoGirar],
  templateUrl: './lienzo.html',
  styleUrl: './lienzo.css',
})
export class LienzoPage {
  private readonly estados = inject(EstadoService);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  protected readonly dibujo = inject(DibujoService);

  protected readonly colores = COLORES;
  protected readonly grosores = Object.entries(GROSORES) as [Grosor, (typeof GROSORES)[Grosor]][];

  protected readonly palabra = computed(() => this.estados.estado()?.turno?.palabra ?? '');
  protected readonly color = signal<string>(COLORES[0].hex);
  protected readonly grosor = signal<Grosor>('medio');
  protected readonly goma = signal(false);
  protected readonly confirmandoBorrado = signal(false);
  protected readonly aviso = signal<string | null>(null);
  protected readonly enviando = signal(false);
  /** El envío falló por la red o el servidor: el dibujo sigue en pantalla y se puede reintentar. */
  protected readonly fallo = signal<string | null>(null);
  /** El turno ya no admite el envío (por ejemplo, se salteó en otro dispositivo). */
  protected readonly cerrado = signal<string | null>(null);

  protected readonly colorDelTrazo = computed(() => (this.goma() ? COLOR_HOJA : this.color()));
  protected readonly anchoDelTrazo = computed(
    () => GROSORES[this.grosor()].valor * (this.goma() ? FACTOR_GOMA : 1),
  );

  protected readonly errorDeCarga = computed(() => !this.estados.estado() && this.estados.error());
  protected readonly cargandoEstado = this.estados.cargando;

  private temporizadorBorrado: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.estados.seguir(inject(DestroyRef));
    inject(DestroyRef).onDestroy(() => this.cancelarBorrado());

    effect(() => {
      const t = this.estados.estado()?.turno;
      if (this.estados.estado() === null) return;
      // Solo quien dibuja, con la palabra ya elegida y antes de mandar el dibujo.
      if (this.enviando()) return;
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
    const turno = this.estados.estado()?.turno;
    if (this.enviando() || !turno) return;
    if (this.dibujo.vacio()) {
      this.aviso.set('Dibujá algo antes de mandarlo.');
      return;
    }

    this.aviso.set(null);
    this.fallo.set(null);
    this.enviando.set(true);
    this.api.enviarDibujo(turno.id, this.dibujo.paraEnviar()).subscribe({
      next: (r) => {
        if (r.turno) this.estados.aplicarTurno(r.turno);
        this.estados.actualizar();
        this.dibujo.borrarTodo();
        void this.router.navigate(['/'], { replaceUrl: true });
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        const err = errorDeApi(e);
        if (err?.codigo === 'turno_cerrado' || err?.codigo === 'no_es_tu_turno') {
          this.cerrado.set(err.mensaje);
        } else if (servidorNoRespondio(e)) {
          this.fallo.set(`No se pudo mandar. Tu dibujo sigue acá. ${mensajeDeError(e, '')}`);
        } else {
          this.fallo.set(mensajeDeError(e, 'No se pudo mandar. Tu dibujo sigue acá: reintentá.'));
        }
      },
    });
  }

  protected reintentarCarga(): void {
    this.estados.actualizar();
  }

  protected irAlInicio(): void {
    void this.router.navigate(['/'], { replaceUrl: true });
  }

  private cancelarBorrado(): void {
    if (this.temporizadorBorrado !== null) clearTimeout(this.temporizadorBorrado);
    this.temporizadorBorrado = null;
    this.confirmandoBorrado.set(false);
  }
}

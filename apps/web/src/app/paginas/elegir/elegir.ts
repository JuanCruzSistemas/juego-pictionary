import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { PalabraBody } from '@garabato/shared';
import { ApiService } from '../../api/api.service';
import { errorDeApi } from '../../api/errores';
import { EstadoService } from '../../estado/estado.service';
import { PALABRA_MAXIMA, problemaDeLaPalabra, textoDeSalteos } from './reglas';

/**
 * Elegir palabra. Diseño: docs/diseno/Elegir.dc.html.
 * "Ver nuestras palabras" queda oculto hasta la etapa 2.
 */
@Component({
  selector: 'app-elegir',
  imports: [RouterLink],
  templateUrl: './elegir.html',
  styleUrl: './elegir.css',
})
export class ElegirPage {
  private readonly api = inject(ApiService);
  private readonly estados = inject(EstadoService);
  private readonly router = inject(Router);

  protected readonly estado = this.estados.estado;
  protected readonly turno = computed(() => this.estado()?.turno ?? null);
  protected readonly otro = computed(() => this.estado()?.otro?.nombre ?? '');
  protected readonly salteos = computed(() => this.estado()?.salteos ?? null);
  protected readonly contador = computed(() => {
    const s = this.salteos();
    return s ? textoDeSalteos(s) : null;
  });

  protected readonly elegida = signal<string | null>(null);
  protected readonly propia = signal('');
  protected readonly problema = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly guardando = signal(false);
  protected readonly salteando = signal(false);
  protected readonly confirmando = signal(false);
  protected readonly ocupado = computed(() => this.guardando() || this.salteando());
  protected readonly maximo = PALABRA_MAXIMA;

  private inicializada = false;

  constructor() {
    this.estados.seguir(inject(DestroyRef));

    effect(() => {
      const e = this.estado();
      if (!e) return;
      const t = e.turno;
      // Solo quien dibuja, y antes de mandar el dibujo.
      if (!t || t.rol !== 'dibuja' || t.estado === 'adivinando') {
        if (!this.salteando()) void this.router.navigate(['/'], { replaceUrl: true });
        return;
      }
      // Si vuelve desde el lienzo, aparece la palabra que ya había elegido.
      if (!this.inicializada) {
        this.inicializada = true;
        if (t.palabra && t.opciones?.includes(t.palabra)) this.elegida.set(t.palabra);
        else if (t.palabra) this.propia.set(t.palabra);
      }
    });
  }

  protected elegir(opcion: string): void {
    this.elegida.set(opcion);
    this.propia.set('');
    this.problema.set(null);
  }

  protected escribir(valor: string): void {
    this.propia.set(valor);
    this.elegida.set(null);
    this.problema.set(null);
  }

  /** "Empezar a dibujar": guarda la palabra y va al lienzo. */
  protected empezar(): void {
    const t = this.turno();
    if (!t || this.ocupado()) return;
    this.error.set(null);

    let body: PalabraBody;
    const elegida = this.elegida();
    if (elegida) {
      body = { opcion: elegida };
    } else {
      // El teclado de Android suele dejar un espacio al final: se recorta antes de validar.
      const propia = this.propia().trim();
      if (!propia) {
        this.problema.set('Elegí una de las tres o escribí la tuya.');
        return;
      }
      const problema = problemaDeLaPalabra(propia);
      if (problema) {
        this.problema.set(problema);
        return;
      }
      body = { propia };
    }

    this.guardando.set(true);
    this.api.elegirPalabra(t.id, body).subscribe({
      next: (turno) => {
        // Sin esto, el lienzo vería el estado viejo ("eligiendo") y mandaría de vuelta acá.
        this.estados.aplicarTurno(turno);
        void this.router.navigate(['/dibujar']);
      },
      error: (e: unknown) => {
        this.guardando.set(false);
        const err = errorDeApi(e);
        if (err?.codigo === 'datos_invalidos') this.problema.set(err.mensaje);
        else this.error.set(err?.mensaje ?? 'No pudimos guardar la palabra. Revisá tu conexión.');
      },
    });
  }

  /** Primer toque: pide confirmación en la misma pantalla. */
  protected pedirSalteo(): void {
    if (this.ocupado() || (this.salteos()?.quedan ?? 0) === 0) return;
    this.error.set(null);
    this.confirmando.set(true);
  }

  protected cancelarSalteo(): void {
    this.confirmando.set(false);
  }

  /** Segundo toque. `salteando` bloquea los toques repetidos mientras viaja el pedido. */
  protected saltear(): void {
    const t = this.turno();
    if (!t || this.ocupado()) return;
    this.salteando.set(true);
    this.api.saltear(t.id).subscribe({
      next: () => {
        this.estados.actualizar();
        void this.router.navigate(['/'], { replaceUrl: true });
      },
      error: (e: unknown) => {
        this.salteando.set(false);
        this.confirmando.set(false);
        this.estados.actualizar();
        this.error.set(errorDeApi(e)?.mensaje ?? 'No pudimos saltear el turno. Revisá tu conexión.');
      },
    });
  }
}

import {
  Component,
  ElementRef,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  type AfterViewInit,
  type OnDestroy,
} from '@angular/core';
import type { Stroke } from '@garabato/shared';
import { ajustarCuadrado } from './cuadrado';
import { COLOR_HOJA, pintarTrazos } from './trazos';
import { duracion, tiemposDeReproduccion, trazosHasta } from './reproduccion';

/**
 * Muestra un dibujo terminado, sin poder tocarlo. Con `reproducir`, al cargarlo lo dibuja
 * trazo por trazo con su ritmo (las pausas largas se acortan) y `repetir()` lo vuelve a hacer. Usa el mismo tamaño, borde, suavizado,
 * grosor relativo y goma que LienzoCanvas, así el dibujo se ve igual en los dos celulares.
 */
@Component({
  selector: 'app-dibujo-vista',
  template: `
    <div class="marco" #marco>
      <canvas #lienzo role="img" [attr.aria-label]="descripcion()"></canvas>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }
    .marco {
      flex: none;
      overflow: hidden;
      background: var(--hoja);
      border: 2.5px solid var(--birome);
      border-radius: var(--radio-tarjeta);
    }
    canvas {
      display: block;
    }
  `,
})
export class DibujoVista implements AfterViewInit, OnDestroy {
  readonly trazos = input.required<readonly Stroke[]>();
  readonly descripcion = input('Dibujo');
  /** Reproducir el dibujo trazo por trazo al mostrarlo. */
  readonly reproducir = input(false);
  /** true mientras se reproduce. */
  readonly reproduciendo = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');
  private readonly marcoRef = viewChild.required<ElementRef<HTMLDivElement>>('marco');
  private lado = 0;
  private dpr = 1;
  private observador?: ResizeObserver;
  private readonly alCambiarVentana = () => this.ajustar();
  private cuadro: number | null = null;
  /** Lo que se ve en este momento: todo el dibujo, o lo reproducido hasta ahora. */
  private visibles: readonly Stroke[] = [];

  constructor() {
    effect(() => {
      const trazos = this.trazos();
      untracked(() => (this.reproducir() ? this.repetir() : this.mostrar(trazos)));
    });
  }

  /** Reproduce el dibujo desde el principio. Sin animaciones en el sistema, lo muestra entero. */
  repetir(): void {
    this.detener();
    const trazos = tiemposDeReproduccion(this.trazos());
    const total = duracion(trazos);
    const sinMovimiento = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (total === 0 || sinMovimiento) {
      this.mostrar(this.trazos());
      return;
    }
    this.reproduciendo.set(true);
    const inicio = performance.now();
    const paso = (ahora: number) => {
      const t = ahora - inicio;
      this.visibles = t >= total ? this.trazos() : trazosHasta(trazos, t);
      this.pintar(this.visibles);
      if (t >= total) {
        this.cuadro = null;
        this.reproduciendo.set(false);
      } else {
        this.cuadro = requestAnimationFrame(paso);
      }
    };
    this.visibles = [];
    this.pintar(this.visibles);
    this.cuadro = requestAnimationFrame(paso);
  }

  private mostrar(trazos: readonly Stroke[]): void {
    this.detener();
    this.visibles = trazos;
    this.pintar(trazos);
  }

  private detener(): void {
    if (this.cuadro !== null) cancelAnimationFrame(this.cuadro);
    this.cuadro = null;
    this.reproduciendo.set(false);
  }

  ngAfterViewInit(): void {
    this.observador = new ResizeObserver(() => this.ajustar());
    this.observador.observe(this.host.nativeElement);
    window.addEventListener('resize', this.alCambiarVentana);
    this.ajustar();
  }

  ngOnDestroy(): void {
    this.detener();
    this.observador?.disconnect();
    window.removeEventListener('resize', this.alCambiarVentana);
  }

  private ajustar(): void {
    ({ lado: this.lado, dpr: this.dpr } = ajustarCuadrado(
      this.host.nativeElement.getBoundingClientRect(),
      this.marcoRef().nativeElement,
      [this.canvasRef().nativeElement],
    ));
    this.pintar(this.visibles);
  }

  private pintar(trazos: readonly Stroke[]): void {
    const ctx = this.canvasRef().nativeElement.getContext('2d');
    if (!ctx || this.lado === 0) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = COLOR_HOJA;
    ctx.fillRect(0, 0, this.lado, this.lado);
    pintarTrazos(ctx, trazos, this.lado);
  }
}

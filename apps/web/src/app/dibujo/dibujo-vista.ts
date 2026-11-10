import {
  Component,
  ElementRef,
  effect,
  inject,
  input,
  untracked,
  viewChild,
  type AfterViewInit,
  type OnDestroy,
} from '@angular/core';
import type { Stroke } from '@garabato/shared';
import { ajustarCuadrado } from './cuadrado';
import { COLOR_HOJA, pintarTrazos } from './trazos';

/**
 * Muestra un dibujo terminado, sin poder tocarlo. Usa el mismo tamaño, borde, suavizado,
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

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');
  private readonly marcoRef = viewChild.required<ElementRef<HTMLDivElement>>('marco');
  private lado = 0;
  private dpr = 1;
  private observador?: ResizeObserver;
  private readonly alCambiarVentana = () => this.ajustar();

  constructor() {
    effect(() => {
      const trazos = this.trazos();
      untracked(() => this.pintar(trazos));
    });
  }

  ngAfterViewInit(): void {
    this.observador = new ResizeObserver(() => this.ajustar());
    this.observador.observe(this.host.nativeElement);
    window.addEventListener('resize', this.alCambiarVentana);
    this.ajustar();
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
    window.removeEventListener('resize', this.alCambiarVentana);
  }

  private ajustar(): void {
    ({ lado: this.lado, dpr: this.dpr } = ajustarCuadrado(
      this.host.nativeElement.getBoundingClientRect(),
      this.marcoRef().nativeElement,
      [this.canvasRef().nativeElement],
    ));
    this.pintar(this.trazos());
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

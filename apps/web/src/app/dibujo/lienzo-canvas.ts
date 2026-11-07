import {
  Component,
  ElementRef,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
  type AfterViewInit,
  type OnDestroy,
} from '@angular/core';
import type { Stroke } from '@garabato/shared';
import { BORDE_DEL_MARCO, ajustarCuadrado } from './cuadrado';
import { COLOR_HOJA, agregarPunto, cerrarTrazo, normalizarPunto, pintarTrazo, pintarTrazos } from './trazos';

/** Contactos más anchos que esto (en px CSS) se toman como palma. */
const ANCHO_DE_PALMA = 50;


type TrazoEnCurso = { pointerId: number; rect: DOMRect; trazo: Stroke };

/**
 * Lienzo para dibujar con el dedo. Cuadrado y centrado en el espacio que le dan, ajustado por
 * devicePixelRatio, y se vuelve a pintar si cambia el tamaño o la orientación.
 *
 * Los trazos terminados se pintan en un canvas aparte (`base`); en cada cuadro se copia la base
 * y encima se pinta solo el trazo en curso.
 */
@Component({
  selector: 'app-lienzo-canvas',
  template: `
    <div class="marco" #marco>
    <canvas
      #lienzo
      role="img"
      aria-label="Lienzo para dibujar"
      (pointerdown)="abajo($event)"
      (pointermove)="mover($event)"
      (pointerup)="arriba($event)"
      (pointercancel)="cancelar($event)"
      (lostpointercapture)="cancelar($event)"
      (contextmenu)="$event.preventDefault()"
    ></canvas>
    </div>
  `,
  styles: `
    :host {
      --borde-lienzo: 2.5px;
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
      border: var(--borde-lienzo) solid var(--birome);
      border-radius: var(--radio-tarjeta);
    }
    canvas {
      display: block;
      /* Sin scroll, zoom ni menú de mantener apretado mientras se dibuja. */
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
    }
  `,
})
export class LienzoCanvas implements AfterViewInit, OnDestroy {
  readonly trazos = input.required<readonly Stroke[]>();
  readonly color = input.required<string>();
  /** Grosor relativo al lado del lienzo. */
  readonly grosor = input.required<number>();
  /** Convierte el timeStamp de un evento en ms desde el primer punto del dibujo. */
  readonly tiempo = input.required<(timeStamp: number) => number>();
  /** Mientras se manda el dibujo, no se puede seguir dibujando. */
  readonly bloqueado = input(false);
  readonly terminado = output<Stroke>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');
  private readonly marcoRef = viewChild.required<ElementRef<HTMLDivElement>>('marco');
  private readonly base = document.createElement('canvas');

  /** Lado del área de dibujo en px CSS. El borde va en el marco, afuera del canvas. */
  private lado = 0;
  private dpr = 1;
  private enCurso: TrazoEnCurso | null = null;
  private cuadroPedido = false;
  private observador?: ResizeObserver;
  private readonly alCambiarVentana = () => this.ajustarTamano();

  constructor() {
    // Cada vez que cambia la lista (trazo nuevo, deshacer, borrar todo), se repinta la base.
    effect(() => {
      const trazos = this.trazos();
      untracked(() => this.repintarBase(trazos));
    });
  }

  ngAfterViewInit(): void {
    this.observador = new ResizeObserver(() => this.ajustarTamano());
    this.observador.observe(this.host.nativeElement);
    // Cambiar la densidad de pantalla (zoom, pasar a otro monitor) no siempre cambia el tamaño.
    window.addEventListener('resize', this.alCambiarVentana);
    this.ajustarTamano();
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
    window.removeEventListener('resize', this.alCambiarVentana);
  }

  // ---------- Entrada ----------

  protected abajo(e: PointerEvent): void {
    // Un solo dedo a la vez: si ya hay un trazo en curso, el segundo dedo o la palma se ignoran.
    if (this.bloqueado() || this.enCurso || !e.isPrimary || this.esPalma(e)) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();

    const canvas = this.canvasRef().nativeElement;
    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const p = normalizarPunto(e.clientX, e.clientY, rect, this.tiempo()(e.timeStamp));
    this.enCurso = {
      pointerId: e.pointerId,
      rect,
      trazo: { color: this.color(), width: this.grosor(), points: [p] },
    };
    this.pedirCuadro();
  }

  protected mover(e: PointerEvent): void {
    const c = this.enCurso;
    if (!c || e.pointerId !== c.pointerId) return;
    // Los eventos agrupados traen los puntos intermedios: sin ellos, las líneas rápidas salen quebradas.
    const eventos = e.getCoalescedEvents?.() ?? [];
    for (const ev of eventos.length > 0 ? eventos : [e]) {
      agregarPunto(c.trazo.points, normalizarPunto(ev.clientX, ev.clientY, c.rect, this.tiempo()(ev.timeStamp)));
    }
    this.pedirCuadro();
  }

  protected arriba(e: PointerEvent): void {
    const c = this.enCurso;
    if (!c || e.pointerId !== c.pointerId) return;
    cerrarTrazo(c.trazo.points, normalizarPunto(e.clientX, e.clientY, c.rect, this.tiempo()(e.timeStamp)));
    this.terminar();
  }

  /** Si el sistema corta el gesto, se guarda lo dibujado hasta ahí. */
  protected cancelar(e: PointerEvent): void {
    if (this.enCurso && e.pointerId === this.enCurso.pointerId) this.terminar();
  }

  private terminar(): void {
    const c = this.enCurso!;
    this.enCurso = null;
    this.terminado.emit(c.trazo);
    this.pedirCuadro();
  }

  private esPalma(e: PointerEvent): boolean {
    return e.pointerType === 'touch' && Math.max(e.width, e.height) > ANCHO_DE_PALMA;
  }

  // ---------- Tamaño y pintado ----------

  private ajustarTamano(): void {
    const disponible = this.host.nativeElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const lado = Math.max(0, Math.floor(Math.min(disponible.width, disponible.height) - 2 * BORDE_DEL_MARCO));
    if (lado === this.lado && dpr === this.dpr) return;
    ({ lado: this.lado, dpr: this.dpr } = ajustarCuadrado(
      disponible,
      this.marcoRef().nativeElement,
      [this.canvasRef().nativeElement, this.base],
      dpr,
    ));
    this.repintarBase(this.trazos());
  }

  private repintarBase(trazos: readonly Stroke[]): void {
    const ctx = this.base.getContext('2d');
    if (!ctx || this.lado === 0) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = COLOR_HOJA;
    ctx.fillRect(0, 0, this.lado, this.lado);
    pintarTrazos(ctx, trazos, this.lado);
    this.pedirCuadro();
  }

  private pedirCuadro(): void {
    if (this.cuadroPedido) return;
    this.cuadroPedido = true;
    requestAnimationFrame(() => {
      this.cuadroPedido = false;
      this.pintarCuadro();
    });
  }

  private pintarCuadro(): void {
    const ctx = this.canvasRef().nativeElement.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.base, 0, 0);
    if (this.enCurso) {
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      pintarTrazo(ctx, this.enCurso.trazo, this.lado);
    }
  }
}

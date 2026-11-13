import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { IntentoPublico, PistaPublica, Stroke, TurnoActual } from '@garabato/shared';
import { ApiService } from '../../api/api.service';
import { errorDeApi, mensajeDeError } from '../../api/errores';
import { EstadoService } from '../../estado/estado.service';
import { VivoService } from '../../vivo/vivo.service';
import { DibujoService } from '../../dibujo/dibujo.service';
import { LienzoCanvas } from '../../dibujo/lienzo-canvas';
import { DibujoVista } from '../../dibujo/dibujo-vista';
import { AvisoGirar } from '../../comun/aviso-girar';
import { COLOR_HOJA } from '../../dibujo/trazos';
import { COLORES, FACTOR_GOMA, GROSORES, type Grosor } from '../../dibujo/herramientas';
import { normalizar } from '../../comun/texto';

/** Cuánto se muestra el resultado de una ronda antes de seguir con la próxima. */
const MOSTRAR_RESULTADO_MS = 2500;

type Vista = 'conectando' | 'sin-partida' | 'esperando' | 'pausada' | 'elegir' | 'dibujar' | 'espera-palabra' | 'adivinar' | 'turno-normal';

/**
 * Modo en vivo. Diseño: docs/diseno/VivoEspera.dc.html, VivoDibuja.dc.html y VivoAdivina.dc.html.
 * Una sola pantalla para toda la partida: estar en ella es estar conectado. Los turnos son los
 * de siempre; quien dibuja manda cada trazo mientras lo hace y la otra persona lo ve y adivina.
 * Si la partida termina (o se corta), el turno sigue por turnos: el dibujo queda como borrador.
 */
@Component({
  selector: 'app-vivo',
  imports: [RouterLink, LienzoCanvas, DibujoVista, AvisoGirar],
  templateUrl: './vivo.html',
  styleUrl: './vivo.css',
})
export class VivoPage {
  private readonly api = inject(ApiService);
  private readonly estados = inject(EstadoService);
  private readonly router = inject(Router);
  protected readonly vivoSrv = inject(VivoService);
  protected readonly dibujo = inject(DibujoService);

  /** ?invitar=1: viene del botón "Jugar en vivo" de Inicio. */
  readonly invitar = input<string>();

  protected readonly estado = this.estados.estado;
  protected readonly vivo = this.vivoSrv.vivo;
  protected readonly turno = computed(() => this.estado()?.turno ?? null);
  protected readonly yo = computed(() => this.estado()?.yo.id ?? null);
  protected readonly otro = computed(() => this.estado()?.otro?.nombre ?? 'La otra persona');
  protected readonly salteos = computed(() => this.estado()?.salteos ?? null);

  protected readonly vista = computed<Vista>(() => {
    const v = this.vivo();
    const t = this.turno();
    if (!this.vivoSrv.listo() || !this.estado()) return 'conectando';
    if (!v) return 'sin-partida';
    if (v.estado === 'esperando') return 'esperando';
    if (v.estado === 'pausada') return 'pausada';
    if (!t || t.estado === 'adivinando') return 'turno-normal';
    if (t.rol === 'dibuja') return t.estado === 'eligiendo' ? 'elegir' : 'dibujar';
    return t.estado === 'eligiendo' ? 'espera-palabra' : 'adivinar';
  });
  /** Quién dibuja primero, para el texto de la espera. */
  protected readonly quienDibuja = computed(() => (this.turno()?.rol === 'dibuja' ? 'Vos dibujás primero.' : `${this.otro()} dibuja primero.`));

  // ---------- Dibujar ----------
  protected readonly colores = COLORES;
  protected readonly grosores = Object.entries(GROSORES) as [Grosor, (typeof GROSORES)[Grosor]][];
  protected readonly color = signal<string>(COLORES[0].hex);
  protected readonly grosor = signal<Grosor>('medio');
  protected readonly goma = signal(false);
  protected readonly colorDelTrazo = computed(() => (this.goma() ? COLOR_HOJA : this.color()));
  protected readonly anchoDelTrazo = computed(() => GROSORES[this.grosor()].valor * (this.goma() ? FACTOR_GOMA : 1));
  protected readonly escribiendoPista = signal(false);
  protected readonly pista = signal('');

  // ---------- Adivinar ----------
  protected readonly trazosRemotos = computed(() => {
    const t = this.turno();
    return t && this.vivoSrv.trazosDelTurno() === t.id ? this.vivoSrv.trazos() : [];
  });
  protected readonly intentos = signal<IntentoPublico[]>([]);
  protected readonly fallidos = computed(() => this.intentos().filter((i) => !i.correcto));
  protected readonly pistas = signal<PistaPublica[]>([]);
  protected readonly ultimaPista = computed(() => this.pistas().at(-1) ?? null);
  protected readonly respuesta = signal('');
  protected readonly confirmandoRendirse = signal(false);

  protected readonly ocupado = signal(false);
  protected readonly mensaje = signal<string | null>(null);
  protected readonly confirmandoSalteo = signal(false);
  /** El resultado de la ronda que terminó, un momento antes de seguir. */
  protected readonly resultado = signal<{ titulo: string; texto: string } | null>(null);

  private turnoVisto: TurnoActual | null = null;
  /** La palabra del turno en curso, si se conoce: quien dibuja la sabe; quien adivina, al acertar. */
  private palabraDelTurno: string | null = null;
  /** El trazo que se está mandando: en qué posición va y cuántos puntos ya salieron. */
  private enviado: { indice: number; puntos: number } | null = null;
  private trazoPendiente: Stroke | null = null;
  private cuadro: number | null = null;
  private yaInvito = false;
  private temporizadorResultado: ReturnType<typeof setTimeout> | null = null;
  /** Para mandar el dibujo entero una sola vez por conexión y turno. */
  private sincronizado: string | null = null;

  constructor() {
    const destroy = inject(DestroyRef);
    this.estados.seguir(destroy);
    this.vivoSrv.conectar();
    destroy.onDestroy(() => {
      this.vivoSrv.desconectar();
      if (this.cuadro !== null) cancelAnimationFrame(this.cuadro);
      if (this.temporizadorResultado) clearTimeout(this.temporizadorResultado);
    });

    // Desde "Jugar en vivo": invitar apenas esté la conexión, si todavía no hay partida.
    effect(() => {
      if (this.invitar() !== '1' || this.yaInvito || !this.vivoSrv.listo()) return;
      this.yaInvito = true;
      if (!this.vivo()) untracked(() => this.vivoSrv.invitar());
    });

    // Cambio de turno: mostrar cómo terminó la ronda y preparar la próxima.
    effect(() => {
      const t = this.turno();
      const e = this.estado();
      if (!e) return;
      untracked(() => this.alCambiarElTurno(t, e.anterior?.resultado ?? null, e.anterior?.dibuje ?? false));
    });

    // Quien dibuja: con la partida activa, manda el dibujo entero al conectarse (o reconectarse).
    effect(() => {
      const listo = this.vivoSrv.listo();
      const activa = this.vivo()?.estado === 'activa';
      const t = this.turno();
      if (!listo) this.sincronizado = null;
      if (!listo || !activa || !t || t.rol !== 'dibuja' || t.estado !== 'dibujando') return;
      untracked(() => {
        this.dibujo.usarTurno(t.id);
        if (this.sincronizado === t.id) return;
        this.sincronizado = t.id;
        this.vivoSrv.enviarTodos(t.id, this.dibujo.trazos());
      });
    });
  }

  // ---------- Partida ----------

  protected invitarAhora(): void {
    this.vivoSrv.invitar();
  }

  protected terminar(): void {
    this.vivoSrv.terminar();
    void this.router.navigate(['/'], { replaceUrl: true });
  }

  // ---------- Elegir ----------

  protected elegir(opcion: string): void {
    const t = this.turno();
    if (!t || this.ocupado()) return;
    this.ocupado.set(true);
    this.api.elegirPalabra(t.id, { opcion }).subscribe({
      next: (turno) => {
        this.ocupado.set(false);
        this.estados.aplicarTurno(turno);
      },
      error: (e: unknown) => this.fallo(e),
    });
  }

  /** Primer toque: pide confirmación. Segundo: saltea. */
  protected saltear(): void {
    const t = this.turno();
    if (!t || this.ocupado()) return;
    if (!this.confirmandoSalteo()) {
      this.confirmandoSalteo.set(true);
      return;
    }
    this.ocupado.set(true);
    this.api.saltear(t.id).subscribe({
      next: () => {
        this.ocupado.set(false);
        this.confirmandoSalteo.set(false);
        this.dibujo.borrarTodo();
        this.estados.actualizar();
      },
      error: (e: unknown) => {
        this.confirmandoSalteo.set(false);
        this.fallo(e);
      },
    });
  }

  protected noSaltear(): void {
    this.confirmandoSalteo.set(false);
  }

  // ---------- Dibujar ----------

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

  /** Cada punto nuevo del trazo en curso: se manda una vez por cuadro de pantalla. */
  protected avance(trazo: Stroke): void {
    this.trazoPendiente = trazo;
    if (this.cuadro === null) this.cuadro = requestAnimationFrame(() => this.mandarAvance());
  }

  protected trazoTerminado(trazo: Stroke): void {
    this.trazoPendiente = trazo;
    this.mandarAvance();
    this.dibujo.agregar(trazo);
    this.enviado = null;
  }

  protected deshacer(): void {
    const t = this.turno();
    if (!t) return;
    this.dibujo.deshacer();
    this.vivoSrv.enviarTodos(t.id, this.dibujo.trazos());
  }

  protected alternarPista(): void {
    this.escribiendoPista.update((p) => !p);
    this.mensaje.set(null);
  }

  protected mandarPista(evento: Event): void {
    evento.preventDefault();
    const t = this.turno();
    const texto = this.pista().trim();
    if (!t || !normalizar(texto) || this.ocupado()) return;
    this.ocupado.set(true);
    this.api.mandarPista(t.id, texto).subscribe({
      next: (p) => {
        this.ocupado.set(false);
        this.pistas.set(p);
        this.pista.set('');
        this.escribiendoPista.set(false);
      },
      error: (e: unknown) => this.fallo(e),
    });
  }

  private mandarAvance(): void {
    if (this.cuadro !== null) cancelAnimationFrame(this.cuadro);
    this.cuadro = null;
    const t = this.turno();
    const trazo = this.trazoPendiente;
    this.trazoPendiente = null;
    if (!t || !trazo || this.vivo()?.estado !== 'activa') return;
    const indice = this.dibujo.trazos().length;
    if (this.enviado?.indice !== indice) {
      this.vivoSrv.enviarInicio(t.id, indice, { ...trazo, points: [...trazo.points] });
      this.enviado = { indice, puntos: trazo.points.length };
    } else if (trazo.points.length > this.enviado.puntos) {
      this.vivoSrv.enviarPuntos(t.id, indice, trazo.points.slice(this.enviado.puntos));
      this.enviado.puntos = trazo.points.length;
    }
  }

  // ---------- Adivinar ----------

  protected escribir(valor: string): void {
    this.respuesta.set(valor);
    this.mensaje.set(null);
  }

  protected probar(evento: Event): void {
    evento.preventDefault();
    const t = this.turno();
    const texto = this.respuesta().trim();
    if (!t || !normalizar(texto) || this.ocupado()) return;
    if (this.intentos().some((i) => normalizar(i.texto) === normalizar(texto))) {
      this.mensaje.set('Ya probaste esa');
      return;
    }
    this.ocupado.set(true);
    this.api.probar(t.id, texto).subscribe({
      next: (r) => {
        this.ocupado.set(false);
        this.intentos.set(r.intentos);
        this.respuesta.set('');
        if (r.resultado === 'correcto') {
          this.palabraDelTurno = r.palabra ?? null;
          this.estados.actualizar();
        } else if (r.resultado === 'repetido') {
          this.mensaje.set('Ya probaste esa');
        }
      },
      error: (e: unknown) => this.fallo(e),
    });
  }

  protected meRindo(): void {
    const t = this.turno();
    if (!t || this.ocupado()) return;
    if (!this.confirmandoRendirse()) {
      this.confirmandoRendirse.set(true);
      return;
    }
    this.ocupado.set(true);
    this.api.rendirse(t.id).subscribe({
      next: (r) => {
        this.ocupado.set(false);
        this.confirmandoRendirse.set(false);
        this.palabraDelTurno = r.palabra;
        this.estados.actualizar();
      },
      error: (e: unknown) => {
        this.confirmandoRendirse.set(false);
        this.fallo(e);
      },
    });
  }

  protected noMeRindo(): void {
    this.confirmandoRendirse.set(false);
  }

  // ---------- Turnos ----------

  private alCambiarElTurno(t: TurnoActual | null, resultado: 'adivinado' | 'salteado' | 'rendido' | null, dibuje: boolean): void {
    const antes = this.turnoVisto;
    this.turnoVisto = t;
    if (t?.palabra) this.palabraDelTurno = t.palabra;
    if (!t) return;

    if (antes && antes.id !== t.id) {
      // Terminó una ronda: el resultado un momento, y todo limpio para la próxima.
      this.mostrarResultado(resultado, dibuje);
      this.intentos.set([]);
      this.pistas.set([]);
      this.mensaje.set(null);
      this.respuesta.set('');
      this.escribiendoPista.set(false);
      this.confirmandoRendirse.set(false);
      this.confirmandoSalteo.set(false);
      this.enviado = null;
      this.dibujo.descartarSiNoEs(t.rol === 'dibuja' ? t.id : null);
      this.palabraDelTurno = t.palabra ?? null;
    }
    // Intentos y pistas: se vuelven a pedir cuando cambia la cantidad.
    if (t.estado !== 'eligiendo' && (!antes || antes.id !== t.id || antes.intentos !== t.intentos)) {
      this.api.intentos(t.id).subscribe({ next: (i) => this.intentos.set(i), error: () => undefined });
    }
    if (t.estado !== 'eligiendo' && (!antes || antes.id !== t.id || antes.pistas !== t.pistas)) {
      this.api.pistas(t.id).subscribe({ next: (p) => this.pistas.set(p), error: () => undefined });
    }
  }

  private mostrarResultado(resultado: 'adivinado' | 'salteado' | 'rendido' | null, dibuje: boolean): void {
    const otro = this.otro();
    const era = this.palabraDelTurno ? `Era ${this.palabraDelTurno}.` : '';
    const textos = {
      adivinado: dibuje ? { titulo: `¡${otro} lo adivinó!`, texto: era } : { titulo: '¡Adivinaste!', texto: era },
      rendido: dibuje ? { titulo: `${otro} se rindió`, texto: era } : { titulo: 'Te rendiste', texto: era },
      salteado: dibuje ? { titulo: 'Salteaste', texto: `Ahora dibuja ${otro}.` } : { titulo: `${otro} salteó`, texto: 'Te toca dibujar.' },
    };
    if (!resultado) return;
    this.resultado.set(textos[resultado]);
    if (this.temporizadorResultado) clearTimeout(this.temporizadorResultado);
    this.temporizadorResultado = setTimeout(() => this.resultado.set(null), MOSTRAR_RESULTADO_MS);
  }

  private fallo(e: unknown): void {
    this.ocupado.set(false);
    const err = errorDeApi(e);
    if (err?.codigo === 'turno_cerrado') this.estados.actualizar();
    this.mensaje.set(err?.mensaje ?? mensajeDeError(e, 'No se pudo. Probá de nuevo.'));
  }
}

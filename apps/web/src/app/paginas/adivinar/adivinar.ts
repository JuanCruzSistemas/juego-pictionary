import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { IntentoPublico, PistaPublica, Stroke } from '@garabato/shared';
import { ApiService } from '../../api/api.service';
import { errorDeApi, mensajeDeError } from '../../api/errores';
import { EstadoService } from '../../estado/estado.service';
import { DibujoVista } from '../../dibujo/dibujo-vista';
import { AvisoGirar } from '../../comun/aviso-girar';
import { normalizar } from '../../comun/texto';

/**
 * Adivinar. Diseño: docs/diseno/Adivinar.dc.html.
 * Muestra las pistas que manda quien dibujó, la más nueva arriba.
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
  protected readonly errorDeCarga = signal(false);
  protected readonly cargandoDibujo = signal(false);
  protected readonly errorDeIntentos = signal(false);
  /** El estado nunca llegó: sin esto la pantalla quedaría en "Cargando…" para siempre. */
  protected readonly errorDeEstado = computed(() => !this.estados.estado() && this.estados.error());
  protected readonly cargandoEstado = this.estados.cargando;
  protected readonly intentos = signal<IntentoPublico[]>([]);
  protected readonly fallidos = computed(() => this.intentos().filter((i) => !i.correcto));
  protected readonly pistas = signal<PistaPublica[]>([]);
  /** La más nueva arriba. */
  protected readonly pistasRecientes = computed(() => [...this.pistas()].reverse());
  protected readonly texto = signal('');
  protected readonly enviando = signal(false);
  protected readonly mensaje = signal<string | null>(null);
  /** "Me rindo" pide un segundo toque antes de revelar la palabra. */
  protected readonly confirmandoRendirse = signal(false);
  protected readonly rindiendose = signal(false);
  /** Campo vacío o solo signos: no se manda. */
  protected readonly sePuedeMandar = computed(() => normalizar(this.texto()).length > 0 && !this.enviando());

  private turnoId: string | null = null;
  private acerto = false;

  constructor() {
    this.estados.seguir(inject(DestroyRef));
    effect(() => {
      const e = this.estados.estado();
      if (!e || this.acerto) return;
      const t = e.turno;
      if (!t || t.rol !== 'adivina' || t.estado !== 'adivinando') {
        void this.router.navigate(['/'], { replaceUrl: true });
        return;
      }
      if (this.turnoId !== t.id) {
        this.turnoId = t.id;
        this.cargar(t.id);
      } else if (t.pistas > this.pistas().length) {
        // Llegó una pista nueva: el estado se actualiza cada 5 s.
        this.cargarPistas(t.id);
      }
    });
  }

  protected escribir(valor: string): void {
    this.texto.set(valor);
    this.mensaje.set(null);
  }

  protected probar(evento: Event): void {
    evento.preventDefault();
    const turnoId = this.turnoId;
    const texto = this.texto().trim();
    if (!turnoId || !this.sePuedeMandar()) return;

    if (this.intentos().some((i) => normalizar(i.texto) === normalizar(texto))) {
      this.mensaje.set('Ya probaste esa');
      return;
    }

    this.enviando.set(true);
    this.mensaje.set(null);
    this.api.probar(turnoId, texto).subscribe({
      next: (r) => {
        this.enviando.set(false);
        this.intentos.set(r.intentos);
        if (r.resultado === 'correcto') {
          this.acerto = true;
          this.estados.actualizar();
          void this.router.navigate(['/acierto', turnoId], { replaceUrl: true });
          return;
        }
        this.texto.set('');
        if (r.resultado === 'repetido') this.mensaje.set('Ya probaste esa');
      },
      error: (e: unknown) => {
        // El texto queda en el campo para reintentar.
        this.enviando.set(false);
        const err = errorDeApi(e);
        if (err?.codigo === 'turno_cerrado') {
          this.estados.actualizar();
          this.mensaje.set(err.mensaje);
        } else {
          this.mensaje.set(mensajeDeError(e, 'No se pudo mandar. Probá de nuevo.'));
        }
      },
    });
  }

  /** Primer toque: pide confirmación. Segundo toque: se rinde y va al resumen del turno. */
  protected meRindo(): void {
    const turnoId = this.turnoId;
    if (!turnoId || this.rindiendose() || this.enviando()) return;
    if (!this.confirmandoRendirse()) {
      this.confirmandoRendirse.set(true);
      return;
    }
    this.rindiendose.set(true);
    this.mensaje.set(null);
    this.api.rendirse(turnoId).subscribe({
      next: () => {
        // Como al acertar: la pantalla deja de seguir el estado, que ya pasó al turno siguiente.
        this.acerto = true;
        this.estados.actualizar();
        void this.router.navigate(['/acierto', turnoId], { replaceUrl: true });
      },
      error: (e: unknown) => {
        this.rindiendose.set(false);
        this.confirmandoRendirse.set(false);
        const err = errorDeApi(e);
        if (err?.codigo === 'turno_cerrado') this.estados.actualizar();
        this.mensaje.set(err?.codigo === 'turno_cerrado' ? err.mensaje : mensajeDeError(e, 'No se pudo. Probá de nuevo.'));
      },
    });
  }

  protected noMeRindo(): void {
    this.confirmandoRendirse.set(false);
  }

  protected reintentarCarga(): void {
    if (this.turnoId) this.cargar(this.turnoId);
    else this.estados.actualizar();
  }

  private cargar(turnoId: string): void {
    this.errorDeCarga.set(false);
    this.errorDeIntentos.set(false);
    this.cargandoDibujo.set(true);
    this.api.dibujo(turnoId).subscribe({
      next: (d) => {
        this.trazos.set(d.trazos);
        this.cargandoDibujo.set(false);
      },
      error: () => {
        this.errorDeCarga.set(true);
        this.cargandoDibujo.set(false);
      },
    });
    this.api.intentos(turnoId).subscribe({
      next: (i) => this.intentos.set(i),
      error: () => this.errorDeIntentos.set(true),
    });
    this.cargarPistas(turnoId);
  }

  private cargarPistas(turnoId: string): void {
    // Si falla, se vuelve a intentar con la próxima actualización del estado.
    this.api.pistas(turnoId).subscribe({ next: (p) => this.pistas.set(p), error: () => undefined });
  }
}

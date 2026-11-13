import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { IntentoPublico, PistaPublica, Stroke } from '@garabato/shared';
import { ApiService } from '../../api/api.service';
import { errorDeApi, mensajeDeError } from '../../api/errores';
import { EstadoService } from '../../estado/estado.service';
import { DibujoVista } from '../../dibujo/dibujo-vista';
import { normalizar } from '../../comun/texto';

/**
 * Seguimiento: quien dibujó ve los intentos de la otra persona y le manda pistas.
 * Diseño: docs/diseno/Seguimiento.dc.html. Los intentos se actualizan con el estado, cada 5 s.
 */
@Component({
  selector: 'app-seguimiento',
  imports: [RouterLink, DibujoVista],
  templateUrl: './seguimiento.html',
  styleUrl: './seguimiento.css',
})
export class SeguimientoPage {
  private readonly api = inject(ApiService);
  private readonly estados = inject(EstadoService);
  private readonly router = inject(Router);

  protected readonly otro = computed(() => this.estados.estado()?.otro?.nombre ?? 'La otra persona');
  protected readonly palabra = computed(() => this.estados.estado()?.turno?.palabra ?? '');
  protected readonly trazos = signal<Stroke[] | null>(null);
  protected readonly intentos = signal<IntentoPublico[]>([]);
  protected readonly fallidos = computed(() => this.intentos().filter((i) => !i.correcto));
  protected readonly pistas = signal<PistaPublica[]>([]);
  protected readonly texto = signal('');
  protected readonly enviando = signal(false);
  protected readonly mensaje = signal<string | null>(null);
  protected readonly sePuedeMandar = computed(() => normalizar(this.texto()).length > 0 && !this.enviando());

  private turnoId: string | null = null;
  private intentosVistos = -1;

  constructor() {
    this.estados.seguir(inject(DestroyRef));
    effect(() => {
      const e = this.estados.estado();
      if (!e) return;
      const t = e.turno;
      // Solo mientras la otra persona adivina tu dibujo. Si acertó o se rindió, el turno ya cambió.
      if (!t || t.rol !== 'dibuja' || t.estado !== 'adivinando') {
        void this.router.navigate(['/'], { replaceUrl: true });
        return;
      }
      if (this.turnoId !== t.id) {
        this.turnoId = t.id;
        this.api.dibujo(t.id).subscribe({ next: (d) => this.trazos.set(d.trazos), error: () => undefined });
        this.api.pistas(t.id).subscribe({ next: (p) => this.pistas.set(p), error: () => undefined });
      }
      if (t.intentos !== this.intentosVistos) {
        this.intentosVistos = t.intentos;
        this.api.intentos(t.id).subscribe({ next: (i) => this.intentos.set(i), error: () => undefined });
      }
    });
  }

  protected escribir(valor: string): void {
    this.texto.set(valor);
    this.mensaje.set(null);
  }

  protected mandar(evento: Event): void {
    evento.preventDefault();
    const turnoId = this.turnoId;
    if (!turnoId || !this.sePuedeMandar()) return;
    this.enviando.set(true);
    this.mensaje.set(null);
    this.api.mandarPista(turnoId, this.texto().trim()).subscribe({
      next: (p) => {
        this.enviando.set(false);
        this.pistas.set(p);
        this.texto.set('');
      },
      error: (e: unknown) => {
        // El texto queda en el campo para corregirlo o reintentar.
        this.enviando.set(false);
        const err = errorDeApi(e);
        if (err?.codigo === 'turno_cerrado') this.estados.actualizar();
        this.mensaje.set(err?.mensaje ?? mensajeDeError(e, 'No se pudo mandar. Probá de nuevo.'));
      },
    });
  }
}

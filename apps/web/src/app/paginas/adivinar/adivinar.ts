import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { IntentoPublico, Stroke } from '@garabato/shared';
import { ApiService } from '../../api/api.service';
import { errorDeApi, mensajeDeError } from '../../api/errores';
import { EstadoService } from '../../estado/estado.service';
import { DibujoVista } from '../../dibujo/dibujo-vista';
import { AvisoGirar } from '../../comun/aviso-girar';
import { normalizar } from '../../comun/texto';

/**
 * Adivinar. Diseño: docs/diseno/Adivinar.dc.html.
 * La reproducción trazo por trazo y las pistas llegan en la etapa 2.
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
  protected readonly texto = signal('');
  protected readonly enviando = signal(false);
  protected readonly mensaje = signal<string | null>(null);
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
  }
}

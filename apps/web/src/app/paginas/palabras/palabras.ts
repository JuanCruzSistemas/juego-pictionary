import { Component, computed, inject, signal, type OnInit } from '@angular/core';
import { Location } from '@angular/common';
import type { PalabraPropia } from '@garabato/shared';
import { ApiService } from '../../api/api.service';
import { errorDeApi, mensajeDeError } from '../../api/errores';
import { normalizar } from '../../comun/texto';
import { PALABRA_MAXIMA } from '../elegir/reglas';

/**
 * Nuestras palabras: los chistes internos de la sala. Diseño: docs/diseno/Palabras.dc.html.
 * Entran al sorteo: en la mitad de los turnos, una de las tres opciones es propia.
 */
@Component({
  selector: 'app-palabras',
  templateUrl: './palabras.html',
  styleUrl: './palabras.css',
})
export class PalabrasPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly location = inject(Location);

  protected readonly maximo = PALABRA_MAXIMA;
  protected readonly lista = signal<PalabraPropia[] | null>(null);
  protected readonly errorDeCarga = signal<string | null>(null);
  protected readonly borrador = signal('');
  protected readonly sumando = signal(false);
  protected readonly mensaje = signal<string | null>(null);
  /** Qué palabra se está sacando: su botón queda deshabilitado mientras viaja el pedido. */
  protected readonly quitando = signal<string | null>(null);
  protected readonly sePuedeSumar = computed(() => normalizar(this.borrador()).length > 0 && !this.sumando());

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.errorDeCarga.set(null);
    this.api.palabras().subscribe({
      next: (l) => this.lista.set(l),
      error: (e: unknown) => this.errorDeCarga.set(mensajeDeError(e, 'Revisá tu conexión y probá de nuevo.')),
    });
  }

  protected volver(): void {
    this.location.back();
  }

  protected escribir(valor: string): void {
    this.borrador.set(valor);
    this.mensaje.set(null);
  }

  protected sumar(evento: Event): void {
    evento.preventDefault();
    if (!this.sePuedeSumar()) return;
    this.sumando.set(true);
    this.mensaje.set(null);
    this.api.sumarPalabra(this.borrador().trim()).subscribe({
      next: (l) => {
        this.sumando.set(false);
        this.lista.set(l);
        this.borrador.set('');
      },
      error: (e: unknown) => {
        this.sumando.set(false);
        this.mensaje.set(errorDeApi(e)?.mensaje ?? mensajeDeError(e, 'No se pudo sumar. Probá de nuevo.'));
      },
    });
  }

  protected quitar(p: PalabraPropia): void {
    if (this.quitando()) return;
    this.quitando.set(p.id);
    this.api.quitarPalabra(p.id).subscribe({
      next: (l) => {
        this.quitando.set(null);
        this.lista.set(l);
      },
      error: (e: unknown) => {
        this.quitando.set(null);
        // Si ya no estaba (la sacó la otra persona), se recarga la lista.
        if (errorDeApi(e)?.codigo === 'palabra_no_encontrada') this.cargar();
        else this.mensaje.set(mensajeDeError(e, 'No se pudo sacar. Probá de nuevo.'));
      },
    });
  }
}

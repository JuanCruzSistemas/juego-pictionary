import { Component, inject, signal, type OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { FiltroHistorial, ItemHistorial } from '@garabato/shared';
import { ApiService } from '../../api/api.service';
import { mensajeDeError } from '../../api/errores';
import { DibujoVista } from '../../dibujo/dibujo-vista';
import { cuando } from '../recibido/cuando';

const FILTROS: { valor: FiltroHistorial; texto: string }[] = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'juego', texto: 'Juego' },
  { valor: 'libres', texto: 'Libres' },
];

/**
 * Historial: los dibujos de turnos terminados y los libres, del más nuevo al más viejo.
 * Diseño: docs/diseno/Historial.dc.html. Se carga de a páginas con "Ver más".
 */
@Component({
  selector: 'app-historial',
  imports: [RouterLink, DibujoVista],
  templateUrl: './historial.html',
  styleUrl: './historial.css',
})
export class HistorialPage implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly filtros = FILTROS;
  protected readonly filtro = signal<FiltroHistorial>('todos');
  protected readonly items = signal<ItemHistorial[] | null>(null);
  protected readonly siguiente = signal<string | null>(null);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly cuando = cuando;

  ngOnInit(): void {
    this.cargar(true);
  }

  protected elegir(f: FiltroHistorial): void {
    if (this.filtro() === f) return;
    this.filtro.set(f);
    this.cargar(true);
  }

  /** Desde el principio, o la página siguiente. */
  protected cargar(desdeElPrincipio: boolean): void {
    const filtro = this.filtro();
    if (desdeElPrincipio) {
      this.items.set(null);
      this.siguiente.set(null);
    }
    this.cargando.set(true);
    this.error.set(null);
    this.api.historial(filtro, desdeElPrincipio ? null : this.siguiente()).subscribe({
      next: (p) => {
        // Si cambió el filtro mientras tanto, esta página ya no sirve.
        if (filtro !== this.filtro()) return;
        this.items.update((actuales) => [...(desdeElPrincipio ? [] : (actuales ?? [])), ...p.items]);
        this.siguiente.set(p.siguiente);
        this.cargando.set(false);
      },
      error: (e: unknown) => {
        if (filtro !== this.filtro()) return;
        this.cargando.set(false);
        this.error.set(mensajeDeError(e, 'Revisá tu conexión y probá de nuevo.'));
      },
    });
  }

  protected detalle(i: ItemHistorial): string {
    const quien = i.mio ? 'Vos' : i.autor;
    if (i.tipo === 'libre') return `${quien} · ${this.cuando(i.fecha)}`;
    // Si lo dibujaste vos, se rindió la otra persona; si no, te rendiste vos.
    if (i.resultado === 'rendido') return i.mio ? 'Vos · sin adivinar' : `${quien} · te rendiste`;
    return `${quien} · ${i.intentos} ${i.intentos === 1 ? 'intento' : 'intentos'}`;
  }
}

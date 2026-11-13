import { Component, inject, input, signal, type OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { LibreGuardado } from '@garabato/shared';
import { ApiService } from '../../api/api.service';
import { errorDeApi, mensajeDeError } from '../../api/errores';
import { EstadoService } from '../../estado/estado.service';
import { DibujoVista } from '../../dibujo/dibujo-vista';
import { cuando } from './cuando';

/**
 * Un dibujo libre. Diseño: docs/diseno/Recibido.dc.html.
 * Abrirlo lo marca como visto. Se reproduce trazo por trazo al abrirlo y con "Ver cómo lo dibujó".
 */
@Component({
  selector: 'app-recibido',
  imports: [RouterLink, DibujoVista],
  templateUrl: './recibido.html',
  styleUrl: './recibido.css',
})
export class RecibidoPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly estados = inject(EstadoService);

  /** Viene de la ruta /recibido/:id. */
  readonly id = input.required<string>();

  protected readonly libre = signal<LibreGuardado | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly cargando = signal(false);
  protected readonly cuando = cuando;

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.error.set(null);
    this.cargando.set(true);
    this.api.libre(this.id()).subscribe({
      next: (l) => {
        this.libre.set(l);
        this.cargando.set(false);
        // Ya está visto: Inicio deja de mostrarlo como nuevo.
        this.estados.actualizar();
      },
      error: (e: unknown) => {
        this.cargando.set(false);
        if (errorDeApi(e)?.codigo === 'libre_no_encontrado') {
          void this.router.navigate(['/'], { replaceUrl: true });
        } else {
          this.error.set(mensajeDeError(e, 'Revisá tu conexión y probá de nuevo.'));
        }
      },
    });
  }
}

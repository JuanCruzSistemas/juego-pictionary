import { Component, inject, input, signal, type OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { ResumenTurno } from '@garabato/shared';
import { ApiService } from '../../api/api.service';
import { errorDeApi, mensajeDeError } from '../../api/errores';
import { DibujoVista } from '../../dibujo/dibujo-vista';

/**
 * Acierto. Diseño: docs/diseno/Acierto.dc.html.
 * La racha, las pistas y "Ver historial" llegan en la etapa 2.
 */
@Component({
  selector: 'app-acierto',
  imports: [RouterLink, DibujoVista],
  templateUrl: './acierto.html',
  styleUrl: './acierto.css',
})
export class AciertoPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  /** Viene de la ruta /acierto/:turnoId. */
  readonly turnoId = input.required<string>();

  protected readonly resumen = signal<ResumenTurno | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly cargando = signal(false);

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.error.set(null);
    this.cargando.set(true);
    this.api.resumen(this.turnoId()).subscribe({
      next: (r) => {
        this.resumen.set(r);
        this.cargando.set(false);
      },
      error: (e: unknown) => {
        this.cargando.set(false);
        const codigo = errorDeApi(e)?.codigo;
        // Un turno que no está adivinado, o que no es de quien pide, no tiene acierto que mostrar.
        if (codigo === 'resumen_no_disponible' || codigo === 'turno_no_encontrado') {
          void this.router.navigate(['/'], { replaceUrl: true });
        } else {
          this.error.set(mensajeDeError(e, 'Revisá tu conexión y probá de nuevo.'));
        }
      },
    });
  }
}

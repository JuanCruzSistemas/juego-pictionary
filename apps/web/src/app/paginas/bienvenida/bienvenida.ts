import { Component, computed, inject, input, signal, type OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../api/api.service';
import { errorDeApi } from '../../api/errores';
import { SesionService } from '../../sesion/sesion.service';
import { NOMBRE_MAXIMO, problemaDelNombre } from '../../sesion/nombre';
import { IlustracionPareja } from '../../comun/ilustracion-pareja';

type Vista = 'cargando' | 'formulario' | 'llena' | 'no-encontrada' | 'sin-conexion';

/** Entrada por link. Diseño: docs/diseno/Bienvenida.dc.html. Los avisos llegan en la etapa 3. */
@Component({
  selector: 'app-bienvenida',
  imports: [IlustracionPareja],
  templateUrl: './bienvenida.html',
  styleUrl: './bienvenida.css',
})
export class BienvenidaPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly sesion = inject(SesionService);
  private readonly router = inject(Router);

  /** Viene de la ruta /s/:invitacion. */
  readonly invitacion = input.required<string>();

  protected readonly vista = signal<Vista>('cargando');
  protected readonly invitadoPor = signal<string | null>(null);
  protected readonly nombre = signal('');
  protected readonly problema = signal<string | null>(null);
  protected readonly errorDeEnvio = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly maximo = NOMBRE_MAXIMO;

  protected readonly titulo = computed(() => {
    const quien = this.invitadoPor();
    return quien ? `${quien} te invitó a dibujar` : 'Te invitaron a dibujar';
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.vista.set('cargando');
    this.api.sala(this.invitacion()).subscribe({
      next: (sala) => {
        if (sala.llena) {
          this.vista.set('llena');
        } else {
          this.invitadoPor.set(sala.invitadoPor);
          this.vista.set('formulario');
        }
      },
      error: (e: unknown) => {
        this.vista.set(errorDeApi(e)?.codigo === 'sala_no_encontrada' ? 'no-encontrada' : 'sin-conexion');
      },
    });
  }

  protected escribir(valor: string): void {
    this.nombre.set(valor);
    this.problema.set(null);
  }

  protected entrar(evento: Event): void {
    evento.preventDefault();
    if (this.enviando()) return;

    // El teclado de Android suele dejar un espacio al final: se recorta antes de validar.
    const nombre = this.nombre().trim();
    const problema = problemaDelNombre(nombre);
    this.problema.set(problema);
    this.errorDeEnvio.set(null);
    if (problema) return;

    this.enviando.set(true);
    this.api.entrar(this.invitacion(), { nombre }).subscribe({
      next: (r) => {
        this.sesion.guardar({ token: r.token, jugador: r.jugador });
        void this.router.navigate(['/'], { replaceUrl: true });
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        const error = errorDeApi(e);
        if (error?.codigo === 'sala_llena') this.vista.set('llena');
        else if (error?.codigo === 'sala_no_encontrada') this.vista.set('no-encontrada');
        else if (error?.codigo === 'datos_invalidos') this.problema.set(error.mensaje);
        else this.errorDeEnvio.set('No pudimos conectarnos. Revisá tu conexión y probá de nuevo.');
      },
    });
  }
}

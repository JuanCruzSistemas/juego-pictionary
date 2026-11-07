import { Component, computed, inject, input, signal, type OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { SalaPublica } from '@garabato/shared';
import { ApiService } from '../../api/api.service';
import { errorDeApi, mensajeDeError } from '../../api/errores';
import { SesionService } from '../../sesion/sesion.service';
import { EstadoService } from '../../estado/estado.service';
import { NOMBRE_MAXIMO, problemaDelNombre } from '../../sesion/nombre';
import { IlustracionPareja } from '../../comun/ilustracion-pareja';
import { vistaDeBienvenida, type Vista } from './vista';

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
  private readonly estados = inject(EstadoService);
  private readonly router = inject(Router);

  /** Viene de la ruta /s/:invitacion. */
  readonly invitacion = input.required<string>();

  protected readonly vista = signal<Vista>('cargando');
  protected readonly invitadoPor = signal<string | null>(null);
  protected readonly nombre = signal('');
  protected readonly problema = signal<string | null>(null);
  protected readonly errorDeEnvio = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly motivo = signal('Revisá tu conexión y probá de nuevo.');
  protected readonly maximo = NOMBRE_MAXIMO;
  protected readonly nombreDeLaSesion = computed(() => this.sesion.actual()?.jugador.nombre ?? '');

  protected readonly titulo = computed(() => {
    const quien = this.invitadoPor();
    return quien ? `${quien} te invitó a dibujar` : 'Te invitaron a dibujar';
  });

  ngOnInit(): void {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.vista.set('cargando');
    try {
      const propia = await this.invitacionDeLaSesion();
      if (propia === this.invitacion()) {
        void this.router.navigate(['/'], { replaceUrl: true });
        return;
      }
      const sala: SalaPublica = await firstValueFrom(this.api.sala(this.invitacion()));
      if (!sala.llena) this.invitadoPor.set(sala.invitadoPor);
      this.vista.set(vistaDeBienvenida(sala, propia));
    } catch (e) {
      this.motivo.set(mensajeDeError(e, 'Revisá tu conexión y probá de nuevo.'));
      this.vista.set(errorDeApi(e)?.codigo === 'sala_no_encontrada' ? 'no-encontrada' : 'sin-conexion');
    }
  }

  /** "Ir a mi sala". */
  protected irAMiSala(): void {
    void this.router.navigate(['/'], { replaceUrl: true });
  }

  /** "Entrar a esta": cierra la sesión de la otra sala en este dispositivo y muestra el formulario. */
  protected entrarAEsta(): void {
    this.sesion.cerrar();
    this.estados.olvidar();
    this.vista.set('formulario');
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
        this.sesion.guardar({ token: r.token, jugador: r.jugador, invitacion: this.invitacion() });
        void this.router.navigate(['/'], { replaceUrl: true });
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        const error = errorDeApi(e);
        if (error?.codigo === 'sala_llena') this.vista.set('llena');
        else if (error?.codigo === 'sala_no_encontrada') this.vista.set('no-encontrada');
        else if (error?.codigo === 'datos_invalidos') this.problema.set(error.mensaje);
        else this.errorDeEnvio.set(mensajeDeError(e, 'No pudimos entrar. Probá de nuevo.'));
      },
    });
  }

  /**
   * La invitación de la sesión de este dispositivo, o undefined si no hay sesión.
   * Si la sesión es anterior a que se guardara la invitación, la pide a /api/estado.
   */
  private async invitacionDeLaSesion(): Promise<string | undefined> {
    const s = this.sesion.actual();
    if (!s) return undefined;
    if (s.invitacion) return s.invitacion;
    try {
      const e = await firstValueFrom(this.api.estado());
      this.sesion.guardar({ ...s, invitacion: e.invitacion });
      return e.invitacion;
    } catch (e) {
      // Si la API ya no reconoce la sesión, el interceptor la borró: se sigue como si no hubiera.
      if (errorDeApi(e)?.codigo === 'sesion_invalida') return undefined;
      throw e;
    }
  }
}

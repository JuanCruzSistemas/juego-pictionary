import { Component, DestroyRef, computed, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EstadoService } from '../../estado/estado.service';
import { CompartirLink } from '../../comun/compartir-link';
import { tarjetaDeInicio } from './textos';
import { DibujoService } from '../../dibujo/dibujo.service';
import { InstalacionService } from '../../pwa/instalacion.service';
import { tarjetasExtra } from '../../pwa/tarjetas';

/**
 * Inicio. Diseño: docs/diseno/Main.dc.html.
 * En la etapa 1 se muestra solo la tarjeta del turno: racha, dibujos libres, modo en vivo
 * y últimos dibujos llegan en las etapas 2 y 4.
 */
@Component({
  selector: 'app-inicio',
  imports: [RouterLink, CompartirLink],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class InicioPage {
  private readonly estados = inject(EstadoService);

  protected readonly estado = this.estados.estado;
  protected readonly error = this.estados.error;
  protected readonly cargando = this.estados.cargando;
  private readonly dibujo = inject(DibujoService);
  protected readonly instalacion = inject(InstalacionService);
  /** Tarjetas debajo del turno. La de avisos llega en el paso 5 de la etapa 3. */
  protected readonly extras = computed(() =>
    this.estado() ? tarjetasExtra({ avisos: false, instalar: this.instalacion.ofrecer() }) : [],
  );
  protected readonly tarjeta = computed(() => {
    const e = this.estado();
    return e ? tarjetaDeInicio(e) : null;
  });
  protected readonly link = computed(() => {
    const e = this.estado();
    return e ? `${location.origin}/s/${e.invitacion}` : '';
  });

  constructor() {
    this.estados.seguir(inject(DestroyRef));
    // Si el turno cambió (se mandó, se salteó, adivinaron), el borrador de un turno viejo se borra.
    effect(() => {
      const t = this.estado()?.turno;
      if (this.estado() === null) return;
      this.dibujo.descartarSiNoEs(t && t.rol === 'dibuja' && t.estado !== 'adivinando' ? t.id : null);
    });
  }

  protected reintentar(): void {
    this.estados.actualizar();
  }
}

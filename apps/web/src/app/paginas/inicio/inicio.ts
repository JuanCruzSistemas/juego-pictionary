import { Component, DestroyRef, computed, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EstadoService } from '../../estado/estado.service';
import { CompartirLink } from '../../comun/compartir-link';
import { tarjetaDeInicio } from './textos';
import { DibujoService } from '../../dibujo/dibujo.service';
import { InstalacionService } from '../../pwa/instalacion.service';
import { AvisosService } from '../../pwa/avisos.service';
import { tarjetasExtra } from '../../pwa/tarjetas';

/**
 * Inicio. Diseño: docs/diseno/Main.dc.html.
 * La tarjeta del turno, la invitación al modo en vivo, el dibujo libre sin abrir y los botones
 * de dibujo libre, modo en vivo e historial.
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
  protected readonly avisos = inject(AvisosService);
  /** Tarjetas debajo del turno: primero la de avisos, después la de instalar. */
  protected readonly extras = computed(() =>
    this.estado()
      ? tarjetasExtra({ avisos: this.avisos.ofrecerTarjeta(), instalar: this.instalacion.ofrecer() })
      : [],
  );
  protected readonly tarjeta = computed(() => {
    const e = this.estado();
    return e ? tarjetaDeInicio(e) : null;
  });
  /** En vivo se arranca con el turno en elección o en dibujo, no con un dibujo esperando que lo adivinen. */
  protected readonly sePuedeJugarEnVivo = computed(() => {
    const t = this.estado()?.turno;
    return !!t && t.estado !== 'adivinando';
  });
  /** Si la otra persona invitó, o hay una partida en vivo de la que no estás, la tarjeta para entrar. */
  protected readonly invitacionVivo = computed(() => {
    const e = this.estado();
    const v = e?.vivo;
    if (!e || !v || v.presentes.includes(e.yo.id)) return null;
    const otro = e.otro?.nombre ?? 'La otra persona';
    return v.estado === 'esperando' ? `${otro} te invita a jugar en vivo` : 'Volver a la partida en vivo';
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

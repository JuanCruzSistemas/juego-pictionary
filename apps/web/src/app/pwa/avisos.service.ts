import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import type { SuscripcionBody } from '@garabato/shared';
import { ApiService } from '../api/api.service';
import { ALMACEN } from '../comun/almacen';
import { SesionService } from '../sesion/sesion.service';

export const CLAVE_AVISOS = 'garabato.avisos';

export type PermisoDeAvisos = NotificationPermission | 'no-soportado';

/**
 * Avisos push en este dispositivo: el permiso, la tarjeta de Inicio y la suscripción.
 *
 * - El permiso solo se pide después de un toque ("Activar avisos y entrar" o "Activar avisos").
 * - Si se rechaza, o se toca "Ahora no" o "Entrar sin avisos", no se vuelve a ofrecer.
 * - Con el permiso dado, en cada apertura se confirma la suscripción con la API, sin preguntar nada.
 * - Si algo falla, no se muestra ningún error: los avisos son un extra y el juego sigue igual.
 */
@Injectable({ providedIn: 'root' })
export class AvisosService {
  private readonly swPush = inject(SwPush);
  private readonly api = inject(ApiService);
  private readonly almacen = inject(ALMACEN);
  private readonly sesion = inject(SesionService);
  private readonly ventana = inject(DOCUMENT).defaultView as (Window & typeof globalThis) | null;

  private readonly permisoActual = signal<PermisoDeAvisos>(this.leerPermiso());
  private readonly descartados = signal(this.almacen.leer(CLAVE_AVISOS) === 'no-ahora');
  /** La API tiene claves VAPID. Hasta saberlo, no se ofrece nada. */
  private readonly servidorListo = signal(false);
  private readonly pidiendo = signal(false);

  readonly permiso = this.permisoActual.asReadonly();
  readonly activando = this.pidiendo.asReadonly();

  /** Se puede pedir el permiso: hay soporte, todavía no se decidió y no se descartó. */
  readonly sePuedePedir = computed(() => this.permisoActual() === 'default' && !this.descartados());
  /** Tarjeta de Inicio: además, el servidor tiene que tener los avisos encendidos. */
  readonly ofrecerTarjeta = computed(() => this.sePuedePedir() && this.servidorListo());

  private clave: string | null = null;
  private readonly iniciado = signal(false);
  /** Jugador cuya suscripción ya se confirmó en esta apertura. */
  private sincronizadoPara: string | null = null;

  constructor() {
    // Con sesión y permiso dado, se confirma la suscripción sin preguntar: en cada apertura,
    // al entrar con "Activar avisos y entrar", al activar desde la tarjeta, y si el dispositivo
    // cambia de sesión ("Entrar a esta"), para que la suscripción pase al jugador nuevo.
    effect(() => {
      const jugador = this.sesion.actual()?.jugador.id ?? null;
      if (!this.iniciado() || !jugador || this.permisoActual() !== 'granted') return;
      if (this.sincronizadoPara === jugador) return;
      this.sincronizadoPara = jugador;
      void this.suscribir();
    });
  }

  /** Se llama una vez al arrancar la app. */
  iniciar(): void {
    if (this.iniciado() || this.permisoActual() === 'no-soportado') return;
    void this.cargarClave();
    this.escucharCambiosDePermiso();
    // El navegador puede renovar la suscripción por su cuenta: se vuelve a guardar en la API.
    this.swPush.pushSubscriptionChanges.subscribe(({ newSubscription }) => {
      if (newSubscription) void this.guardar(newSubscription);
    });
    this.iniciado.set(true);
  }

  /**
   * Pide el permiso. Hay que llamarlo directo en el manejador del toque, antes de cualquier
   * espera, para que el navegador lo muestre como respuesta a ese toque.
   */
  pedirPermiso(): Promise<PermisoDeAvisos> {
    const N = this.ventana?.Notification;
    if (!N || this.permisoActual() === 'no-soportado') return Promise.resolve('no-soportado');
    this.pidiendo.set(true);
    return N.requestPermission()
      .catch(() => N.permission)
      .then((p) => {
        this.permisoActual.set(p);
        this.pidiendo.set(false);
        return p;
      });
  }

  /** "Activar avisos" de la tarjeta de Inicio. Con el permiso dado, el effect suscribe. */
  async activar(): Promise<void> {
    if (this.pidiendo()) return;
    await this.pedirPermiso();
  }

  /** "Ahora no" en la tarjeta, o "Entrar sin avisos" en Bienvenida: no se vuelve a ofrecer. */
  ahoraNo(): void {
    this.descartados.set(true);
    this.almacen.guardar(CLAVE_AVISOS, 'no-ahora');
  }

  /**
   * Suscribe este dispositivo y lo guarda en la API. Con el permiso ya dado no pregunta nada.
   * Si las claves del servidor cambiaron, el navegador rechaza la suscripción vieja: se da de
   * baja y se suscribe de nuevo. Si el service worker todavía no está, espera a que se registre.
   */
  async suscribir(): Promise<void> {
    try {
      if (this.permisoActual() !== 'granted' || !this.swPush.isEnabled || !this.sesion.activa()) return;
      const clave = this.clave ?? (await this.cargarClave());
      if (!clave) return;
      let suscripcion: PushSubscription;
      try {
        suscripcion = await this.swPush.requestSubscription({ serverPublicKey: clave });
      } catch {
        await this.swPush.unsubscribe().catch(() => undefined);
        suscripcion = await this.swPush.requestSubscription({ serverPublicKey: clave });
      }
      await this.guardar(suscripcion);
    } catch (e) {
      console.warn('No se pudo activar los avisos en este dispositivo:', e);
    }
  }

  private async guardar(s: PushSubscription): Promise<void> {
    if (!this.sesion.activa()) return;
    try {
      await firstValueFrom(this.api.suscribirPush(s.toJSON() as SuscripcionBody));
    } catch (e) {
      console.warn('No se pudo guardar la suscripción:', e);
    }
  }

  private async cargarClave(): Promise<string | null> {
    try {
      const { clavePublica } = await firstValueFrom(this.api.clavePush());
      this.clave = clavePublica;
      this.servidorListo.set(clavePublica !== null);
      return clavePublica;
    } catch {
      return null;
    }
  }

  private leerPermiso(): PermisoDeAvisos {
    const v = this.ventana;
    if (!v || !('Notification' in v) || !('PushManager' in v) || !this.swPush.isEnabled) return 'no-soportado';
    return v.Notification.permission;
  }

  /** Si el permiso cambia desde la configuración del navegador, la app se entera. */
  private escucharCambiosDePermiso(): void {
    this.ventana?.navigator.permissions
      ?.query({ name: 'notifications' })
      .then((estado) => {
        estado.onchange = () => this.permisoActual.set(this.leerPermiso());
      })
      .catch(() => undefined);
  }
}

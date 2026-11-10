import { TestBed } from '@angular/core/testing';
import { SwPush } from '@angular/service-worker';
import { Subject, of, throwError } from 'rxjs';
import { ApiService } from '../api/api.service';
import { ALMACEN, almacenEnMemoria } from '../comun/almacen';
import { SesionService } from '../sesion/sesion.service';
import { AvisosService, CLAVE_AVISOS } from './avisos.service';

type Permiso = NotificationPermission;

describe('AvisosService', () => {
  let permiso: Permiso;
  let respuestaAlPedir: Permiso;
  let requestPermission: ReturnType<typeof vi.fn>;
  let swPush: { isEnabled: boolean; requestSubscription: ReturnType<typeof vi.fn>; unsubscribe: ReturnType<typeof vi.fn>; pushSubscriptionChanges: Subject<{ oldSubscription: null; newSubscription: PushSubscription | null }> };
  let api: { clavePush: ReturnType<typeof vi.fn>; suscribirPush: ReturnType<typeof vi.fn> };
  let almacen: ReturnType<typeof almacenEnMemoria>;
  let clave: string | null;

  const suscripcion = (endpoint = 'https://fcm.googleapis.com/fcm/send/celu') =>
    ({ toJSON: () => ({ endpoint, keys: { p256dh: 'p', auth: 'a' } }) }) as unknown as PushSubscription;

  const listo = async () => {
    for (let i = 0; i < 5; i++) {
      TestBed.tick();
      await new Promise((r) => setTimeout(r, 0));
    }
  };

  function crear({ conSesion = true, iniciar = true } = {}) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SwPush, useValue: swPush },
        { provide: ApiService, useValue: api },
        { provide: ALMACEN, useValue: almacen },
      ],
    });
    if (conSesion) TestBed.inject(SesionService).guardar({ token: 't', jugador: { id: 'juan', nombre: 'Juan', lugar: 1 } });
    const s = TestBed.inject(AvisosService);
    if (iniciar) s.iniciar();
    return s;
  }

  beforeEach(() => {
    permiso = 'default';
    respuestaAlPedir = 'granted';
    clave = 'CLAVE-PUBLICA';
    almacen = almacenEnMemoria();
    requestPermission = vi.fn(async () => {
      permiso = respuestaAlPedir;
      return respuestaAlPedir;
    });
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { get permission() { return permiso; }, requestPermission },
    });
    Object.defineProperty(window, 'PushManager', { configurable: true, value: class {} });
    swPush = {
      isEnabled: true,
      requestSubscription: vi.fn(async () => suscripcion()),
      unsubscribe: vi.fn(async () => undefined),
      pushSubscriptionChanges: new Subject(),
    };
    api = {
      clavePush: vi.fn(() => of({ clavePublica: clave })),
      suscribirPush: vi.fn(() => of(undefined)),
    };
  });

  describe('la tarjeta de Inicio', () => {
    it('se ofrece con el permiso sin decidir y los avisos encendidos en el servidor', async () => {
      const s = crear();
      await listo();
      expect(s.ofrecerTarjeta()).toBe(true);
    });

    it('no se ofrece si el servidor tiene los avisos apagados', async () => {
      clave = null;
      const s = crear();
      await listo();
      expect(s.ofrecerTarjeta()).toBe(false);
    });

    it('"Ahora no" la oculta en este dispositivo, también al volver a abrir', async () => {
      const s = crear();
      await listo();
      s.ahoraNo();
      expect(s.ofrecerTarjeta()).toBe(false);
      expect(almacen.datos.get(CLAVE_AVISOS)).toBe('no-ahora');
      const otraVez = crear();
      await listo();
      expect(otraVez.ofrecerTarjeta()).toBe(false);
    });

    it.each<Permiso>(['denied', 'granted'])('con el permiso %s no se ofrece', async (p) => {
      permiso = p;
      const s = crear();
      await listo();
      expect(s.ofrecerTarjeta()).toBe(false);
    });

    it('en un navegador sin push no se ofrece ni se llama a la API', async () => {
      delete (window as { PushManager?: unknown }).PushManager;
      const s = crear();
      await listo();
      expect(s.permiso()).toBe('no-soportado');
      expect(s.ofrecerTarjeta()).toBe(false);
      expect(api.clavePush).not.toHaveBeenCalled();
    });
  });

  describe('activar', () => {
    it('pide el permiso y, si lo dan, suscribe el dispositivo y lo guarda en la API', async () => {
      const s = crear();
      await listo();
      await s.activar();
      await listo();
      expect(requestPermission).toHaveBeenCalledTimes(1);
      expect(swPush.requestSubscription).toHaveBeenCalledWith({ serverPublicKey: 'CLAVE-PUBLICA' });
      expect(api.suscribirPush).toHaveBeenCalledWith({ endpoint: 'https://fcm.googleapis.com/fcm/send/celu', keys: { p256dh: 'p', auth: 'a' } });
      expect(s.ofrecerTarjeta()).toBe(false);
    });

    it('si lo rechazan, no suscribe y la tarjeta no vuelve', async () => {
      respuestaAlPedir = 'denied';
      const s = crear();
      await listo();
      await s.activar();
      await listo();
      expect(swPush.requestSubscription).not.toHaveBeenCalled();
      expect(s.ofrecerTarjeta()).toBe(false);
    });

    it('si guardar en la API falla, no tira error', async () => {
      api.suscribirPush.mockReturnValue(throwError(() => new Error('sin red')));
      const s = crear();
      await listo();
      await expect(s.activar()).resolves.toBeUndefined();
      await listo();
    });
  });

  describe('suscripción silenciosa', () => {
    it('con el permiso ya dado, en cada apertura confirma la suscripción sin preguntar', async () => {
      permiso = 'granted';
      crear();
      await listo();
      expect(requestPermission).not.toHaveBeenCalled();
      expect(swPush.requestSubscription).toHaveBeenCalledTimes(1);
      expect(api.suscribirPush).toHaveBeenCalledTimes(1);
    });

    it('sin sesión no suscribe; al entrar a una sala, sí', async () => {
      permiso = 'granted';
      crear({ conSesion: false });
      await listo();
      expect(api.suscribirPush).not.toHaveBeenCalled();
      TestBed.inject(SesionService).guardar({ token: 't', jugador: { id: 'juan', nombre: 'Juan', lugar: 1 } });
      await listo();
      expect(api.suscribirPush).toHaveBeenCalledTimes(1);
    });

    it('si el dispositivo cambia de sesión, la suscripción se guarda para el jugador nuevo', async () => {
      permiso = 'granted';
      crear();
      await listo();
      TestBed.inject(SesionService).guardar({ token: 't2', jugador: { id: 'mili', nombre: 'Mili', lugar: 2 } });
      await listo();
      expect(api.suscribirPush).toHaveBeenCalledTimes(2);
    });

    it('si las claves del servidor cambiaron, da de baja la vieja y se suscribe de nuevo', async () => {
      permiso = 'granted';
      swPush.requestSubscription.mockRejectedValueOnce(new DOMException('otra clave', 'InvalidStateError'));
      crear();
      await listo();
      expect(swPush.unsubscribe).toHaveBeenCalledTimes(1);
      expect(swPush.requestSubscription).toHaveBeenCalledTimes(2);
      expect(api.suscribirPush).toHaveBeenCalledTimes(1);
    });

    it('si el navegador renueva la suscripción, se guarda la nueva', async () => {
      permiso = 'granted';
      crear();
      await listo();
      swPush.pushSubscriptionChanges.next({ oldSubscription: null, newSubscription: suscripcion('https://fcm.googleapis.com/fcm/send/nueva') });
      await listo();
      expect(api.suscribirPush).toHaveBeenLastCalledWith(expect.objectContaining({ endpoint: 'https://fcm.googleapis.com/fcm/send/nueva' }));
    });
  });
});

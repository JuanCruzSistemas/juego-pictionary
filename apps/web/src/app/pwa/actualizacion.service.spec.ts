import { TestBed } from '@angular/core/testing';
import { SwUpdate, type VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { ActualizacionService, INTERVALO_DE_BUSQUEDA_MS, RECARGAR } from './actualizacion.service';

describe('ActualizacionService', () => {
  let versiones: Subject<VersionEvent>;
  let rota: Subject<{ type: 'UNRECOVERABLE_STATE'; reason: string }>;
  let sw: { isEnabled: boolean; versionUpdates: Subject<VersionEvent>; unrecoverable: Subject<{ type: 'UNRECOVERABLE_STATE'; reason: string }>; checkForUpdate: ReturnType<typeof vi.fn>; activateUpdate: ReturnType<typeof vi.fn> };
  let recargar: ReturnType<typeof vi.fn>;
  let visibilidad: DocumentVisibilityState;

  const crear = (habilitado = true) => {
    sw.isEnabled = habilitado;
    TestBed.configureTestingModule({
      providers: [
        { provide: SwUpdate, useValue: sw },
        { provide: RECARGAR, useValue: recargar },
      ],
    });
    const s = TestBed.inject(ActualizacionService);
    s.iniciar();
    return s;
  };
  const lista = () => versiones.next({ type: 'VERSION_READY', currentVersion: { hash: 'a' }, latestVersion: { hash: 'b' } });

  beforeEach(() => {
    vi.useFakeTimers();
    versiones = new Subject();
    rota = new Subject();
    recargar = vi.fn();
    sw = {
      isEnabled: true,
      versionUpdates: versiones,
      unrecoverable: rota,
      checkForUpdate: vi.fn().mockResolvedValue(false),
      activateUpdate: vi.fn().mockResolvedValue(true),
    };
    visibilidad = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibilidad });
  });
  afterEach(() => vi.useRealTimers());

  it('busca una versión nueva al abrir, al volver a la app y cada 30 minutos', async () => {
    crear();
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(0);

    visibilidad = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(1);
    visibilidad = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(INTERVALO_DE_BUSQUEDA_MS);
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(3);
  });

  it('con una versión lista avisa, y no recarga sola', () => {
    const s = crear();
    expect(s.hayVersionNueva()).toBe(false);
    lista();
    expect(s.hayVersionNueva()).toBe(true);
    expect(recargar).not.toHaveBeenCalled();
  });

  it('"Actualizar" activa la versión nueva y recarga', async () => {
    const s = crear();
    lista();
    await s.actualizar();
    expect(sw.activateUpdate).toHaveBeenCalledTimes(1);
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it('si activar falla, igual recarga', async () => {
    sw.activateUpdate.mockRejectedValue(new Error('x'));
    const s = crear();
    lista();
    await s.actualizar();
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it('con la caché rota, avisa que hay que recargar', async () => {
    const s = crear();
    rota.next({ type: 'UNRECOVERABLE_STATE', reason: 'x' });
    expect(s.rota()).toBe(true);
    await s.actualizar();
    expect(sw.activateUpdate).not.toHaveBeenCalled();
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it('sin service worker (desarrollo) no hace nada', () => {
    crear(false);
    expect(sw.checkForUpdate).not.toHaveBeenCalled();
  });
});

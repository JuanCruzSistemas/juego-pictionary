import { TestBed } from '@angular/core/testing';
import { ALMACEN, almacenEnMemoria } from '../comun/almacen';
import { CLAVE_INSTALAR, InstalacionService } from './instalacion.service';

/** Simula el evento de Chrome que permite ofrecer la instalación. */
function eventoDeInstalacion(resultado: 'accepted' | 'dismissed') {
  const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & Record<string, unknown>;
  e['prompt'] = vi.fn().mockResolvedValue(undefined);
  e['userChoice'] = Promise.resolve({ outcome: resultado });
  return e;
}

describe('InstalacionService', () => {
  let almacen: ReturnType<typeof almacenEnMemoria>;

  const crear = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: ALMACEN, useValue: almacen }] });
    return TestBed.inject(InstalacionService);
  };

  beforeEach(() => {
    almacen = almacenEnMemoria();
  });

  it('sin el evento del navegador no se ofrece', () => {
    expect(crear().ofrecer()).toBe(false);
  });

  it('con el evento se ofrece, y se cancela la barra propia de Chrome', () => {
    const s = crear();
    const e = eventoDeInstalacion('accepted');
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(s.ofrecer()).toBe(true);
  });

  it('"Instalar" abre el diálogo y, si se acepta, la tarjeta no vuelve', async () => {
    const s = crear();
    const e = eventoDeInstalacion('accepted');
    window.dispatchEvent(e);
    await s.instalar();
    expect(e['prompt']).toHaveBeenCalledTimes(1);
    expect(s.ofrecer()).toBe(false);
  });

  it('"Ahora no" la oculta en este dispositivo, también al volver a abrir', () => {
    const s = crear();
    window.dispatchEvent(eventoDeInstalacion('accepted'));
    s.ahoraNo();
    expect(s.ofrecer()).toBe(false);
    expect(almacen.datos.get(CLAVE_INSTALAR)).toBe('no-ahora');

    const otraVez = crear();
    window.dispatchEvent(eventoDeInstalacion('accepted'));
    expect(otraVez.ofrecer()).toBe(false);
  });

  it('si se instala por otro lado (appinstalled), deja de ofrecerse', () => {
    const s = crear();
    window.dispatchEvent(eventoDeInstalacion('accepted'));
    window.dispatchEvent(new Event('appinstalled'));
    expect(s.ofrecer()).toBe(false);
  });

  it('abierta como app instalada (standalone), no se ofrece', () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes('standalone'), addEventListener: () => {} })) as never;
    const s = crear();
    window.dispatchEvent(eventoDeInstalacion('accepted'));
    expect(s.ofrecer()).toBe(false);
    window.matchMedia = original;
  });
});

import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import type { Estado, SalaPublica } from '@garabato/shared';
import { ApiService } from '../../api/api.service';
import { SesionService } from '../../sesion/sesion.service';
import { BienvenidaPage } from './bienvenida';
import { vistaDeBienvenida } from './vista';

const juanchi = { id: 'j', nombre: 'Juanchi', lugar: 1 };

describe('vistaDeBienvenida', () => {
  it.each([
    [{ llena: false, invitadoPor: null }, undefined, 'formulario'],
    [{ llena: true }, undefined, 'llena'],
    [{ llena: false, invitadoPor: 'Mili' }, 'otra', 'otra-sala'],
    [{ llena: true }, 'otra', 'otra-sala-llena'],
  ] as [SalaPublica, string | undefined, string][])('%j con sesión %s → %s', (sala, sesion, vista) => {
    expect(vistaDeBienvenida(sala, sesion)).toBe(vista);
  });
});

describe('BienvenidaPage con una sesión guardada', () => {
  let sala: SalaPublica;
  let navegar: ReturnType<typeof vi.fn>;

  async function abrir(invitacionDelLink: string) {
    const f = TestBed.createComponent(BienvenidaPage);
    f.componentRef.setInput('invitacion', invitacionDelLink);
    f.detectChanges();
    // cargar() encadena promesas: se espera a que terminen antes de mirar la pantalla.
    await new Promise((r) => setTimeout(r, 0));
    await f.whenStable();
    f.detectChanges();
    return { f, el: f.nativeElement as HTMLElement };
  }
  const boton = (el: HTMLElement, texto: string) =>
    [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto);

  beforeEach(() => {
    sala = { llena: false, invitadoPor: 'Mili' };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ApiService,
          useValue: {
            sala: () => of(sala),
            estado: () => of({ invitacion: 'sala-vieja' } as Estado),
          },
        },
      ],
    });
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true) as never;
    TestBed.inject(SesionService).guardar({ token: 't', jugador: juanchi, invitacion: 'sala-vieja' });
  });

  it('con el link de su propia sala, va directo al inicio', async () => {
    await abrir('sala-vieja');
    expect(navegar).toHaveBeenCalledWith(['/'], { replaceUrl: true });
  });

  it('con el link de otra sala, ofrece "Ir a mi sala" y "Entrar a esta"', async () => {
    const { el } = await abrir('sala-nueva');
    expect(el.querySelector('h1')?.textContent).toBe('Ya entraste a otra sala');
    expect(el.textContent).toContain('Juanchi');
    expect(navegar).not.toHaveBeenCalled();

    boton(el, 'Ir a mi sala')!.click();
    expect(navegar).toHaveBeenCalledWith(['/'], { replaceUrl: true });
    expect(TestBed.inject(SesionService).actual()?.invitacion).toBe('sala-vieja');
  });

  it('"Entrar a esta" cierra la sesión vieja y muestra el formulario de la sala nueva', async () => {
    const { f, el } = await abrir('sala-nueva');
    boton(el, 'Entrar a esta')!.click();
    f.detectChanges();

    expect(TestBed.inject(SesionService).actual()).toBeNull();
    expect(el.querySelector('h1')?.textContent).toBe('Mili te invitó a dibujar');
    expect(el.querySelector('#nombre')).not.toBeNull();
  });

  it('con el link de otra sala que está completa, solo ofrece ir a la propia', async () => {
    sala = { llena: true };
    const { el } = await abrir('sala-nueva');
    expect(el.querySelector('h1')?.textContent).toBe('Esta sala ya está completa');
    expect(boton(el, 'Ir a mi sala')).toBeDefined();
    expect(boton(el, 'Entrar a esta')).toBeUndefined();
  });

  it('una sesión vieja sin invitación la averigua con /api/estado', async () => {
    TestBed.inject(SesionService).guardar({ token: 't', jugador: juanchi });
    await abrir('sala-vieja');
    expect(navegar).toHaveBeenCalledWith(['/'], { replaceUrl: true });
    expect(TestBed.inject(SesionService).actual()?.invitacion).toBe('sala-vieja');
  });
});

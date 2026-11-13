import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import type { Estado, SalaPublica } from '@garabato/shared';
import { ApiService } from '../../api/api.service';
import { SesionService } from '../../sesion/sesion.service';
import { BienvenidaPage } from './bienvenida';
import { vistaDeBienvenida } from './vista';
import { AvisosService } from '../../pwa/avisos.service';
import { signal } from '@angular/core';

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
    // Cada test arranca sin sesión ni preferencias guardadas: si no, se filtran de un test al otro.
    localStorage.clear();
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
        { provide: AvisosService, useValue: { ofrecerTarjeta: signal(false), sePuedePedir: signal(false), pedirPermiso: vi.fn(), ahoraNo: vi.fn() } },
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

describe('BienvenidaPage: avisos al entrar', () => {
  let llamadas: string[];
  let avisos: { ofrecerTarjeta: ReturnType<typeof signal<boolean>>; sePuedePedir: ReturnType<typeof signal<boolean>>; pedirPermiso: ReturnType<typeof vi.fn>; ahoraNo: ReturnType<typeof vi.fn> };

  async function abrir() {
    const f = TestBed.createComponent(BienvenidaPage);
    f.componentRef.setInput('invitacion', 'sala-nueva');
    f.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    await f.whenStable();
    f.detectChanges();
    return { f, el: f.nativeElement as HTMLElement };
  }
  const boton = (el: HTMLElement, texto: string) => [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto);
  const escribirNombre = (f: ReturnType<typeof TestBed.createComponent>, el: HTMLElement, nombre: string) => {
    const input = el.querySelector('#nombre') as HTMLInputElement;
    input.value = nombre;
    input.dispatchEvent(new Event('input'));
    f.detectChanges();
  };

  beforeEach(() => {
    // Cada test arranca sin sesión ni preferencias guardadas: si no, se filtran de un test al otro.
    localStorage.clear();
    llamadas = [];
    avisos = {
      ofrecerTarjeta: signal(true),
      sePuedePedir: signal(true),
      pedirPermiso: vi.fn(() => (llamadas.push('permiso'), Promise.resolve('granted'))),
      ahoraNo: vi.fn(() => llamadas.push('ahora-no')),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ApiService,
          useValue: {
            sala: () => of({ llena: false, invitadoPor: 'Mili' }),
            entrar: () => (llamadas.push('entrar'), of({ token: 't', jugador: juanchi })),
          },
        },
        { provide: AvisosService, useValue: avisos },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  it('con avisos para ofrecer: "Activar avisos y entrar" y "Entrar sin avisos"', async () => {
    const { el } = await abrir();
    expect(boton(el, 'Activar avisos y entrar')).toBeDefined();
    expect(boton(el, 'Entrar sin avisos')).toBeDefined();
    expect(boton(el, 'Entrar')).toBeUndefined();
  });

  it('"Activar avisos y entrar" pide el permiso antes de esperar la red', async () => {
    const { f, el } = await abrir();
    escribirNombre(f, el, 'Juanchi');
    boton(el, 'Activar avisos y entrar')!.click();
    expect(llamadas).toEqual(['permiso', 'entrar']);
  });

  it('con un nombre inválido no pide el permiso', async () => {
    const { el } = await abrir();
    boton(el, 'Activar avisos y entrar')!.click();
    expect(llamadas).toEqual([]);
  });

  it('"Entrar sin avisos" no pide el permiso y no vuelve a ofrecerlo', async () => {
    const { f, el } = await abrir();
    escribirNombre(f, el, 'Juanchi');
    boton(el, 'Entrar sin avisos')!.click();
    expect(llamadas).toEqual(['ahora-no', 'entrar']);
  });

  it('sin avisos para ofrecer, un solo botón "Entrar" que no pide nada', async () => {
    avisos.ofrecerTarjeta.set(false);
    avisos.sePuedePedir.set(false);
    const { f, el } = await abrir();
    expect(boton(el, 'Entrar sin avisos')).toBeUndefined();
    escribirNombre(f, el, 'Juanchi');
    boton(el, 'Entrar')!.click();
    expect(llamadas).toEqual(['entrar']);
  });
});

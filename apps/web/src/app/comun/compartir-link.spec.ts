import { TestBed } from '@angular/core/testing';
import { CompartirLink } from './compartir-link';

describe('CompartirLink', () => {
  const crear = () => {
    const f = TestBed.createComponent(CompartirLink);
    f.componentRef.setInput('url', 'http://192.168.0.10:4200/s/abc');
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  };

  afterEach(() => {
    delete (navigator as { share?: unknown }).share;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  });

  it('sin HTTPS (sin share ni clipboard) muestra solo el campo de solo lectura', () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    const el = crear();
    expect(el.querySelector('button')).toBeNull();
    const campo = el.querySelector('input') as HTMLInputElement;
    expect(campo.readOnly).toBe(true);
    expect(campo.value).toBe('http://192.168.0.10:4200/s/abc');
  });

  it('con share, ofrece compartir y no muestra el campo', () => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: () => Promise.resolve() });
    const el = crear();
    expect(el.querySelector('button')?.textContent).toContain('Compartir link');
    expect(el.querySelector('input')).toBeNull();
  });

  it('sin share pero con clipboard, ofrece copiar', () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.resolve() } });
    const el = crear();
    expect(el.querySelector('button')?.textContent).toContain('Copiar link');
  });
});

import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { conexionInterceptor, ESPERA_LENTA_MS } from './conexion.interceptor';
import { ConexionService } from './conexion.service';
import { DESPERTANDO, SIN_RED, mensajeDeError } from './errores';

describe('conexionInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let conexion: ConexionService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([conexionInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
    conexion = TestBed.inject(ConexionService);
  });
  afterEach(() => vi.useRealTimers());

  it('un pedido lento avisa "despertando" y el aviso se va cuando responde', () => {
    http.get('/api/estado').subscribe();
    vi.advanceTimersByTime(ESPERA_LENTA_MS + 1);
    expect(conexion.aviso()).toBe('despertando');
    ctrl.expectOne('/api/estado').flush({});
    expect(conexion.aviso()).toBeNull();
  });

  it('un GET con 503 se reintenta solo hasta que responde', () => {
    let respuesta: unknown;
    http.get('/api/estado').subscribe((r) => (respuesta = r));
    ctrl.expectOne('/api/estado').flush('', { status: 503, statusText: 'Service Unavailable' });
    expect(conexion.aviso()).toBe('despertando');
    vi.advanceTimersByTime(1000);
    ctrl.expectOne('/api/estado').flush('', { status: 502, statusText: 'Bad Gateway' });
    vi.advanceTimersByTime(2000);
    ctrl.expectOne('/api/estado').flush({ ok: true });
    expect(respuesta).toEqual({ ok: true });
    expect(conexion.aviso()).toBeNull();
  });

  it('un error de nuestra API no se reintenta', () => {
    let error: unknown;
    http.get('/api/estado').subscribe({ error: (e) => (error = e) });
    ctrl.expectOne('/api/estado').flush({ codigo: 'sesion_invalida', mensaje: 'x' }, { status: 401, statusText: '' });
    vi.advanceTimersByTime(10_000);
    ctrl.expectNone('/api/estado');
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(conexion.aviso()).toBeNull();
  });

  it('un POST no se reintenta solo', () => {
    let error: unknown;
    http.post('/api/turnos/t/intentos', {}).subscribe({ error: (e) => (error = e) });
    ctrl.expectOne('/api/turnos/t/intentos').flush('', { status: 503, statusText: '' });
    vi.advanceTimersByTime(10_000);
    ctrl.expectNone('/api/turnos/t/intentos');
    expect(error).toBeDefined();
    expect(conexion.aviso()).toBe('despertando');
  });
});

describe('mensajeDeError', () => {
  const error = (status: number, body: unknown = null) => new HttpErrorResponse({ status, error: body });

  it('el mensaje de la API, si lo hay', () => {
    expect(mensajeDeError(error(409, { codigo: 'turno_cerrado', mensaje: 'Ya no.' }), 'x')).toBe('Ya no.');
  });

  it('servidor que no responde: "se está despertando"', () => {
    for (const s of [0, 502, 503, 504, 500]) expect(mensajeDeError(error(s), 'x')).toBe(DESPERTANDO);
  });

  it('sin red: "Sin conexión"', () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(mensajeDeError(error(0), 'x')).toBe(SIN_RED);
    onLine.mockRestore();
  });

  it('cualquier otro caso: el mensaje por defecto', () => {
    expect(mensajeDeError(new Error('?'), 'Algo falló.')).toBe('Algo falló.');
  });
});

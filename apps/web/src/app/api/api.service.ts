import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { rutaApi } from './rutas';
import type {
  ClavePush,
  DejarLibreBody,
  DejarLibreRespuesta,
  LibreGuardado,
  SuscripcionBody,
  DibujoGuardado,
  EnviarDibujoBody,
  EnviarDibujoRespuesta,
  EntrarBody,
  EntrarRespuesta,
  FiltroHistorial,
  PaginaHistorial,
  Estado,
  IntentoPublico,
  IntentoRespuesta,
  PalabraBody,
  PalabraPropia,
  PistaPublica,
  RendirseRespuesta,
  ResumenTurno,
  SalaPublica,
  SalteoRespuesta,
  TurnoActual,
} from '@garabato/shared';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  sala(invitacion: string) {
    return this.http.get<SalaPublica>(rutaApi(`salas/${encodeURIComponent(invitacion)}`));
  }

  entrar(invitacion: string, body: EntrarBody) {
    return this.http.post<EntrarRespuesta>(rutaApi(`salas/${encodeURIComponent(invitacion)}/jugadores`), body);
  }

  estado() {
    return this.http.get<Estado>(rutaApi('estado'));
  }

  elegirPalabra(turnoId: string, body: PalabraBody) {
    return this.http.post<TurnoActual>(rutaApi(`turnos/${encodeURIComponent(turnoId)}/palabra`), body);
  }

  saltear(turnoId: string) {
    return this.http.post<SalteoRespuesta>(rutaApi(`turnos/${encodeURIComponent(turnoId)}/salteo`), {});
  }

  enviarDibujo(turnoId: string, body: EnviarDibujoBody) {
    return this.http.post<EnviarDibujoRespuesta>(rutaApi(`turnos/${encodeURIComponent(turnoId)}/dibujo`), body);
  }

  dibujo(turnoId: string) {
    return this.http.get<DibujoGuardado>(rutaApi(`turnos/${encodeURIComponent(turnoId)}/dibujo`));
  }

  intentos(turnoId: string) {
    return this.http.get<IntentoPublico[]>(rutaApi(`turnos/${encodeURIComponent(turnoId)}/intentos`));
  }

  probar(turnoId: string, texto: string) {
    return this.http.post<IntentoRespuesta>(rutaApi(`turnos/${encodeURIComponent(turnoId)}/intentos`), { texto });
  }

  pistas(turnoId: string) {
    return this.http.get<PistaPublica[]>(rutaApi(`turnos/${encodeURIComponent(turnoId)}/pistas`));
  }

  mandarPista(turnoId: string, texto: string) {
    return this.http.post<PistaPublica[]>(rutaApi(`turnos/${encodeURIComponent(turnoId)}/pistas`), { texto });
  }

  palabras() {
    return this.http.get<PalabraPropia[]>(rutaApi('palabras'));
  }

  sumarPalabra(texto: string) {
    return this.http.post<PalabraPropia[]>(rutaApi('palabras'), { texto });
  }

  quitarPalabra(id: string) {
    return this.http.delete<PalabraPropia[]>(rutaApi(`palabras/${encodeURIComponent(id)}`));
  }

  historial(filtro: FiltroHistorial, antes: string | null) {
    const params: Record<string, string> = { filtro };
    if (antes) params['antes'] = antes;
    return this.http.get<PaginaHistorial>(rutaApi('historial'), { params });
  }

  rendirse(turnoId: string) {
    return this.http.post<RendirseRespuesta>(rutaApi(`turnos/${encodeURIComponent(turnoId)}/rendirse`), {});
  }

  resumen(turnoId: string) {
    return this.http.get<ResumenTurno>(rutaApi(`turnos/${encodeURIComponent(turnoId)}/resumen`));
  }

  dejarLibre(body: DejarLibreBody) {
    return this.http.post<DejarLibreRespuesta>(rutaApi('libres'), body);
  }

  libre(id: string) {
    return this.http.get<LibreGuardado>(rutaApi(`libres/${encodeURIComponent(id)}`));
  }

  clavePush() {
    return this.http.get<ClavePush>(rutaApi('push/clave'));
  }

  suscribirPush(body: SuscripcionBody) {
    return this.http.post<void>(rutaApi('push/suscripciones'), body);
  }
}

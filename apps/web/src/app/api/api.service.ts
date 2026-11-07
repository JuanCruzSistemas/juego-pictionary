import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type {
  DibujoGuardado,
  EnviarDibujoBody,
  EnviarDibujoRespuesta,
  EntrarBody,
  EntrarRespuesta,
  Estado,
  PalabraBody,
  SalaPublica,
  SalteoRespuesta,
  TurnoActual,
} from '@garabato/shared';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  sala(invitacion: string) {
    return this.http.get<SalaPublica>(`/api/salas/${encodeURIComponent(invitacion)}`);
  }

  entrar(invitacion: string, body: EntrarBody) {
    return this.http.post<EntrarRespuesta>(`/api/salas/${encodeURIComponent(invitacion)}/jugadores`, body);
  }

  estado() {
    return this.http.get<Estado>('/api/estado');
  }

  elegirPalabra(turnoId: string, body: PalabraBody) {
    return this.http.post<TurnoActual>(`/api/turnos/${encodeURIComponent(turnoId)}/palabra`, body);
  }

  saltear(turnoId: string) {
    return this.http.post<SalteoRespuesta>(`/api/turnos/${encodeURIComponent(turnoId)}/salteo`, {});
  }

  enviarDibujo(turnoId: string, body: EnviarDibujoBody) {
    return this.http.post<EnviarDibujoRespuesta>(`/api/turnos/${encodeURIComponent(turnoId)}/dibujo`, body);
  }

  dibujo(turnoId: string) {
    return this.http.get<DibujoGuardado>(`/api/turnos/${encodeURIComponent(turnoId)}/dibujo`);
  }
}

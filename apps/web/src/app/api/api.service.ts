import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { EntrarBody, EntrarRespuesta, Estado, SalaPublica } from '@garabato/shared';

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
}

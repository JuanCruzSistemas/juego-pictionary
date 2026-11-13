import { Module } from '@nestjs/common';
import { VivoRegistro } from './vivo.registro.js';
import { VivoCanal } from './vivo.canal.js';

/** El registro de partidas y el canal: los usan los turnos y el gateway. */
@Module({ providers: [VivoRegistro, VivoCanal], exports: [VivoRegistro, VivoCanal] })
export class VivoBaseModule {}

import { Module } from '@nestjs/common';
import { PushModule } from '../push/push.module.js';
import { VivoBaseModule } from './vivo-base.module.js';
import { VivoGateway } from './vivo.gateway.js';

@Module({ imports: [VivoBaseModule, PushModule], providers: [VivoGateway] })
export class VivoModule {}

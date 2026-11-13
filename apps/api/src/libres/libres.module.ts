import { Module } from '@nestjs/common';
import { PushModule } from '../push/push.module.js';
import { LibresController } from './libres.controller.js';
import { LibresService } from './libres.service.js';

@Module({ imports: [PushModule], controllers: [LibresController], providers: [LibresService], exports: [LibresService] })
export class LibresModule {}

import { Module } from '@nestjs/common';
import { PushController } from './push.controller.js';
import { ConfigPush } from './config.js';

@Module({ controllers: [PushController], providers: [ConfigPush], exports: [ConfigPush] })
export class PushModule {}

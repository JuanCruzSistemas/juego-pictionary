import { Global, Injectable, Module } from '@nestjs/common';

/** La hora actual. Es inyectable para que los tests puedan simular el paso del tiempo. */
export abstract class Reloj {
  abstract ahora(): Date;
}

@Injectable()
export class RelojDelSistema extends Reloj {
  ahora(): Date {
    return new Date();
  }
}

@Global()
@Module({ providers: [{ provide: Reloj, useClass: RelojDelSistema }], exports: [Reloj] })
export class RelojModule {}

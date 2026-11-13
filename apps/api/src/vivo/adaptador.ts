import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';

/** Socket.IO con el mismo CORS que la API: solo el origen de la web. */
export class AdaptadorVivo extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly origen: string | null,
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    return super.createIOServer(port, {
      ...(options as ServerOptions),
      cors: this.origen ? { origin: [this.origen] } : undefined,
      // El dibujo entero puede pesar varios MB: el mismo límite que el body JSON.
      maxHttpBufferSize: 5 * 1024 * 1024,
    });
  }
}

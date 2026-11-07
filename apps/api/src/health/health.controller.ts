import { Controller, Get } from '@nestjs/common';
import type { Health } from '@garabato/shared';

/** Lo llama el uptime bot. No consulta la base, así no la despierta. */
@Controller('health')
export class HealthController {
  @Get()
  check(): Health {
    return { ok: true };
  }
}

import { MikroORM } from '@mikro-orm/core'
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { AllowAnonymous } from '@thallesp/nestjs-better-auth'

@AllowAnonymous()
@Controller()
export class AppController {
  constructor(private readonly orm: MikroORM) {}

  @Get()
  getHello(): string {
    return 'Hello World'
  }

  // For load balancers and orchestrators: answers 503 when the database is
  // unreachable, so traffic moves to an instance that can serve it.
  // A real query, not orm.checkConnection(): MikroORM connects on the first
  // query, so checkConnection() reports a failure until one has run.
  @Get('health')
  async health(): Promise<{ status: 'ok' }> {
    try {
      await this.orm.em.getConnection().execute('select 1')
    } catch {
      throw new ServiceUnavailableException('Database unreachable')
    }
    return { status: 'ok' }
  }
}

import type { Options } from '@mikro-orm/postgresql'
import { MikroOrmOptionsFactory } from '@mikro-orm/nestjs'
import { Injectable } from '@nestjs/common'
import { createMikroOrmOptions } from '../../config/mikro-orm.config'

@Injectable()
export class DbService implements MikroOrmOptionsFactory {
  createMikroOrmOptions(): Options {
    return createMikroOrmOptions()
  }
}

import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Global, Module } from '@nestjs/common'
import { DbService } from './db.service'

@Global()
@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      useClass: DbService,
    }),
  ],
  providers: [DbService],
  exports: [DbService],
})
export class DbModule {}

import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { DbService } from './db.service';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [
    ConfigModule,
    MikroOrmModule.forRootAsync({
      useClass: DbService,
      imports: [ConfigModule],
    }),
  ],
  providers: [DbService],
  exports: [DbService],
})
export class DbModule {} 
import { Injectable } from '@nestjs/common';
import { MikroOrmOptionsFactory } from '@mikro-orm/nestjs';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { ConfigService } from '../config/config.service';
import { SeedManager } from '@mikro-orm/seeder';
import { type Options, defineConfig } from '@mikro-orm/postgresql'
import { Migrator } from '@mikro-orm/migrations';

@Injectable()
export class DbService implements MikroOrmOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  createMikroOrmOptions(): Options {
    const dbConfig = this.configService.database;

    const options: Options = defineConfig({
      entities: ['./dist/**/*.entity.js'],
      entitiesTs: ['./src/**/*.entity.ts'],
      dbName: dbConfig.name,
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      metadataProvider: TsMorphMetadataProvider,
      forceUtcTimezone: true,
      debug: this.configService.environment === 'development',
      extensions: [SeedManager, Migrator],
      seeder: {
        path: './dist/seeders',
        pathTs: './src/seeders',
        defaultSeeder: 'DatabaseSeeder',
        glob: '!(*.d).{js,ts}',
        emit: 'ts',
        fileName: (className: string) => className,
      },
      migrations: {
        path: './src/modules/db/migrations',
        allOrNothing: true,
        disableForeignKeys: false,
      },
    });

    return options;
  }
} 
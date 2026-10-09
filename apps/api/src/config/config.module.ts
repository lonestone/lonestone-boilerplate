import type { AppConfig } from './env.config'
import type { ConfigService } from '@nestjs/config'
import { Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'
import { config } from './env.config'

/**
 * Nest DI facade over `env.config.ts`.
 *
 * dotenvx loads `.env` (including encrypted files) via `dotenvx run` / Vitest.
 * Zod validation stays in `env.config.ts` so MikroORM CLI, OpenTelemetry
 * bootstrap, and tests can keep importing `config` before Nest exists.
 * Nest does not load `.env` or flatten `process.env`.
 */
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      skipProcessEnv: true,
      load: [() => config],
    }),
  ],
})
export class AppConfigModule {}

export type { AppConfig }
export type AppConfigService = ConfigService<AppConfig, true>

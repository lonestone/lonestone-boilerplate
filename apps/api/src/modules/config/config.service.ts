import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import type { ConfigSchema } from './config.validation';
import { configValidationSchema } from './config.validation';

@Injectable()
export class ConfigService {
  constructor(private configService: NestConfigService<ConfigSchema, true>) {}

  static loadConfig() {
    config();
    const result = configValidationSchema.safeParse(process.env);
    if (!result.success) {
      throw new Error(
        `❌ Invalid environment variables: ${JSON.stringify(
          result.error.format(),
          null,
          4,
        )}`,
      );
    }
    return result.data;
  }

  get environment() {
    return this.configService.get('NODE_ENV', { infer: true });
  }

  get apiPort() {
    return this.configService.get('API_PORT', { infer: true });
  }

  get database() {
    return {
      password: this.configService.get('DATABASE_PASSWORD', { infer: true }),
      user: this.configService.get('DATABASE_USER', { infer: true }),
      name: this.configService.get('DATABASE_NAME', { infer: true }),
      host: this.configService.get('DATABASE_HOST', { infer: true }),
      port: this.configService.get('DATABASE_PORT', { infer: true }),
    };
  }
} 
import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ConfigService } from './config.service';
import { configValidationSchema } from './config.validation';

@Module({
  imports: [
    NestConfigModule.forRoot({
      validate: (config) => {
        const result = configValidationSchema.safeParse(config);
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
      },
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {} 
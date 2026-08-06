import {
  createOpenApiDocument,
  ZodSerializationExceptionFilter,
  ZodValidationExceptionFilter,
} from '@lonestone/nzoth/server'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder } from '@nestjs/swagger'
import { apiReference } from '@scalar/nestjs-api-reference'
import * as express from 'express'
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino'
import { AppModule } from './app.module'
import { config } from './config/env.config'
import { initialiazeTelemetry } from './instrument'

const PREFIX = '/api'

async function bootstrap() {
  // Initialize telemetry
  initialiazeTelemetry()

  // bodyParser must be false so Better Auth (@thallesp/nestjs-better-auth) can
  // handle the raw body on /api/auth and re-add JSON parsers for other routes.
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  })

  // Use Pino logger
  app.useLogger(app.get(Logger))

  // Adding error details to the logs
  // https://github.com/iamolegga/nestjs-pino?tab=readme-ov-file#expose-stack-trace-and-error-class-in-err-property
  app.useGlobalInterceptors(new LoggerErrorInterceptor())

  // Registering custom exception filter for the Nzoth package
  app.useGlobalFilters(new ZodValidationExceptionFilter(), new ZodSerializationExceptionFilter())

  // Stripe webhooks need the raw body for signature verification.
  // AuthModule enables req.rawBody via bodyParser.rawBody; this early middleware
  // keeps express.raw for the webhook path when a Stripe handler is added.
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.originalUrl.startsWith(`${PREFIX}/stripe/webhook`)) {
      return express.raw({ type: 'application/json' })(req, res, next)
    }
    next()
  })

  app.enableCors({
    origin: config.betterAuth.trustedOrigins,
    credentials: true,
  })

  app.setGlobalPrefix(PREFIX)

  if (config.env === 'development') {
    const swaggerConfig = new DocumentBuilder()
      .setOpenAPIVersion('3.1.0')
      .setTitle('Lonestone API')
      .setDescription('The Lonestone API description')
      .setVersion('1.0')
      .addTag('@lonestone')
      .build()

    const document = createOpenApiDocument(app, swaggerConfig)

    app.use(`${PREFIX}/docs.json`, (_: express.Request, res: express.Response) => {
      res.json(document)
    })

    app.use(
      `${PREFIX}/docs`,
      apiReference({
        url: `${PREFIX}/docs.json`,
      }),
    )
  }

  app.enableShutdownHooks()
  await app.listen(config.api.port)
}

bootstrap()

import { StandardSchemaSerializerInterceptor, StandardSchemaValidationPipe } from '@nestjs/common'
import { NestFactory, Reflector } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { apiReference } from '@scalar/nestjs-api-reference'
import express from 'express'
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino'
import { AppModule } from './app.module'
import { addRegisteredSchemas, standardSchemaConverter } from './common/http/openapi'
import { config } from './config/env.config'
import { initialiazeTelemetry } from './instrument'

const PREFIX = '/api'

async function bootstrap() {
  // Initialize telemetry once: in dev, vite-node re-runs this file in the same process
  // on every change, and Sentry and OpenTelemetry register global state.
  if (!import.meta.hot?.data.telemetryInitialized) {
    initialiazeTelemetry()
    if (import.meta.hot) import.meta.hot.data.telemetryInitialized = true
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  })
  // Free the port and the database pool before vite-node re-runs this file.
  import.meta.hot?.on('vite:beforeFullReload', () => app.close())
  // Express 5's default query parser does not expand nested keys.
  app.set('query parser', 'extended')

  // Use Pino logger
  app.useLogger(app.get(Logger))

  // Adding error details to the logs
  // https://github.com/iamolegga/nestjs-pino?tab=readme-ov-file#expose-stack-trace-and-error-class-in-err-property
  app.useGlobalInterceptors(
    new LoggerErrorInterceptor(),
    new StandardSchemaSerializerInterceptor(app.get(Reflector)),
  )
  app.useGlobalPipes(new StandardSchemaValidationPipe())

  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    // If is routes of better auth, next
    if (req.originalUrl.startsWith(`${PREFIX}/auth`)) {
      return next()
    }
    // If is stripe webhook, we need the raw body
    if (req.originalUrl.startsWith(`${PREFIX}/stripe/webhook`)) {
      return express.raw({ type: 'application/json' })(req, res, next)
    }
    // Else, apply the express json middleware
    express.json()(req, res, next)
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

    const document = SwaggerModule.createDocument(app, swaggerConfig, {
      standardSchemaConverter,
    })
    addRegisteredSchemas(document)

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

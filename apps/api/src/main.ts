import { createOpenApiDocument, ZodSerializationExceptionFilter, ZodValidationExceptionFilter } from '@lonestone/nzoth/server'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder } from '@nestjs/swagger'
import { apiReference } from '@scalar/nestjs-api-reference'
import * as express from 'express'
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino'
import { AppModule } from './app.module'
import { config } from './config/env.config'

const PREFIX = '/api'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  })

  // Use Pino logger
  app.useLogger(app.get(Logger))

  // Adding error details to the logs
  // https://github.com/iamolegga/nestjs-pino?tab=readme-ov-file#expose-stack-trace-and-error-class-in-err-property
  app.useGlobalInterceptors(new LoggerErrorInterceptor())

  // Registering custom exception filter for the Nzoth package
  app.useGlobalFilters(
    new ZodValidationExceptionFilter(),
    new ZodSerializationExceptionFilter(),
  )

  app.use(
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
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
    },
  )

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

    app.use(
      `${PREFIX}/docs.json`,
      (_: express.Request, res: express.Response) => {
        res.json(document)
      },
    )

    app.use(
      `${PREFIX}/docs`,
      apiReference({
        url: `${PREFIX}/docs.json`,
      }),
    )
  }

  app.enableShutdownHooks()
  await app.listen(config.apiPort)
}

bootstrap()

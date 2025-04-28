import { addSchemasToSwagger, ZodSerializationExceptionFilter, ZodValidationExceptionFilter } from '@lonestone/nzoth/server'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import * as dotenv from 'dotenv'
// import { addSchemasToSwagger } from "@lonestone/nzoth/server";
import * as express from 'express'
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino'
import { AppModule } from './app.module'
import { config } from './config/env.config'

dotenv.config()

const PREFIX = '/api'
const PORT = process.env.API_PORT || 3000

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: false, // Disable default logger as we'll use Pino
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

  // Conditional middleware for better auth
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
      // Else, apply the express json middleware
      express.json()(req, res, next)
    },
  )

  app.enableCors({
    origin: config.betterAuth.trustedOrigins,
    credentials: true,
  })

  app.setGlobalPrefix(PREFIX)
  // Setting up Swagger
  const swaggerConfig = new DocumentBuilder()
    .setOpenAPIVersion('3.1.0')
    .setTitle('Lonestone API')
    .setDescription('The Lonestone API description')
    .setVersion('1.0')
    .addTag('@lonestone')
    .build()

  const document = SwaggerModule.createDocument(app, swaggerConfig)

  addSchemasToSwagger(document)

  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: '/docs-json',
    customSiteTitle: 'Lonestone API Documentation',
    customfavIcon: '/favicon.ico',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.8/swagger-ui-bundle.min.js',
    ],
    customCssUrl: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.8/swagger-ui.min.css',
    ],
    swaggerOptions: {
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
      persistAuthorization: true,
      displayOperationId: false,
      defaultModelsExpandDepth: 3,
      defaultModelExpandDepth: 3,
      defaultModelRendering: 'model',
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  })

  app.enableShutdownHooks()
  await app.listen(PORT)
}

bootstrap()

import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import * as dotenv from 'dotenv'
import { AppModule } from './app.module'

dotenv.config()

const PORT = process.env.API_PORT || 3000

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  })

  app.setGlobalPrefix('api')
  // Setting up Swagger
  const swaggerConfig = new DocumentBuilder()
    .setOpenAPIVersion('3.1.0')
    .setTitle('Sun Agenda API')
    .setDescription('The Sun Agenda API description')
    .setVersion('1.0')
    .addTag('@lonestone')
    .build()

  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('docs', app, document)

  app.enableShutdownHooks()
  await app.listen(PORT)
}

bootstrap()

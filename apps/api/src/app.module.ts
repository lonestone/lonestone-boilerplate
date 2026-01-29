import { IncomingMessage, ServerResponse } from 'node:http'
import { Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'
import { LoggerModule } from 'nestjs-pino'
import { AppController } from './app.controller'
import { AiModule } from './modules/ai/ai.module'
import { AuthModule } from './modules/auth/auth.module'
import { DbModule } from './modules/db/db.module'
import { EmailModule } from './modules/email/email.module'
import { CommentsModule } from './modules/example/comments/comments.module'
import { PostModule } from './modules/example/posts/posts.module'

// Interface étendue pour les requêtes Express
interface ExpressRequest extends IncomingMessage {
  originalUrl?: string
}

// Interface étendue pour les réponses Express
interface ExpressResponse extends ServerResponse<IncomingMessage> {
  responseTime?: number
}

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            levelFirst: true,
            translateTime: 'yyyy-mm-dd HH:MM:ss',
            singleLine: true,
            messageFormat: false,
            ignore: 'pid,hostname,req,res,context,responseTime',
          },
        },
        autoLogging: true,
        serializers: {
          req: () => {
            return undefined // Don't log request details
          },
          res: () => {
            return undefined // Don't log response details
          },
        },
        // Filter out OpenAPI generator spam
        customReceivedMessage: (req: ExpressRequest) => {
          const url = req.originalUrl || req.url || ''
          // Skip logging for OpenAPI docs requests
          if (url.includes('/docs-json') || url.includes('/docs')) {
            return '' // Return false to skip logging this request
          }
          return `request received: ${req.method} ${url}`
        },
        customLogLevel: (req: ExpressRequest, res: ExpressResponse, error?: Error) => {
          if (res.statusCode >= 500 || error) {
            return 'error'
          }
          else if (res.statusCode >= 400) {
            return 'warn'
          }
          return 'info'
        },
        customSuccessMessage: (req: ExpressRequest, res: ExpressResponse) => {
          const originalUrl = req.originalUrl || req.url || ''
          // Skip logging for OpenAPI docs requests
          if (originalUrl.includes('/docs-json') || originalUrl.includes('/docs')) {
            return '' // Return false to skip logging this response
          }
          const method = req.method || ''
          const statusCode = res.statusCode
          const responseTime = res.responseTime || 0
          return `${method} ${originalUrl} ${statusCode} - ${responseTime}ms`
        },
        customErrorMessage: (req: ExpressRequest, res: ExpressResponse) => {
          const originalUrl = req.originalUrl || req.url || ''
          // Skip logging for OpenAPI docs requests
          if (originalUrl.includes('/docs-json') || originalUrl.includes('/docs')) {
            return '' // Return false to skip logging this response
          }
          const method = req.method || ''
          const statusCode = res.statusCode
          const responseTime = res.responseTime || 0
          return `${method} ${originalUrl} ${statusCode} - ${responseTime}ms`
        },
      },
    }),
    DbModule,
    AuthModule.forRootAsync(),
    EmailModule,
    PostModule,
    AiModule,
    CommentsModule,
    NestConfigModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}

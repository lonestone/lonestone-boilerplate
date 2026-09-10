import { IncomingMessage, ServerResponse } from 'node:http'
import { OpenTelemetryModule } from '@amplication/opentelemetry-nestjs'
import { Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'
import { APP_FILTER } from '@nestjs/core'
import { ScheduleModule } from '@nestjs/schedule'
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup'
import { LoggerModule } from 'nestjs-pino'
import { AppController } from './app.controller'
import { AiModule } from './modules/ai/ai.module'
import { AuthModule } from './modules/auth/auth.module'
import { ChatModule } from './modules/chat/chat.module'
import { ClubModule } from './modules/clubs/club.module'
import { DbModule } from './modules/db/db.module'
import { EmailModule } from './modules/email/email.module'
import { ExampleModule } from './modules/example/example.module'
import { MatchModule } from './modules/matches/match.module'
import { NotificationModule } from './modules/notifications/notification.module'
import { PaymentModule } from './modules/payments/payment.module'
import { SeasonModule } from './modules/seasons/season.module'
import { StatsModule } from './modules/stats/stats.module'

// Extended interface for Express requests
interface ExpressRequest extends IncomingMessage {
  originalUrl?: string
}

// Extended interface for Express responses
interface ExpressResponse extends ServerResponse<IncomingMessage> {
  responseTime?: number
}

@Module({
  imports: [
    OpenTelemetryModule.forRoot(),
    SentryModule.forRoot(),
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
          } else if (res.statusCode >= 400) {
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
    ScheduleModule.forRoot(),
    DbModule,
    AuthModule,
    EmailModule,
    AiModule,
    NestConfigModule,
    ExampleModule,
    ClubModule,
    SeasonModule,
    MatchModule,
    StatsModule,
    ChatModule,
    NotificationModule,
    PaymentModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
  ],
})
export class AppModule {}

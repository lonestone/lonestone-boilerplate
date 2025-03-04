import { Module } from "@nestjs/common";
import { AuthModule } from "./modules/auth/auth.module";
import { DbModule } from "./modules/db/db.module";
import { AppController } from "./app.controller";
import { EmailModule } from "./modules/email/email.module";
import { PostModule } from "./modules/posts/posts.module";
import { CommentsModule } from "./modules/comments/comments.module";
import { ConfigModule as NestConfigModule } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { IncomingMessage, ServerResponse } from "http";
import { LevelWithSilent } from "pino";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            levelFirst: true,
            translateTime: "yyyy-mm-dd HH:MM:ss",
            singleLine: true,
            messageFormat: false,
            ignore: 'pid,hostname,req,res,context,responseTime',
          },
        },
        autoLogging: true,
        serializers: {
          req: () => {
            return undefined; // Don't log request details
          },
          res: () => {
            return undefined; // Don't log response details
          },
        },
        // Filter out OpenAPI generator spam
        customReceivedMessage: (req: IncomingMessage) => {
          const url = (req as any).originalUrl || req.url || '';
          // Skip logging for OpenAPI docs requests
          if (url.includes('/docs-json') || url.includes('/docs')) {
            return ''; // Return false to skip logging this request
          }
          return `request received: ${req.method} ${url}`;
        },
        customLogLevel: (req: IncomingMessage, res: ServerResponse<IncomingMessage>, error?: Error) => {
          if (res.statusCode >= 500 || error) {
            return 'error';
          } else if (res.statusCode >= 400) {
            return 'warn';
          }
          return 'info';
        },
        customSuccessMessage: (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => {
          const originalUrl = (req as any).originalUrl || req.url || '';
          // Skip logging for OpenAPI docs requests
          if (originalUrl.includes('/docs-json') || originalUrl.includes('/docs')) {
            return ''; // Return false to skip logging this response
          }
          const method = req.method || '';
          const statusCode = res.statusCode;
          const responseTime = (res as any).responseTime || 0;
          return `${method} ${originalUrl} ${statusCode} - ${responseTime}ms`;
        },
        customErrorMessage: (req: IncomingMessage, res: ServerResponse<IncomingMessage>, error?: Error) => {
          const originalUrl = (req as any).originalUrl || req.url || '';
          // Skip logging for OpenAPI docs requests
          if (originalUrl.includes('/docs-json') || originalUrl.includes('/docs')) {
            return ''; // Return false to skip logging this response
          }
          const method = req.method || '';
          const statusCode = res.statusCode;
          const responseTime = (res as any).responseTime || 0;
          return `${method} ${originalUrl} ${statusCode} - ${responseTime}ms`;
        },
      },
    }),
    DbModule,
    AuthModule.forRootAsync(),
    EmailModule,
    PostModule,
    CommentsModule,
    NestConfigModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}

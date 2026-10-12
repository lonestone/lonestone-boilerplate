import { MikroORM, RequestContext } from '@mikro-orm/core'
import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Global, Module } from '@nestjs/common'
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth'
import { config } from '../../config/env.config'
import { EmailModule } from '../email/email.module'
import { EmailService } from '../email/email.service'
import { createBetterAuth } from './auth.config'
import { Account, Session, User, Verification } from './auth.entity'

/**
 * Lonestone auth module: wires Better Auth (via @thallesp/nestjs-better-auth)
 * with MikroORM entities, email callbacks, and RequestContext for the auth handler.
 */
@Global()
@Module({
  imports: [
    EmailModule,
    MikroOrmModule.forFeature([User, Session, Account, Verification]),
    BetterAuthModule.forRootAsync({
      imports: [EmailModule],
      inject: [EmailService, MikroORM],
      useFactory: (emailService: EmailService, orm: MikroORM) => ({
        // App-level CORS in main.ts already covers all methods (incl. PATCH).
        // The library's trustedOrigins CORS omits PATCH, so keep it disabled.
        disableTrustedOriginsCors: true,
        auth: createBetterAuth({
          baseUrl: config.api.baseUrl,
          secret: config.betterAuth.secret,
          trustedOrigins: config.betterAuth.trustedOrigins,
          orm,
          sendResetPassword: async (data) => {
            const webUrl = `${config.clients.webApp.url}/reset-password?token=${data.token}`
            return emailService.sendEmail({
              to: data.user.email,
              subject: 'Reset your password',
              content: `Hello ${data.user.name}, please reset your password with the link below:<br/>Web app: <a href="${webUrl}">${webUrl}</a>`,
            })
          },
          sendVerificationEmail: async (data) => {
            const url = `${config.clients.webApp.url}/verify-email?token=${data.token}`
            return emailService.sendEmail({
              to: data.user.email,
              subject: 'Verify your email',
              content: `Hello ${data.user.name}, please verify your email by clicking on the link below: <a href="${url}">${url}</a>`,
            })
          },
        }),
        bodyParser: {
          json: { enabled: true },
          urlencoded: { enabled: true, extended: true },
          // Enables req.rawBody for webhook signature verification (e.g. Stripe).
          rawBody: true,
        },
        middleware: (_req, _res, next) => {
          RequestContext.create(orm.em, next)
        },
      }),
    }),
  ],
  exports: [MikroOrmModule, BetterAuthModule],
})
export class AuthModule {}

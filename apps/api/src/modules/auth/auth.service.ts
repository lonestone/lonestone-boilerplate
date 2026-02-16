import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { BetterAuthType, createBetterAuth } from '../../config/better-auth.config'
import { config } from '../../config/env.config'
import { EmailService } from '../email/email.service'

@Injectable()
export class AuthService implements OnModuleInit {
  private _auth: BetterAuthType | null = null
  private static initPromise: Promise<void> | null = null

  constructor(private emailService: EmailService, private em: EntityManager) { }

  async onModuleInit() {
    if (!AuthService.initPromise) {
      AuthService.initPromise = this.initialize()
    }
    await AuthService.initPromise
  }

  private async initialize() {
    if (this._auth)
      return

    this._auth = createBetterAuth({
      secret: config.betterAuth.secret,
      trustedOrigins: config.betterAuth.trustedOrigins,
      connectionStringUrl: config.database.connectionStringUrl,
      sendResetPassword: async (data) => {
        const url = `${config.clients.webApp.url}/reset-password?token=${data.token}`
        return this.emailService.sendEmail({
          to: data.user.email,
          subject: 'Reset your password',
          content: `Hello ${data.user.name}, please reset your password by clicking on the link below: <a href="${url}">${url}</a>`,
        })
      },
      sendVerificationEmail: async (data) => {
        const url = `${config.clients.webApp.url}/verify-email?token=${data.token}`
        return this.emailService.sendEmail({
          to: data.user.email,
          subject: 'Verify your email',
          content: `Hello ${data.user.name}, please verify your email by clicking on the link below: <a href="${url}">${url}</a>`,
        })
      },
    })
  }

  get auth(): BetterAuthType {
    if (!this._auth) {
      throw new Error('Auth not initialized - call onModuleInit first')
    }
    return this._auth
  }

  get api() {
    return this.auth.api
  }
}

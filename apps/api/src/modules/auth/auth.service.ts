import { Injectable, OnModuleInit } from "@nestjs/common";
import { Auth, betterAuth } from "better-auth";
import { EmailService } from "../email/email.service";
import { config } from "src/config/env.config";
import { Pool } from "pg";

@Injectable()
export class AuthService implements OnModuleInit {
  private _auth: Auth | null = null;
  private static initPromise: Promise<void> | null = null;
  
  constructor(private emailService: EmailService) {}

  async onModuleInit() {
    if (!AuthService.initPromise) {
      AuthService.initPromise = this.initialize();
    }
    await AuthService.initPromise;
  }

  private async initialize() {
    if (this._auth) return;

    this._auth = betterAuth({
      trustedOrigins: config.betterAuth.trustedOrigins,
      emailAndPassword: {
        enabled: true,
        sendResetPassword: async (data) => {
          return this.emailService.sendEmail({
            to: data.user.email,
            subject: "Reset your password",
            content: `Hello ${data.user.name}, please reset your password by clicking on the link below: ${data.url}`,
          });
        },
      },
      emailVerification: {
        sendOnSignUp: true,
        expiresIn: 60 * 60 * 24 * 10, // 10 days
        sendVerificationEmail: async (data) => {
          return this.emailService.sendEmail({
            to: data.user.email,
            subject: "Verify your email",
            content: `Hello ${data.user.name}, please verify your email by clicking on the link below: ${data.url}`,
          });
        },
      },
      database: new Pool({
        connectionString: config.database.connectionStringUrl,
      }),
      advanced: {
        generateId: false,
      },
      rateLimit: {
        window: 50,
        max: 100,
      },
    }) as unknown as Auth;
  }

  get auth() {
    if (!this._auth) {
      throw new Error('Auth not initialized - call onModuleInit first');
    }
    return this._auth;
  }

  get api() {
    return this.auth.api;
  }
}

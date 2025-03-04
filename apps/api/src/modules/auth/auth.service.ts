import { Injectable } from "@nestjs/common";
import { ConfigService } from "../config/config.service";
import { Auth, betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { Pool } from "pg";
import { EmailService } from "../email/email.service";

@Injectable()
export class AuthService {
  auth: Auth;
  constructor(
    private readonly configService: ConfigService,
    private emailService: EmailService
  ) {
    this.auth = this.createConfig();
  }

  get api() {
    return this.auth.api;
  }

  createConfig(): Auth {
    const dbConfig = this.configService.database;

    return betterAuth({
      trustedOrigins: ["http://localhost:5173", "http://localhost:3000"],
      emailAndPassword: {
        enabled: true,
        sendOnSignUp: true,
        sendResetPassword: async (data) => {
          await this.emailService.sendEmail({
            to: data.user.email,
            subject: "Reset your password",
            content: `Please reset your password by clicking <a href="${data.url}">here</a>`,
          });
        },
      },
      emailVerification: {
        sendOnSignUp: true,
        sendVerificationEmail: async (data) => {
          await this.emailService.sendEmail({
            to: data.user.email,
            subject: "Verify your email",
            content: `Please verify your email by clicking <a href="${data.url}">here</a>`,
          });
        },
        expiresIn: 60 * 60 * 24 * 10, // 10 days
      },
      database: new Pool({
        connectionString: `postgres://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.name}`,
      }),
      advanced: {
        generateId: false,
      },
      rateLimit: {
        window: 50,
        max: 100,
      },
      hooks: {
        before: createAuthMiddleware(async (ctx) => {
          if (ctx.path === "/auth/login") {
            console.log("before");
          }
        }),
      },
    }) as unknown as Auth;
  }
}

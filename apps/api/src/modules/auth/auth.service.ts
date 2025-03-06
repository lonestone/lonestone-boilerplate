import { Injectable } from "@nestjs/common";
import { Auth } from "better-auth";
import { EmailService } from "../email/email.service";
import { MikroORM } from "@mikro-orm/core";
import { createAuthConfig } from "../../config/better-auth.config";

@Injectable()
export class AuthService {
  auth: Auth;

  constructor(private emailService: EmailService, private orm: MikroORM) {
    this.auth = this.getConfig();
  }

  get api() {
    return this.auth.api;
  }

  getConfig(): Auth {
    return createAuthConfig({
      sendResetPassword: async (data) => {
        return this.emailService.sendEmail({
          to: data.user.email,
          subject: "Reset your password",
          content: `Hello ${data.user.name}, please reset your password by clicking on the link below: ${data.url}`,
        });
      },
      sendVerificationEmail: async (data) => {
        return this.emailService.sendEmail({
          to: data.user.email,
          subject: "Verify your email",
          content: `Hello ${data.user.name}, please verify your email by clicking on the link below: ${data.url}`,
        });
      },
    }) as unknown as Auth;
  }
}

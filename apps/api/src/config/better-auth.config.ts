import { betterAuth, User } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { config } from "./env.config";
import { Pool } from "pg";
import { openAPI } from "better-auth/plugins";

type BetterAuthOptionsDynamic = {
  sendResetPassword?: (
    data: { user: User; url: string; token: string },
    request: Request | undefined
  ) => Promise<void>;
  sendVerificationEmail?: (
    data: { user: User; url: string; token: string },
    request: Request | undefined
  ) => Promise<void>;
};

export const createAuthConfig = (options?: BetterAuthOptionsDynamic) => {
  return betterAuth({
    secret: config.betterAuth.secret,
    trustedOrigins: config.betterAuth.trustedOrigins,
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async (data, request) => {
        if (!options?.sendResetPassword) return;
        return options?.sendResetPassword?.(data, request);
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      expiresIn: 60 * 60 * 24 * 10, // 10 days
      sendVerificationEmail: async (data, request) => {
        if (!options?.sendVerificationEmail) return;
        return options?.sendVerificationEmail?.(data, request);
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
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/auth/login") {
          console.info("before");
        }
      }),
    },
    plugins: [openAPI()],
  });
};

export const auth = createAuthConfig();

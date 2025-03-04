import { Inject, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { Auth } from "better-auth";
import { fromNodeHeaders } from "better-auth/node";

export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject("AUTH_OPTIONS")
    private readonly auth: Auth
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest();
      const session = await this.auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
      });

      request.session = session;
      request.user = session?.user ?? null; // useful for observability tools like Sentry

      const isPublic = this.reflector.get("PUBLIC", context.getHandler());

      if (isPublic) return true;

      const isOptional = this.reflector.get("OPTIONAL", context.getHandler());

      if (isOptional && !session) return true;

      if (!session) throw new UnauthorizedException();
      return true;
    } catch (error) {
      console.error(error);
      throw new UnauthorizedException();
    }
  }
}

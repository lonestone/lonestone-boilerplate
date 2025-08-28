import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable } from 'rxjs'
import { LoggedInBetterAuthSession } from '../config/better-auth.config'

export const MOCK_AUTH_TOKEN = 'test-auth-token'

@Injectable()
export class MockAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest()
    const authHeader = request.headers.authorization
    // Allow override via custom header for tests
    const testUserId = request.headers['x-test-user-id']

    const isPublic = this.reflector.get('PUBLIC', context.getHandler())

    // Verify if the token is present and valid
    if (authHeader && authHeader === `Bearer ${MOCK_AUTH_TOKEN}`) {
      // Add the user to the session

      if (!testUserId) {
        throw new UnauthorizedException('Unauthorized')
      }

      request.session = {
        session: {
          id: 'test-session-id',
          token: 'test-token',
          userId: testUserId,
          expiresAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          ipAddress: '127.0.0.1',
        },
        user: {
          id: testUserId,
          email: 'test@lonestone.com',
          name: 'Test User',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      } satisfies LoggedInBetterAuthSession

      return true
    }

    if (isPublic) {
      return true
    }

    throw new UnauthorizedException('Unauthorized')
  }
}

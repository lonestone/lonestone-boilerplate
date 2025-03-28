import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Observable } from 'rxjs'

@Injectable()
export class MockAuthGuard implements CanActivate {
  // Token d'authentification fictif pour les tests
  private readonly MOCK_AUTH_TOKEN = 'test-auth-token'

  // ID utilisateur fictif pour les tests
  private readonly MOCK_USER_ID = 'test-user-id'

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest()
    const authHeader = request.headers.authorization

    // Vérifier si le token est présent et valide
    if (authHeader && authHeader === `Bearer ${this.MOCK_AUTH_TOKEN}`) {
      // Ajouter l'utilisateur à la session
      request.session = {
        user: {
          id: this.MOCK_USER_ID,
          email: 'test@example.com',
          name: 'Test User',
        },
      }
      return true
    }

    return false
  }
}

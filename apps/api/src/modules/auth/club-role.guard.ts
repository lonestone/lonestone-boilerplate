import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { LoggedInBetterAuthSession } from './auth.config'
import { ClubRole } from './auth.entity'
import { OrganizationService } from './organization.service'

export const CLUB_ROLES_KEY = 'clubRoles'
export const RequireClubRoles = (...roles: ClubRole[]) => SetMetadata(CLUB_ROLES_KEY, roles)

@Injectable()
export class ClubRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly organizationService: OrganizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<ClubRole[] | undefined>(CLUB_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    const request = context.switchToHttp().getRequest()
    const session = request.session as LoggedInBetterAuthSession | undefined

    if (!session?.user?.id) {
      throw new UnauthorizedException()
    }

    const organizationId =
      request.params?.organizationId ||
      request.params?.clubId ||
      (session.session as { activeOrganizationId?: string } | undefined)?.activeOrganizationId

    if (!organizationId) {
      throw new UnauthorizedException('No active club selected')
    }

    if (!requiredRoles || requiredRoles.length === 0) {
      await this.organizationService.requireMember(organizationId, session.user.id)
      return true
    }

    await this.organizationService.requireRole(organizationId, session.user.id, requiredRoles)
    return true
  }
}

/** Ensures the club owner role cannot be removed — use in services before role updates. */
export function assertOwnerImmutable(currentRole: ClubRole, nextRole: ClubRole): void {
  if (currentRole === 'owner' && nextRole !== 'owner') {
    throw new ForbiddenException('The club owner cannot be demoted')
  }
}

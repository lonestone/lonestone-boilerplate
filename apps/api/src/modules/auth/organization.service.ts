import { EntityManager } from '@mikro-orm/core'
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { ClubRole, Member, Organization, SportType } from './auth.entity'

export interface UpdateOrganizationInput {
  name?: string
  venue?: string | null
  sportType?: SportType | null
  defaultMaxCapacity?: number | null
}

@Injectable()
export class OrganizationService {
  constructor(private readonly em: EntityManager) {}

  async getOrganizationById(organizationId: string): Promise<Organization | null> {
    return this.em.findOne(Organization, { id: organizationId })
  }

  async getMember(organizationId: string, userId: string): Promise<Member | null> {
    return this.em.findOne(
      Member,
      { organization: { id: organizationId }, user: { id: userId } },
      { populate: ['user', 'organization'] },
    )
  }

  async requireMember(organizationId: string, userId: string): Promise<Member> {
    const member = await this.getMember(organizationId, userId)
    if (!member) {
      throw new ForbiddenException('You are not a member of this club')
    }
    return member
  }

  async requireRole(
    organizationId: string,
    userId: string,
    allowedRoles: ClubRole[],
  ): Promise<Member> {
    const member = await this.requireMember(organizationId, userId)
    if (!allowedRoles.includes(member.role)) {
      throw new ForbiddenException('Insufficient club permissions')
    }
    return member
  }

  async assertNotDemotingOwner(memberId: string, newRole: ClubRole): Promise<void> {
    const member = await this.em.findOne(Member, { id: memberId })
    if (!member) throw new NotFoundException('Member not found')
    if (member.role === 'owner' && newRole !== 'owner') {
      throw new ForbiddenException('The club owner cannot be demoted')
    }
  }

  async listMembers(organizationId: string): Promise<Member[]> {
    return this.em.find(
      Member,
      { organization: { id: organizationId } },
      { populate: ['user'], orderBy: { createdAt: 'ASC' } },
    )
  }

  async updateMemberRole(memberId: string, newRole: ClubRole, actorUserId: string): Promise<Member> {
    const member = await this.em.findOne(
      Member,
      { id: memberId },
      { populate: ['organization', 'user'] },
    )
    if (!member) throw new NotFoundException('Member not found')

    await this.requireRole(member.organization.id, actorUserId, ['owner', 'admin'])
    await this.assertNotDemotingOwner(memberId, newRole)

    if (newRole === 'owner') {
      throw new ForbiddenException('Cannot transfer ownership via role update')
    }

    member.role = newRole
    await this.em.flush()
    return member
  }

  async updatePaymentLink(
    organizationId: string,
    userId: string,
    paymentLink: string | null,
  ): Promise<Organization> {
    await this.requireRole(organizationId, userId, ['owner', 'admin'])
    const org = await this.em.findOne(Organization, { id: organizationId })
    if (!org) throw new NotFoundException('Club not found')
    org.paymentLink = paymentLink ?? undefined
    await this.em.flush()
    return org
  }

  async updateOrganization(
    organizationId: string,
    userId: string,
    data: UpdateOrganizationInput,
  ): Promise<Organization> {
    await this.requireRole(organizationId, userId, ['owner', 'admin'])
    const org = await this.em.findOne(Organization, { id: organizationId })
    if (!org) throw new NotFoundException('Club not found')

    if (data.name !== undefined) org.name = data.name
    if (data.venue !== undefined) org.venue = data.venue ?? undefined
    if (data.sportType !== undefined) org.sportType = data.sportType ?? undefined
    if (data.defaultMaxCapacity !== undefined) {
      org.defaultMaxCapacity = data.defaultMaxCapacity ?? undefined
    }

    await this.em.flush()
    return org
  }

  async getUserOrganizations(userId: string): Promise<Organization[]> {
    const members = await this.em.find(
      Member,
      { user: { id: userId } },
      { populate: ['organization'] },
    )
    return members.map((m) => m.organization)
  }

  requireActiveOrganization(activeOrganizationId: string | undefined | null): string {
    if (!activeOrganizationId) {
      throw new UnauthorizedException('No active club selected')
    }
    return activeOrganizationId
  }
}

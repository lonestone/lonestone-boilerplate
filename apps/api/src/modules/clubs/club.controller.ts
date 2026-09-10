import { TypedBody, TypedController, TypedParam, TypedRoute } from '@lonestone/nzoth/server'
import { UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { LoggedInBetterAuthSession } from '../auth/auth.config'
import { Session } from '../auth/auth.decorator'
import { AuthGuard } from '../auth/auth.guard'
import { Organization } from '../auth/auth.entity'
import { OrganizationService } from '../auth/organization.service'
import {
  ClubDto,
  clubMembersSchema,
  clubSchema,
  clubsSchema,
  UpdateClubInput,
  updateClubSchema,
  UpdateMemberRoleInput,
  updateMemberRoleSchema,
} from './contracts/club.contract'

function toClubDto(o: Organization): ClubDto {
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    logo: o.logo,
    paymentLink: o.paymentLink,
    venue: o.venue,
    sportType: o.sportType,
    defaultMaxCapacity: o.defaultMaxCapacity,
    createdAt: o.createdAt,
  }
}

@TypedController('clubs', undefined, { tags: ['Clubs'] })
@UseGuards(AuthGuard)
export class ClubController {
  constructor(private readonly organizationService: OrganizationService) {}

  @TypedRoute.Get('', clubsSchema)
  async listMine(@Session() session: LoggedInBetterAuthSession): Promise<ClubDto[]> {
    const orgs = await this.organizationService.getUserOrganizations(session.user.id)
    return orgs.map(toClubDto)
  }

  @TypedRoute.Get(':organizationId', clubSchema)
  async getOne(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('organizationId', z.string().uuid()) organizationId: string,
  ): Promise<ClubDto> {
    await this.organizationService.requireMember(organizationId, session.user.id)
    const o = await this.organizationService.getOrganizationById(organizationId)
    if (!o) throw new Error('Club not found')
    return toClubDto(o)
  }

  @TypedRoute.Patch(':organizationId', clubSchema)
  async update(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('organizationId', z.string().uuid()) organizationId: string,
    @TypedBody(updateClubSchema) body: UpdateClubInput,
  ): Promise<ClubDto> {
    const o = await this.organizationService.updateOrganization(
      organizationId,
      session.user.id,
      body,
    )
    return toClubDto(o)
  }

  @TypedRoute.Get(':organizationId/members', clubMembersSchema)
  async listMembers(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('organizationId', z.string().uuid()) organizationId: string,
  ) {
    await this.organizationService.requireMember(organizationId, session.user.id)
    const members = await this.organizationService.listMembers(organizationId)
    return members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      phone: m.user.phone,
      role: m.role,
      createdAt: m.createdAt,
    }))
  }

  @TypedRoute.Patch(':organizationId/members/:memberId/role', clubMembersSchema.element)
  async updateRole(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('organizationId', z.string().uuid()) organizationId: string,
    @TypedParam('memberId', z.string().uuid()) memberId: string,
    @TypedBody(updateMemberRoleSchema) body: UpdateMemberRoleInput,
  ) {
    const m = await this.organizationService.updateMemberRole(
      memberId,
      body.role,
      session.user.id,
    )
    return {
      id: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      phone: m.user.phone,
      role: m.role,
      createdAt: m.createdAt,
    }
  }
}

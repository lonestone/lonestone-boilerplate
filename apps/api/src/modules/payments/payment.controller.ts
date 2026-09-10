import { TypedBody, TypedController, TypedParam, TypedRoute } from '@lonestone/nzoth/server'
import { UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { LoggedInBetterAuthSession } from '../auth/auth.config'
import { Session } from '../auth/auth.decorator'
import { AuthGuard } from '../auth/auth.guard'
import { OrganizationService } from '../auth/organization.service'
import {
  clubPaymentLinkSchema,
  matchCostSchema,
  sessionFeeSchema,
  sessionFeesSchema,
  UpdateFeeStatusInput,
  updateFeeStatusSchema,
  UpsertMatchCostInput,
  upsertMatchCostSchema,
} from './contracts/payment.contract'
import { PaymentService } from './payment.service'
import { AttendanceStatus } from '../matches/contracts/match.contract'
import { EntityManager } from '@mikro-orm/core'
import { MatchAttendance } from '../matches/match-attendance.entity'

@TypedController('clubs/:organizationId', undefined, { tags: ['Payments'] })
@UseGuards(AuthGuard)
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly organizationService: OrganizationService,
    private readonly em: EntityManager,
  ) {}

  @TypedRoute.Put('matches/:matchId/cost', matchCostSchema)
  async upsertCost(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('organizationId', z.string().uuid()) organizationId: string,
    @TypedParam('matchId', z.string().uuid()) matchId: string,
    @TypedBody(upsertMatchCostSchema) body: UpsertMatchCostInput,
  ) {
    const { cost, fees } = await this.paymentService.upsertMatchCost(
      organizationId,
      session.user.id,
      matchId,
      body,
    )
    return {
      id: cost.id,
      matchId,
      pitchCostCents: cost.pitchCostCents,
      extrasCostCents: cost.extrasCostCents,
      perPlayerCents: fees[0]?.amountCents,
      presentCount: fees.length,
    }
  }

  @TypedRoute.Get('matches/:matchId/fees', sessionFeesSchema)
  async listFees(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('organizationId', z.string().uuid()) organizationId: string,
    @TypedParam('matchId', z.string().uuid()) matchId: string,
  ) {
    const { fees } = await this.paymentService.getMatchCost(organizationId, session.user.id, matchId)
    return fees.map((f) => ({
      id: f.id,
      matchId: f.match.id,
      userId: f.user.id,
      userName: f.user.name,
      amountCents: f.amountCents,
      status: f.status,
      paidAt: f.paidAt,
    }))
  }

  @TypedRoute.Get('matches/:matchId/cost', matchCostSchema)
  async getCost(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('organizationId', z.string().uuid()) organizationId: string,
    @TypedParam('matchId', z.string().uuid()) matchId: string,
  ) {
    const { cost, fees } = await this.paymentService.getMatchCost(
      organizationId,
      session.user.id,
      matchId,
    )
    const presentCount = await this.em.count(MatchAttendance, {
      match: { id: matchId },
      status: AttendanceStatus.Present,
    })
    return {
      id: cost?.id ?? '00000000-0000-0000-0000-000000000000',
      matchId,
      pitchCostCents: cost?.pitchCostCents ?? 0,
      extrasCostCents: cost?.extrasCostCents ?? 0,
      perPlayerCents: fees[0]?.amountCents,
      presentCount,
    }
  }

  @TypedRoute.Patch('fees/:feeId', sessionFeeSchema)
  async updateFee(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('organizationId', z.string().uuid()) organizationId: string,
    @TypedParam('feeId', z.string().uuid()) feeId: string,
    @TypedBody(updateFeeStatusSchema) body: UpdateFeeStatusInput,
  ) {
    const fee = await this.paymentService.updateFeeStatus(
      organizationId,
      session.user.id,
      feeId,
      body,
    )
    return {
      id: fee.id,
      matchId: fee.match.id,
      userId: fee.user.id,
      userName: fee.user.name,
      amountCents: fee.amountCents,
      status: fee.status,
      paidAt: fee.paidAt,
    }
  }

  @TypedRoute.Put('payment-link', clubPaymentLinkSchema)
  async setPaymentLink(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('organizationId', z.string().uuid()) organizationId: string,
    @TypedBody(clubPaymentLinkSchema) body: { paymentLink?: string | null },
  ) {
    const org = await this.organizationService.updatePaymentLink(
      organizationId,
      session.user.id,
      body.paymentLink ?? null,
    )
    return { paymentLink: org.paymentLink }
  }

  @TypedRoute.Get('payment-link', clubPaymentLinkSchema)
  async getPaymentLink(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('organizationId', z.string().uuid()) organizationId: string,
  ) {
    await this.organizationService.requireMember(organizationId, session.user.id)
    const org = await this.organizationService.getOrganizationById(organizationId)
    return { paymentLink: org?.paymentLink }
  }
}

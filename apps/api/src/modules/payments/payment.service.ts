import { EntityManager } from '@mikro-orm/core'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { OrganizationService } from '../auth/organization.service'
import { AttendanceStatus } from '../matches/contracts/match.contract'
import { MatchAttendance } from '../matches/match-attendance.entity'
import { Match } from '../matches/match.entity'
import {
  FeeStatus,
  UpsertMatchCostInput,
  UpdateFeeStatusInput,
} from './contracts/payment.contract'
import { MatchCost } from './match-cost.entity'
import { SessionFee } from './session-fee.entity'

@Injectable()
export class PaymentService {
  constructor(
    private readonly em: EntityManager,
    private readonly organizationService: OrganizationService,
  ) {}

  async upsertMatchCost(
    organizationId: string,
    userId: string,
    matchId: string,
    data: UpsertMatchCostInput,
  ): Promise<{ cost: MatchCost; fees: SessionFee[] }> {
    await this.organizationService.requireRole(organizationId, userId, ['owner', 'admin'])
    const match = await this.em.findOne(Match, {
      id: matchId,
      organization: { id: organizationId },
    })
    if (!match) throw new NotFoundException('Match not found')

    let cost = await this.em.findOne(MatchCost, { match: { id: matchId } })
    if (!cost) {
      cost = new MatchCost()
      cost.match = match
      this.em.persist(cost)
    }
    cost.pitchCostCents = data.pitchCostCents
    cost.extrasCostCents = data.extrasCostCents

    const present = await this.em.find(
      MatchAttendance,
      { match: { id: matchId }, status: AttendanceStatus.Present },
      { populate: ['user'] },
    )
    if (present.length === 0) {
      throw new BadRequestException('No present players to split the cost')
    }

    const total = data.pitchCostCents + data.extrasCostCents
    const perPlayer = Math.ceil(total / present.length)

    const existingFees = await this.em.find(SessionFee, { match: { id: matchId } })
    for (const fee of existingFees) this.em.remove(fee)

    const fees: SessionFee[] = []
    for (const attendance of present) {
      const fee = new SessionFee()
      fee.match = match
      fee.user = attendance.user
      fee.amountCents = perPlayer
      fee.status = FeeStatus.Owed
      this.em.persist(fee)
      fees.push(fee)
    }

    await this.em.flush()
    return { cost, fees }
  }

  async getMatchCost(
    organizationId: string,
    userId: string,
    matchId: string,
  ): Promise<{ cost: MatchCost | null; fees: SessionFee[]; paymentLink?: string }> {
    await this.organizationService.requireMember(organizationId, userId)
    const cost = await this.em.findOne(
      MatchCost,
      { match: { id: matchId, organization: { id: organizationId } } },
      { populate: ['match'] },
    )
    const fees = await this.em.find(
      SessionFee,
      { match: { id: matchId, organization: { id: organizationId } } },
      { populate: ['user', 'match'] },
    )
    const org = await this.organizationService.getOrganizationById(organizationId)
    return { cost, fees, paymentLink: org?.paymentLink }
  }

  async updateFeeStatus(
    organizationId: string,
    userId: string,
    feeId: string,
    data: UpdateFeeStatusInput,
  ): Promise<SessionFee> {
    const fee = await this.em.findOne(
      SessionFee,
      { id: feeId, match: { organization: { id: organizationId } } },
      { populate: ['user', 'match', 'match.organization'] },
    )
    if (!fee) throw new NotFoundException('Fee not found')

    const isSelf = fee.user.id === userId
    if (!isSelf) {
      await this.organizationService.requireRole(organizationId, userId, ['owner', 'admin'])
    } else if (data.status === FeeStatus.Waived) {
      throw new BadRequestException('Players cannot waive their own fee')
    }

    fee.status = data.status
    fee.paidAt = data.status === FeeStatus.Paid ? new Date() : undefined
    await this.em.flush()
    return fee
  }
}

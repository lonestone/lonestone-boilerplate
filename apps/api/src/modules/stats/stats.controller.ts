import { TypedBody, TypedController, TypedParam, TypedRoute } from '@lonestone/nzoth/server'
import { UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { LoggedInBetterAuthSession } from '../auth/auth.config'
import { Session } from '../auth/auth.decorator'
import { AuthGuard } from '../auth/auth.guard'
import {
  matchStatsSchema,
  seasonPlayerStatsSchema,
  UpsertMatchStatsInput,
  upsertMatchStatsSchema,
} from './contracts/stats.contract'
import { MatchStat } from './match-stat.entity'
import { StatsService } from './stats.service'

@TypedController('clubs/:organizationId', undefined, { tags: ['Stats'] })
@UseGuards(AuthGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  private toDto(s: MatchStat) {
    return {
      id: s.id,
      matchId: s.match.id,
      userId: s.user.id,
      userName: s.user.name,
      goals: s.goals,
      assists: s.assists,
    }
  }

  @TypedRoute.Put('matches/:matchId/stats', matchStatsSchema)
  async upsert(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('organizationId', z.string().uuid()) organizationId: string,
    @TypedParam('matchId', z.string().uuid()) matchId: string,
    @TypedBody(upsertMatchStatsSchema) body: UpsertMatchStatsInput,
  ) {
    const rows = await this.statsService.upsertMatchStats(
      organizationId,
      session.user.id,
      matchId,
      body,
    )
    return rows.map((r) => this.toDto(r))
  }

  @TypedRoute.Get('matches/:matchId/stats', matchStatsSchema)
  async listMatch(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('organizationId', z.string().uuid()) organizationId: string,
    @TypedParam('matchId', z.string().uuid()) matchId: string,
  ) {
    const rows = await this.statsService.listMatchStats(organizationId, session.user.id, matchId)
    return rows.map((r) => this.toDto(r))
  }

  @TypedRoute.Get('seasons/:seasonId/stats', seasonPlayerStatsSchema)
  async seasonStats(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('organizationId', z.string().uuid()) organizationId: string,
    @TypedParam('seasonId', z.string().uuid()) seasonId: string,
  ) {
    return this.statsService.seasonAggregates(organizationId, session.user.id, seasonId)
  }
}

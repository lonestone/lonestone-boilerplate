import { EntityManager } from '@mikro-orm/core'
import { Injectable, NotFoundException } from '@nestjs/common'
import { User } from '../auth/auth.entity'
import { OrganizationService } from '../auth/organization.service'
import { MatchStatus } from '../matches/contracts/match.contract'
import { Match } from '../matches/match.entity'
import { UpsertMatchStatsInput } from './contracts/stats.contract'
import { MatchStat } from './match-stat.entity'

@Injectable()
export class StatsService {
  constructor(
    private readonly em: EntityManager,
    private readonly organizationService: OrganizationService,
  ) {}

  async upsertMatchStats(
    organizationId: string,
    userId: string,
    matchId: string,
    data: UpsertMatchStatsInput,
  ): Promise<MatchStat[]> {
    await this.organizationService.requireRole(organizationId, userId, ['owner', 'admin'])
    const match = await this.em.findOne(Match, {
      id: matchId,
      organization: { id: organizationId },
    })
    if (!match) throw new NotFoundException('Match not found')

    const result: MatchStat[] = []
    for (const row of data.stats) {
      const user = await this.em.findOne(User, { id: row.userId })
      if (!user) continue
      let stat = await this.em.findOne(
        MatchStat,
        { match: { id: matchId }, user: { id: row.userId } },
        { populate: ['user', 'match'] },
      )
      if (!stat) {
        stat = new MatchStat()
        stat.match = match
        stat.user = user
        this.em.persist(stat)
      }
      stat.goals = row.goals
      stat.assists = row.assists
      result.push(stat)
    }
    match.status = MatchStatus.Played
    await this.em.flush()
    return result
  }

  async listMatchStats(
    organizationId: string,
    userId: string,
    matchId: string,
  ): Promise<MatchStat[]> {
    await this.organizationService.requireMember(organizationId, userId)
    return this.em.find(
      MatchStat,
      { match: { id: matchId, organization: { id: organizationId } } },
      { populate: ['user', 'match'] },
    )
  }

  async seasonAggregates(
    organizationId: string,
    userId: string,
    seasonId: string,
  ): Promise<
    Array<{ userId: string; userName: string; goals: number; assists: number; matchesPlayed: number }>
  > {
    await this.organizationService.requireMember(organizationId, userId)
    const stats = await this.em.find(
      MatchStat,
      {
        match: {
          season: { id: seasonId },
          organization: { id: organizationId },
          status: MatchStatus.Played,
        },
      },
      { populate: ['user', 'match'] },
    )

    const map = new Map<
      string,
      { userId: string; userName: string; goals: number; assists: number; matchesPlayed: number }
    >()
    for (const s of stats) {
      const current = map.get(s.user.id) ?? {
        userId: s.user.id,
        userName: s.user.name,
        goals: 0,
        assists: 0,
        matchesPlayed: 0,
      }
      current.goals += s.goals
      current.assists += s.assists
      current.matchesPlayed += 1
      map.set(s.user.id, current)
    }
    return Array.from(map.values()).sort((a, b) => b.goals - a.goals)
  }
}

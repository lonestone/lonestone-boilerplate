import { Injectable } from '@nestjs/common'
import { MatchLineup } from './match-lineup.entity'
import { Match } from './match.entity'
import { MatchAttendance } from './match-attendance.entity'
import { AttendanceDto, LineupDto, MatchDto } from './contracts/match.contract'

@Injectable()
export class MatchMapper {
  toDto(match: Match, presentCount?: number): MatchDto {
    return {
      id: match.id,
      organizationId: match.organization.id,
      seasonId: match.season.id,
      seriesId: match.series?.id,
      title: match.title,
      startsAt: match.startsAt,
      location: match.location,
      maxCapacity: match.maxCapacity,
      status: match.status,
      reminderOffsetsHours: match.reminderOffsetsHours,
      presentCount,
      cancellationReason: match.cancellationReason,
      createdAt: match.createdAt,
    }
  }

  toDtos(matches: Match[], presentCountByMatchId?: Map<string, number>): MatchDto[] {
    return matches.map((m) => this.toDto(m, presentCountByMatchId?.get(m.id)))
  }

  toAttendanceDto(a: MatchAttendance): AttendanceDto {
    return {
      id: a.id,
      matchId: a.match.id,
      userId: a.user.id,
      userName: a.user.name,
      status: a.status,
      respondedAt: a.respondedAt,
    }
  }

  toLineupDto(l: MatchLineup): LineupDto {
    return {
      id: l.id,
      matchId: l.match.id,
      userId: l.user.id,
      userName: l.user.name,
      team: l.team,
    }
  }
}

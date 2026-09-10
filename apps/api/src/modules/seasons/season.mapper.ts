import { Injectable } from '@nestjs/common'
import { Season } from './season.entity'
import { SeasonDto } from './contracts/season.contract'

@Injectable()
export class SeasonMapper {
  toDto(season: Season): SeasonDto {
    return {
      id: season.id,
      organizationId: season.organization.id,
      name: season.name,
      startsAt: season.startsAt,
      endsAt: season.endsAt,
      status: season.status,
      createdAt: season.createdAt,
    }
  }

  toDtos(seasons: Season[]): SeasonDto[] {
    return seasons.map((s) => this.toDto(s))
  }
}

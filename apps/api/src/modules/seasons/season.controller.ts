import { TypedBody, TypedController, TypedParam, TypedRoute } from '@lonestone/nzoth/server'
import { UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { LoggedInBetterAuthSession } from '../auth/auth.config'
import { Session } from '../auth/auth.decorator'
import { AuthGuard } from '../auth/auth.guard'
import {
  CreateSeasonInput,
  createSeasonSchema,
  SeasonDto,
  seasonSchema,
  seasonsSchema,
  UpdateSeasonInput,
  updateSeasonSchema,
} from './contracts/season.contract'
import { SeasonMapper } from './season.mapper'
import { SeasonService } from './season.service'

@TypedController('clubs/:organizationId/seasons', undefined, { tags: ['Seasons'] })
@UseGuards(AuthGuard)
export class SeasonController {
  constructor(
    private readonly seasonService: SeasonService,
    private readonly seasonMapper: SeasonMapper,
  ) {}

  @TypedRoute.Post('', seasonSchema)
  async create(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('organizationId', z.string().uuid()) organizationId: string,
    @TypedBody(createSeasonSchema) body: CreateSeasonInput,
  ): Promise<SeasonDto> {
    const season = await this.seasonService.create(organizationId, session.user.id, body)
    return this.seasonMapper.toDto(season)
  }

  @TypedRoute.Get('', seasonsSchema)
  async list(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('organizationId', z.string().uuid()) organizationId: string,
  ): Promise<SeasonDto[]> {
    const seasons = await this.seasonService.list(organizationId, session.user.id)
    return this.seasonMapper.toDtos(seasons)
  }

  @TypedRoute.Get(':seasonId', seasonSchema)
  async get(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('organizationId', z.string().uuid()) organizationId: string,
    @TypedParam('seasonId', z.string().uuid()) seasonId: string,
  ): Promise<SeasonDto> {
    const season = await this.seasonService.get(organizationId, session.user.id, seasonId)
    return this.seasonMapper.toDto(season)
  }

  @TypedRoute.Patch(':seasonId', seasonSchema)
  async update(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('organizationId', z.string().uuid()) organizationId: string,
    @TypedParam('seasonId', z.string().uuid()) seasonId: string,
    @TypedBody(updateSeasonSchema) body: UpdateSeasonInput,
  ): Promise<SeasonDto> {
    const season = await this.seasonService.update(organizationId, session.user.id, seasonId, body)
    return this.seasonMapper.toDto(season)
  }
}

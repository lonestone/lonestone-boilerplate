import { TypedBody, TypedController, TypedParam, TypedRoute } from '@lonestone/nzoth/server'
import { UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { LoggedInBetterAuthSession } from '../auth/auth.config'
import { Session } from '../auth/auth.decorator'
import { AuthGuard } from '../auth/auth.guard'
import {
  CreateMatchMessageInput,
  createMatchMessageSchema,
  MatchMessageDto,
  matchMessageSchema,
  matchMessagesSchema,
} from './contracts/chat.contract'
import { ChatService } from './chat.service'

@TypedController('clubs/:organizationId/matches/:matchId/messages', undefined, { tags: ['Chat'] })
@UseGuards(AuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @TypedRoute.Get('', matchMessagesSchema)
  async list(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('organizationId', z.string().uuid()) organizationId: string,
    @TypedParam('matchId', z.string().uuid()) matchId: string,
  ): Promise<MatchMessageDto[]> {
    return this.chatService.list(organizationId, session.user.id, matchId)
  }

  @TypedRoute.Post('', matchMessageSchema)
  async post(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('organizationId', z.string().uuid()) organizationId: string,
    @TypedParam('matchId', z.string().uuid()) matchId: string,
    @TypedBody(createMatchMessageSchema) body: CreateMatchMessageInput,
  ): Promise<MatchMessageDto> {
    return this.chatService.post(organizationId, session.user.id, matchId, body)
  }
}

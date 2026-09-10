import { EntityManager } from '@mikro-orm/core'
import { Injectable, NotFoundException } from '@nestjs/common'
import { User } from '../auth/entities/user.entity'
import { OrganizationService } from '../auth/organization.service'
import { Match } from '../matches/match.entity'
import { NotificationService } from '../notifications/notification.service'
import { CreateMatchMessageInput, MatchMessageDto } from './contracts/chat.contract'
import { MatchMessage } from './match-message.entity'
import { MessageMention } from './message-mention.entity'

@Injectable()
export class ChatService {
  constructor(
    private readonly em: EntityManager,
    private readonly organizationService: OrganizationService,
    private readonly notificationService: NotificationService,
  ) {}

  async list(organizationId: string, userId: string, matchId: string): Promise<MatchMessageDto[]> {
    await this.organizationService.requireMember(organizationId, userId)
    const messages = await this.em.find(
      MatchMessage,
      { match: { id: matchId, organization: { id: organizationId } } },
      { populate: ['author', 'match'], orderBy: { createdAt: 'ASC' } },
    )
    return this.toDtos(messages)
  }

  async post(
    organizationId: string,
    userId: string,
    matchId: string,
    data: CreateMatchMessageInput,
  ): Promise<MatchMessageDto> {
    await this.organizationService.requireMember(organizationId, userId)
    const match = await this.em.findOne(
      Match,
      { id: matchId, organization: { id: organizationId } },
      { populate: ['organization'] },
    )
    if (!match) throw new NotFoundException('Match not found')
    const author = await this.em.findOne(User, { id: userId })
    if (!author) throw new NotFoundException('User not found')

    const message = new MatchMessage()
    message.match = match
    message.author = author
    message.body = data.body
    this.em.persist(message)

    const mentionedIds = data.mentionedUserIds ?? this.extractMentions(data.body)
    for (const mentionedId of mentionedIds) {
      const mentioned = await this.em.findOne(User, { id: mentionedId })
      if (!mentioned) continue
      const mention = new MessageMention()
      mention.message = message
      mention.mentionedUser = mentioned
      this.em.persist(mention)
    }

    await this.em.flush()
    await this.notificationService.notifyChatMessage(match, author, data.body, mentionedIds)
    const saved = await this.em.findOneOrFail(
      MatchMessage,
      { id: message.id },
      { populate: ['author', 'match'] },
    )
    const [dto] = await this.toDtos([saved])
    return dto
  }

  private async toDtos(messages: MatchMessage[]): Promise<MatchMessageDto[]> {
    if (messages.length === 0) return []
    const ids = messages.map((m) => m.id)
    const mentions = await this.em.find(
      MessageMention,
      { message: { id: { $in: ids } } },
      { populate: ['mentionedUser', 'message'] },
    )
    const byMessage = new Map<string, string[]>()
    for (const mention of mentions) {
      const list = byMessage.get(mention.message.id) ?? []
      list.push(mention.mentionedUser.id)
      byMessage.set(mention.message.id, list)
    }
    return messages.map((m) => ({
      id: m.id,
      matchId: m.match.id,
      authorId: m.author.id,
      authorName: m.author.name,
      body: m.body,
      mentionedUserIds: byMessage.get(m.id) ?? [],
      createdAt: m.createdAt,
    }))
  }

  private extractMentions(body: string): string[] {
    const matches = body.match(/@([0-9a-f-]{36})/gi) ?? []
    return [...new Set(matches.map((m) => m.slice(1)))]
  }
}

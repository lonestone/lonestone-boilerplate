import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'
import { User } from '../auth/entities/user.entity'
import { MatchMessage } from './match-message.entity'

@Entity({ tableName: 'message_mention' })
export class MessageMention {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => MatchMessage, { fieldName: 'messageId', deleteRule: 'cascade' })
  message!: MatchMessage

  @ManyToOne(() => User, { fieldName: 'mentionedUserId', deleteRule: 'cascade' })
  mentionedUser!: User

  @Property()
  createdAt: Date = new Date()
}

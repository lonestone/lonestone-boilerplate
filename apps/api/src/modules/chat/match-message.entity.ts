import {
  Entity,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy'
import { User } from '../auth/entities/user.entity'
import { Match } from '../matches/match.entity'

@Entity({ tableName: 'match_message' })
export class MatchMessage {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => Match, { fieldName: 'matchId', deleteRule: 'cascade' })
  @Index()
  match!: Match

  @ManyToOne(() => User, { fieldName: 'authorId', deleteRule: 'cascade' })
  author!: User

  @Property({ type: 'text' })
  body!: string

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

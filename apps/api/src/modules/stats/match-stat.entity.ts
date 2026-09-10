import { Entity, Index, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'
import { User } from '../auth/entities/user.entity'
import { Match } from '../matches/match.entity'

@Entity({ tableName: 'match_stat' })
@Unique({ properties: ['match', 'user'] })
export class MatchStat {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => Match, { fieldName: 'matchId', deleteRule: 'cascade' })
  @Index()
  match!: Match

  @ManyToOne(() => User, { fieldName: 'userId', deleteRule: 'cascade' })
  user!: User

  @Property({ default: 0 })
  goals: number = 0

  @Property({ default: 0 })
  assists: number = 0

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

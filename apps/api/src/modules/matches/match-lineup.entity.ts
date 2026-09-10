import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'
import { User } from '../auth/entities/user.entity'
import { TeamSide } from './contracts/match.contract'
import { Match } from './match.entity'

@Entity({ tableName: 'match_lineup' })
@Unique({ properties: ['match', 'user'] })
export class MatchLineup {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => Match, { fieldName: 'matchId', deleteRule: 'cascade' })
  @Index()
  match!: Match

  @ManyToOne(() => User, { fieldName: 'userId', deleteRule: 'cascade' })
  user!: User

  @Enum({ items: () => TeamSide })
  team!: TeamSide

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

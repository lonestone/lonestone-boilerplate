import { Entity, Index, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'
import { Match } from '../matches/match.entity'

/** Per-match cost configuration (pitch + extras), split across present players. */
@Entity({ tableName: 'match_cost' })
@Unique({ properties: ['match'] })
export class MatchCost {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => Match, { fieldName: 'matchId', deleteRule: 'cascade' })
  @Index()
  match!: Match

  /** Pitch / venue cost in cents */
  @Property({ default: 0 })
  pitchCostCents: number = 0

  /** Extra (balls, bibs, etc.) in cents */
  @Property({ default: 0 })
  extrasCostCents: number = 0

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

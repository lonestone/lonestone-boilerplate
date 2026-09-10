import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'
import { User } from '../auth/entities/user.entity'
import { Match } from '../matches/match.entity'
import { FeeStatus } from './contracts/payment.contract'

@Entity({ tableName: 'session_fee' })
@Unique({ properties: ['match', 'user'] })
export class SessionFee {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => Match, { fieldName: 'matchId', deleteRule: 'cascade' })
  @Index()
  match!: Match

  @ManyToOne(() => User, { fieldName: 'userId', deleteRule: 'cascade' })
  user!: User

  /** Amount in cents (EUR) */
  @Property()
  amountCents!: number

  @Enum({ items: () => FeeStatus, default: FeeStatus.Owed })
  status: FeeStatus = FeeStatus.Owed

  @Property({ fieldName: 'paidAt', nullable: true })
  paidAt?: Date

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

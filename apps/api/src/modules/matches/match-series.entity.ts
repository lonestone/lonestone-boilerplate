import {
  Entity,
  Enum,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy'
import { Organization } from '../auth/entities/organization.entity'
import { User } from '../auth/entities/user.entity'
import { Season } from '../seasons/season.entity'
import { RecurrenceFrequency } from './contracts/match.contract'

@Entity({ tableName: 'match_series' })
export class MatchSeries {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => Organization, { fieldName: 'organizationId', deleteRule: 'cascade' })
  @Index()
  organization!: Organization

  @ManyToOne(() => Season, { fieldName: 'seasonId', deleteRule: 'cascade' })
  season!: Season

  @Property()
  title!: string

  @Property({ nullable: true })
  location?: string

  @Property({ fieldName: 'maxCapacity' })
  maxCapacity!: number

  @Enum({ items: () => RecurrenceFrequency })
  frequency!: RecurrenceFrequency

  @Property({ nullable: true })
  rrule?: string

  @Property({ fieldName: 'startsAt' })
  startsAt!: Date

  @Property({ fieldName: 'endsAt', nullable: true })
  endsAt?: Date

  @Property({ type: 'json', nullable: true })
  reminderOffsetsHours?: number[]

  @ManyToOne(() => User, { fieldName: 'createdById' })
  createdBy!: User

  @Property()
  createdAt: Date = new Date()
}

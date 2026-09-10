import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'
import { Match } from '../matches/match.entity'
import { ScheduledJobStatus, ScheduledJobType } from './contracts/notification.contract'

@Entity({ tableName: 'scheduled_job' })
export class ScheduledJob {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Enum({ items: () => ScheduledJobType })
  type!: ScheduledJobType

  @ManyToOne(() => Match, { fieldName: 'matchId', deleteRule: 'cascade' })
  @Index()
  match!: Match

  @Property({ fieldName: 'runAt' })
  @Index()
  runAt!: Date

  @Enum({ items: () => ScheduledJobStatus, default: ScheduledJobStatus.Pending })
  status: ScheduledJobStatus = ScheduledJobStatus.Pending

  @Property({ type: 'json', nullable: true })
  payload?: Record<string, unknown>

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

import { Entity, Enum, Index, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'
import { User } from '../auth/entities/user.entity'
import { AttendanceStatus } from './contracts/match.contract'
import { Match } from './match.entity'

@Entity({ tableName: 'match_attendance' })
@Unique({ properties: ['match', 'user'] })
export class MatchAttendance {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => Match, { fieldName: 'matchId', deleteRule: 'cascade' })
  @Index()
  match!: Match

  @ManyToOne(() => User, { fieldName: 'userId', deleteRule: 'cascade' })
  @Index()
  user!: User

  @Enum({ items: () => AttendanceStatus, default: AttendanceStatus.Pending })
  status: AttendanceStatus = AttendanceStatus.Pending

  @Property({ fieldName: 'respondedAt', nullable: true })
  respondedAt?: Date

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

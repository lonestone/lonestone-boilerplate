import {
  Entity,
  Enum,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy'
import { Organization } from '../auth/entities/organization.entity'
import { SeasonStatus } from './contracts/season.contract'

@Entity({ tableName: 'season' })
export class Season {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => Organization, { fieldName: 'organizationId', deleteRule: 'cascade' })
  @Index()
  organization!: Organization

  @Property()
  name!: string

  @Property({ fieldName: 'startsAt', type: 'date' })
  startsAt!: Date

  @Property({ fieldName: 'endsAt', type: 'date', nullable: true })
  endsAt?: Date

  @Enum({ items: () => SeasonStatus, default: SeasonStatus.Active })
  status: SeasonStatus = SeasonStatus.Active

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

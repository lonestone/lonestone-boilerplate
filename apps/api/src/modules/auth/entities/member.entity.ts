import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'
import { Organization } from './organization.entity'
import { User } from './user.entity'

export type ClubRole = 'owner' | 'admin' | 'member'

@Entity({ tableName: 'member' })
export class Member {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => User, { fieldName: 'userId', deleteRule: 'cascade' })
  user!: User

  @ManyToOne(() => Organization, { fieldName: 'organizationId', deleteRule: 'cascade' })
  organization!: Organization

  @Property({ default: 'member' })
  role: ClubRole = 'member'

  @Property({ fieldName: 'createdAt' })
  createdAt: Date = new Date()
}

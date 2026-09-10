import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'
import { Organization } from './organization.entity'
import { User } from './user.entity'

@Entity({ tableName: 'invitation' })
export class Invitation {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property()
  email!: string

  @ManyToOne(() => User, { fieldName: 'inviterId' })
  inviter!: User

  @ManyToOne(() => Organization, { fieldName: 'organizationId', deleteRule: 'cascade' })
  organization!: Organization

  @Property()
  role!: string

  @Property()
  status!: string

  @Property({ fieldName: 'expiresAt' })
  expiresAt!: Date

  @Property({ fieldName: 'createdAt' })
  createdAt: Date = new Date()

  @Property({ nullable: true })
  token?: string
}

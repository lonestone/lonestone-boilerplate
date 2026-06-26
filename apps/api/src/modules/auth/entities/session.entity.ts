import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'
import { User } from './user.entity'

@Entity({ tableName: 'session' })
export class Session {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property()
  expiresAt!: Date

  @Property()
  @Unique()
  token!: string

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ nullable: true })
  ipAddress?: string

  @Property({ nullable: true })
  userAgent?: string

  @ManyToOne(() => User, { fieldName: 'userId' })
  user!: User
}

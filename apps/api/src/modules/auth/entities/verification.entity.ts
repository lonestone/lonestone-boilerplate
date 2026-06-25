import {
  Entity,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy'

@Entity({ tableName: 'verification' })
export class Verification {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property()
  identifier!: string

  @Property()
  value!: string

  @Property()
  expiresAt!: Date

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

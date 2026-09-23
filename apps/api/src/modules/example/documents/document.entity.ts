import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'
import { User } from '../../auth/auth.entity'

@Entity({ tableName: 'document' })
export class Document {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => User, { fieldName: 'ownerId' })
  @Index()
  owner!: User

  @Property()
  storageKey!: string

  @Property()
  filename!: string

  @Property()
  mimeType!: string

  @Property()
  size!: number

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

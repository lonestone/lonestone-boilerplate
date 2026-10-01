import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'

@Entity({ tableName: 'media' })
export class Media {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Unique()
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

import type { Rel } from '@mikro-orm/core'
import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'
import { Post } from './post.entity'

export interface Content {
  type: 'text' | 'image' | 'video'
  data: string
}

@Entity({ tableName: 'postVersion' })
export class PostVersion {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  // Rel<> keeps the decorator metadata from reading Post while the two files
  // import each other.
  @ManyToOne(() => Post, { fieldName: 'postId' })
  post!: Rel<Post>

  @Property()
  @Index()
  title!: string

  @Property({ type: 'json' })
  content?: Content[]

  @Property()
  createdAt: Date = new Date()
}

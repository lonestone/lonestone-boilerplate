import { Collection } from '@mikro-orm/core'
import {
  Entity,
  Index,
  ManyToMany,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy'
import { Post } from '../posts/posts.entity'

@Entity({ tableName: 'tag' })
export class Tag {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property()
  @Unique()
  @Index()
  name!: string

  @Property()
  @Unique()
  @Index()
  slug!: string

  @ManyToMany(() => Post, (post) => post.tags)
  posts = new Collection<Post>(this)
}

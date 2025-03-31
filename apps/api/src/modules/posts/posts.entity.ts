import {
  Collection,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/core'
import { User } from '../auth/auth.entity'
import { Comment } from '../comments/comments.entity'

export interface Content {
  type: 'text' | 'image' | 'video'
  data: string
}

@Entity({ tableName: 'post' })
export class Post {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => User, { fieldName: 'userId' })
  @Index()
  user!: User

  @Property({ fieldName: 'createdAt' })
  createdAt: Date = new Date()

  @Property({ fieldName: 'updatedAt', onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ fieldName: 'publishedAt', nullable: true })
  @Index()
  publishedAt?: Date

  @OneToMany(() => PostVersion, version => version.post)
  versions = new Collection<PostVersion>(this)

  @OneToMany(() => Comment, comment => comment.post)
  comments = new Collection<Comment>(this)

  @Unique()
  @Property({ fieldName: 'slug', nullable: true })
  @Index()
  slug?: string

  async currentVersion() {
    if (this.publishedAt) {
      return this.versions.getItems()[this.versions.getItems().length - 1]
    }

    return null
  }
}

@Entity({ tableName: 'postVersion' })
export class PostVersion {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => Post, { fieldName: 'postId' })
  post!: Post

  @Property()
  @Index()
  title!: string

  @Property({ type: 'json' })
  content?: Content[]

  @Property({ fieldName: 'createdAt' })
  createdAt: Date = new Date()
}

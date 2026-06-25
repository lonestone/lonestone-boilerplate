import { Collection } from '@mikro-orm/core'
import {
  Entity,
  Index,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy'
import { User } from '../../auth/auth.entity'
import { Comment } from '../../example/comments/comments.entity'
import { Tag } from '../../example/tags/tag.entity'

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

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ nullable: true })
  @Index()
  publishedAt?: Date

  @OneToMany(() => PostVersion, version => version.post)
  versions = new Collection<PostVersion>(this)

  @OneToMany(() => Comment, comment => comment.post)
  comments = new Collection<Comment>(this)

  @Unique()
  @Property({ nullable: true })
  @Index()
  slug?: string

  @Property({ nullable: true })
  coverImage?: string

  @Property({ default: 0 })
  likesCount: number = 0

  @ManyToMany(() => Tag, tag => tag.posts, { owner: true, pivotTable: 'post_tag' })
  tags = new Collection<Tag>(this)

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

  @Property()
  createdAt: Date = new Date()
}

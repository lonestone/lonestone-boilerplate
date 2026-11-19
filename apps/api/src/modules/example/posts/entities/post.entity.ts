import { Collection } from '@mikro-orm/core'
import {
  Entity,
  Index,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy'
import { User } from '../../../auth/auth.entity'
import { Media } from '../../../media/media.entity'
import { Comment } from '../../comments/comments.entity'
import { Tag } from '../../tags/tag.entity'
import { PostVersion } from './post-version.entity'

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

  @OneToMany(() => PostVersion, (version) => version.post)
  versions = new Collection<PostVersion>(this)

  @OneToMany(() => Comment, (comment) => comment.post)
  comments = new Collection<Comment>(this)

  @Unique()
  @Property({ nullable: true })
  @Index()
  slug?: string

  @OneToOne(() => Media, { owner: true, nullable: true, fieldName: 'coverImageId' })
  coverImage?: Media

  @Property({ default: 0 })
  likesCount: number = 0

  @ManyToMany(() => Tag, (tag) => tag.posts, { owner: true, pivotTable: 'post_tag' })
  tags = new Collection<Tag>(this)

  async currentVersion() {
    if (this.publishedAt) {
      return this.versions.getItems()[this.versions.getItems().length - 1]
    }

    return null
  }
}

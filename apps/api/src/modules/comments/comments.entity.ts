import {
  Collection,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/core'
import { User } from '../auth/auth.entity'
import { Post } from '../posts/posts.entity'

@Entity({ tableName: 'comment' })
export class Comment {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @ManyToOne(() => Post, { fieldName: 'postId' })
  @Index()
  post!: Post

  @ManyToOne(() => User, { fieldName: 'userId', nullable: true })
  @Index()
  user?: User

  @Property()
  content!: string

  @Property({ nullable: true })
  authorName?: string

  @Property({ fieldName: 'createdAt' })
  createdAt: Date = new Date()

  @ManyToOne(() => Comment, { fieldName: 'parentId', nullable: true })
  @Index()
  parent?: Comment

  @OneToMany(() => Comment, comment => comment.parent)
  replies = new Collection<Comment>(this)
}

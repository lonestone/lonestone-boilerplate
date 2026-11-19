import { faker } from '@faker-js/faker'
import type { EntityData } from '@mikro-orm/core'
import { Factory } from '@mikro-orm/seeder'
import { Comment } from './comments.entity'

/**
 * Builds a top-level comment.
 * The post is required and never invented: pass `{ post }`.
 * Pass `{ user }` for a member's comment, or `{ authorName }` for an anonymous one.
 */
export class CommentFactory extends Factory<Comment> {
  model = Comment

  protected definition(): EntityData<Comment> {
    return {
      content: faker.lorem.sentence(),
    }
  }
}

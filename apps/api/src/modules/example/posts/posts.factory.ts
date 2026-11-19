import { faker } from '@faker-js/faker'
import type { EntityData } from '@mikro-orm/core'
import { Factory } from '@mikro-orm/seeder'
import { Post, PostVersion } from './posts.entity'

/**
 * Builds a draft post without a cover image: the image is a stored `Media`, not a URL.
 * The owner is required and never invented: pass `{ user }`.
 * A post has no title of its own; add a version with `PostVersionFactory`.
 */
export class PostFactory extends Factory<Post> {
  model = Post

  protected definition(): EntityData<Post> {
    return {}
  }
}

/**
 * Builds a post version with a title and one text block.
 * The post is required and never invented: pass `{ post }`.
 */
export class PostVersionFactory extends Factory<PostVersion> {
  model = PostVersion

  protected definition(): EntityData<PostVersion> {
    return {
      title: faker.lorem.sentence({ min: 3, max: 6 }),
      content: [{ type: 'text', data: faker.lorem.paragraphs(2) }],
    }
  }
}

/* oxlint-disable no-console */

import { Dictionary, EntityManager } from '@mikro-orm/core'
import { Seeder } from '@mikro-orm/seeder'
import { CommentSeeder } from '../modules/example/comments/comment.seeder'
import { PostSeeder } from '../modules/example/posts/post.seeder'
import { TagSeeder } from '../modules/example/tags/tag.seeder'
import { AuthSeeder } from './auth.seeder'

export class DatabaseSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    const context: Dictionary = {}

    await new AuthSeeder().run(em, context)
    console.info('AuthSeeder done')

    await new TagSeeder().run(em, context)
    console.info('TagSeeder done')

    await new PostSeeder().run(em, context)
    console.info('PostSeeder done')

    await new CommentSeeder().run(em, context)
    console.info('CommentSeeder done')
  }
}

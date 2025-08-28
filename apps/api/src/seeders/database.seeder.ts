/* eslint-disable no-console */

import { Dictionary, EntityManager } from '@mikro-orm/core'
import { Seeder } from '@mikro-orm/seeder'
import { AuthSeeder } from './auth.seeder'
import { CommentSeeder } from './comment.seeder'
import { PostSeeder } from './post.seeder'

export class DatabaseSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    const context: Dictionary = {}

    // Run AuthSeeder first to create users
    await new AuthSeeder().run(em, context)
    console.info('AuthSeeder done')

    // Run PostSeeder to create posts
    await new PostSeeder().run(em, context)
    console.info('PostSeeder done')

    // Run CommentSeeder to create comments
    await new CommentSeeder().run(em, context)
    console.info('CommentSeeder done')
  }
}

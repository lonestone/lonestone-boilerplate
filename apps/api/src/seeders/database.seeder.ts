import { EntityManager } from '@mikro-orm/core'
import { Seeder } from '@mikro-orm/seeder'
import { AuthSeeder } from './auth.seeder'
import { PostSeeder } from './post.seeder'
import { CommentSeeder } from './comment.seeder'

export class DatabaseSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    return this.call(em, [AuthSeeder, PostSeeder, CommentSeeder])
  }
}

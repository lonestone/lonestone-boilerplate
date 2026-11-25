import { EntityManager } from '@mikro-orm/core'
import { Seeder } from '@mikro-orm/seeder'
import { createUserData } from '../modules/auth/auth.factory'
import { CommentFactory } from '../modules/example/comments/comments.factory'
import { PostFactory, PostVersionFactory } from '../modules/example/posts/posts.factory'

/**
 * MinimalSeeder creates just a single user with a single post for quick testing
 */
export class MinimalSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    const user = await createUserData(em, {
      name: 'Test User',
      email: 'test@example.com',
      emailVerified: true,
    })

    const post = new PostFactory(em).makeOne({ user })
    new PostVersionFactory(em).makeOne({
      post,
      title: 'Test Post',
      content: [{ type: 'text', data: 'This is a test post content.' }],
    })
    new CommentFactory(em).makeOne({ post, user, content: 'This is a test comment.' })

    await em.flush()
  }
}

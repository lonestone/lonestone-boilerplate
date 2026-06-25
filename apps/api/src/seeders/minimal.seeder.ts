import { EntityManager } from '@mikro-orm/core'
import { Seeder } from '@mikro-orm/seeder'
import { createUserData } from '../modules/auth/auth.factory'
import { Comment } from '../modules/example/comments/comments.entity'
import { Post, PostVersion } from '../modules/example/posts/posts.entity'

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

    const post = new Post()
    post.user = user
    post.createdAt = new Date()

    const postVersion = new PostVersion()
    postVersion.post = post
    postVersion.createdAt = post.createdAt
    postVersion.title = 'Test Post'
    postVersion.content = [
      {
        type: 'text',
        data: 'This is a test post content.',
      },
    ]
    post.versions.add(postVersion)

    const comment = new Comment()
    comment.post = post
    comment.user = user
    comment.content = 'This is a test comment.'

    await em.persist([post, postVersion, comment]).flush()
  }
}

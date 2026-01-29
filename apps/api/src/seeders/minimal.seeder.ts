import { EntityManager } from '@mikro-orm/core'
import { Seeder } from '@mikro-orm/seeder'
import { hashPassword } from 'better-auth/crypto'
import { Account, User } from '../modules/auth/auth.entity'
import { Comment } from '../modules/example/comments/comments.entity'
import { Post, PostVersion } from '../modules/example/posts/posts.entity'

/**
 * MinimalSeeder creates just a single user with a single post for quick testing
 */
export class MinimalSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    // Create user
    const user = new User()
    user.name = 'Test User'
    user.email = 'test@example.com'
    user.emailVerified = true
    await em.persist(user).flush()

    // Create account with password
    const account = new Account()
    account.user = user
    account.providerId = 'credential'
    account.accountId = crypto.randomUUID()
    account.password = await hashPassword('Password123!')
    await em.persist(account).flush()

    // Create post
    const post = new Post()
    post.user = user
    post.createdAt = new Date()
    await em.persist(post).flush()

    // Create post version
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
    await em.persist(postVersion).flush()
    post.versions.add(postVersion)
    await em.persist(post).flush()

    // Create comment
    const comment = new Comment()
    comment.post = post
    comment.user = user
    comment.content = 'This is a test comment.'
    await em.persist(comment).flush()
  }
}

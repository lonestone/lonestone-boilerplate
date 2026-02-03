import { faker } from '@faker-js/faker'

import { Dictionary, EntityManager } from '@mikro-orm/core'
import { Seeder } from '@mikro-orm/seeder'
import { User } from '../../auth/auth.entity'
import { Post } from '../posts/posts.entity'
import { Comment } from './comments.entity'

function generateNumberOfComments(max: number) {
  return faker.number.int({ min: 0, max })
}

function generateBoolean() {
  return faker.number.int({ min: 0, max: 1 }) === 0
}

async function createComment(post: Post, users: User[], em: EntityManager, parentComment?: Comment, depth: number = 0, maxDepth: number = 2): Promise<Comment> {
  const comment = new Comment()
  comment.post = post

  // Fix the type issue by ensuring the user object is compatible
  const randomUser: User = faker.helpers.arrayElement(users as User[])
  comment.user = generateBoolean() ? randomUser : undefined

  comment.content = faker.lorem.paragraph()

  if (parentComment) {
    comment.parent = parentComment
  }

  await em.persist(comment).flush()

  // Generate child comments with decreasing probability based on depth
  if (depth < maxDepth) {
    const maxChildComments = Math.max(2 - depth, 0) // Decrease max comments as depth increases
    const numberOfChildComments = generateNumberOfComments(maxChildComments)

    for (let i = 0; i < numberOfChildComments; i++) {
      await createComment(post, users, em, comment, depth + 1, maxDepth)
    }
  }

  return comment
}

export class CommentSeeder extends Seeder {
  async run(em: EntityManager, context: Dictionary): Promise<void> {
    const posts = context.posts
    const users = context.users

    for (const post of posts) {
      const numberOfComments = generateNumberOfComments(3)
      for (let i = 0; i < numberOfComments; i++) {
        // Create top-level comments only, child comments will be created recursively
        await createComment(post, users, em)
      }
    }
  }
}

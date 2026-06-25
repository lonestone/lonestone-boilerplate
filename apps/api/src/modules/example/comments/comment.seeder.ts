import { faker } from '@faker-js/faker'

import { Dictionary, EntityManager } from '@mikro-orm/core'
import { Seeder } from '@mikro-orm/seeder'
import { User } from '../../auth/auth.entity'
import { Post } from '../posts/posts.entity'
import { Comment } from './comments.entity'

const TOP_LEVEL_COMMENTS = [
  'Great write-up — exactly the kind of deep dive I was looking for.',
  'We ran into the same issue last quarter. The approach you describe here worked for us too.',
  'Do you have benchmarks comparing this to the naive approach? Would love to see the numbers.',
  'Minor nit: paragraph three has a typo, but the content itself is solid.',
  'Bookmarked. Coming back to this once we migrate our auth layer.',
  'I disagree with the conclusion in the last section, but the reasoning up to that point is sound.',
  'Thanks for the clear examples — the code snippets made this much easier to follow.',
  'Has anyone tried this with a multi-region setup? Curious how latency changes.',
]

const REPLY_COMMENTS = [
  'Good point — I will add a follow-up section covering that.',
  'Yes, we saw roughly a 40% reduction in cold-start time with this approach.',
  'Thanks for catching that! Fixed.',
  'We tested it with two regions and the experience was acceptable under ~200ms round-trip.',
  'Fair criticism. I simplified in the interest of keeping the post readable.',
  'Agreed — there are trade-offs I glossed over. Happy to discuss in more detail.',
]

function pickComment(pool: string[]): string {
  return faker.helpers.arrayElement(pool)
}

async function createComment(
  post: Post,
  users: User[],
  em: EntityManager,
  parentComment?: Comment,
  depth: number = 0,
  maxDepth: number = 2,
): Promise<Comment> {
  const comment = new Comment()
  comment.post = post

  const randomUser: User = faker.helpers.arrayElement(users as User[])
  comment.user = faker.datatype.boolean(0.7) ? randomUser : undefined

  comment.content = depth === 0
    ? pickComment(TOP_LEVEL_COMMENTS)
    : pickComment(REPLY_COMMENTS)

  if (parentComment) {
    comment.parent = parentComment
  }

  await em.persist(comment).flush()

  if (depth < maxDepth) {
    const maxChildComments = Math.max(2 - depth, 0)
    const numberOfChildComments = faker.number.int({ min: 0, max: maxChildComments })

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
      if (!post.publishedAt)
        continue

      const numberOfComments = faker.number.int({ min: 0, max: 4 })
      for (let i = 0; i < numberOfComments; i++) {
        await createComment(post, users, em)
      }
    }
  }
}

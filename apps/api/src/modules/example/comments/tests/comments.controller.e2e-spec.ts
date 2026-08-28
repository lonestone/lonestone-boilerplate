import { EntityManager } from '@mikro-orm/core'
import { beforeEach, describe, expect, it } from 'vitest'
/**
 * E2E Tests for CommentsController
 *
 * Tests the following endpoints:
 * - PATCH /posts/:postSlug/comments/:commentId - Update a comment (author only)
 * - Auth guard behavior (401 when unauthenticated)
 */
import type { BetterAuthSession } from '../../../auth/auth.config'
import type { User } from '../../../auth/auth.entity'
import { initializeTestApp } from '../../../../test/helpers/test-app.helper'
import { createRequest, TestRequest } from '../../../../test/helpers/test-auth.helper'
import { createUserWithSession } from '../../../../test/helpers/test-user.helpers'
import { Post } from '../../posts/posts.entity'
import { PostModule } from '../../posts/posts.module'
import { CommentsModule } from '../comments.module'
import { Comment } from '../comments.entity'

async function createPublishedPost(
  request: TestRequest,
  session: BetterAuthSession,
  title: string,
): Promise<{ slug: string }> {
  const createResponse = await request
    .withSession(session)
    .post('/admin/posts')
    .send({
      title,
      content: [{ type: 'text', data: 'Post body' }],
    })
  const postId = createResponse.body.id as string
  const publishResponse = await request.withSession(session).patch(`/admin/posts/${postId}/publish`)
  return { slug: publishResponse.body.slug as string }
}

async function createCommentOnPost(
  em: EntityManager,
  slug: string,
  content: string,
  user?: User,
): Promise<Comment> {
  const post = await em.findOneOrFail(Post, { slug })
  const comment = new Comment()
  comment.post = post
  comment.content = content
  if (user) {
    comment.user = user
  } else {
    comment.authorName = 'Anonymous'
  }
  em.persist(comment)
  await em.flush()
  return comment
}

describe('commentsController (e2e)', () => {
  beforeEach(async (context) => {
    const { orm, app } = await initializeTestApp(
      { orm: context.orm },
      {
        imports: [PostModule, CommentsModule],
      },
    )
    context.app = app
    context.em = orm.em.fork()
    context.request = createRequest(app)
  })

  describe('pATCH /posts/:postSlug/comments/:commentId', () => {
    it('should update the comment when the author is authenticated', async (context) => {
      const { em, request } = context
      const { user, session } = await createUserWithSession(em)
      const { slug } = await createPublishedPost(request, session, 'Author Post')
      const comment = await createCommentOnPost(em, slug, 'Original comment', user)

      const response = await request
        .withSession(session)
        .patch(`/posts/${slug}/comments/${comment.id}`)
        .send({ content: 'Updated comment' })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        id: comment.id,
        content: 'Updated comment',
      })
    })

    it('should return 403 when another user tries to update the comment', async (context) => {
      const { em, request } = context
      const { user: author, session: authorSession } = await createUserWithSession(em, {
        name: 'Author',
      })
      const { session: otherSession } = await createUserWithSession(em, { name: 'Other' })
      const { slug } = await createPublishedPost(request, authorSession, 'Shared Post')
      const comment = await createCommentOnPost(em, slug, 'Author comment', author)

      const response = await request
        .withSession(otherSession)
        .patch(`/posts/${slug}/comments/${comment.id}`)
        .send({ content: 'Hijacked comment' })

      expect(response.status).toBe(403)
    })

    it('should return 403 when updating an anonymous comment', async (context) => {
      const { em, request } = context
      const { session } = await createUserWithSession(em)
      const { slug } = await createPublishedPost(request, session, 'Anonymous Post')
      const comment = await createCommentOnPost(em, slug, 'Anonymous comment')

      const response = await request
        .withSession(session)
        .patch(`/posts/${slug}/comments/${comment.id}`)
        .send({ content: 'Edited anonymous comment' })

      expect(response.status).toBe(403)
    })

    it('should return 401 when unauthenticated', async (context) => {
      const { em, request } = context
      const { user, session } = await createUserWithSession(em)
      const { slug } = await createPublishedPost(request, session, 'Guard Post')
      const comment = await createCommentOnPost(em, slug, 'Original comment', user)

      const response = await request.patch(`/posts/${slug}/comments/${comment.id}`).send({
        content: 'Updated comment',
      })

      expect(response.status).toBe(401)
    })
  })
})

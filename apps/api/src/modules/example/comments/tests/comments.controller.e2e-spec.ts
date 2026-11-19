import type { EntityManager } from '@mikro-orm/core'
import { beforeEach, describe, expect, it } from 'vitest'
/**
 * E2E Tests for CommentsController
 *
 * Tests the following endpoints:
 * - PATCH /posts/:postSlug/comments/:commentId - Update a comment (author only)
 * - Auth guard behavior (401 when unauthenticated)
 */
import type { User } from '../../../auth/auth.entity'
import { createUserData } from '../../../auth/auth.factory'
import { initializeTestApp } from '../../../../test/helpers/test-app.helper'
import { createRequest } from '../../../../test/helpers/test-auth.helper'
import { createUserWithSession } from '../../../../test/helpers/test-user.helpers'
import type { Post } from '../../posts/posts.entity'
import { PostFactory, PostVersionFactory } from '../../posts/posts.factory'
import { PostModule } from '../../posts/posts.module'
import { CommentsModule } from '../comments.module'
import { CommentFactory } from '../comments.factory'

/** Persists a published post owned by `user`, reachable at `/posts/<slug>`. */
function makePublishedPost(em: EntityManager, user: User, slug: string): Post {
  const post = new PostFactory(em).makeOne({ user, slug })
  new PostVersionFactory(em).makeOne({ post })
  // Publish after the version exists: public pages only show versions written before publication.
  post.publishedAt = new Date()
  return post
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
      const post = makePublishedPost(em, user, 'author-post')
      const comment = await new CommentFactory(em).createOne({ post, user })

      const response = await request
        .withSession(session)
        .patch(`/posts/${post.slug}/comments/${comment.id}`)
        .send({ content: 'Updated comment' })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        id: comment.id,
        content: 'Updated comment',
      })
    })

    it('should return 403 when another user tries to update the comment', async (context) => {
      const { em, request } = context
      const author = await createUserData(em, { name: 'Author' })
      const { session: otherSession } = await createUserWithSession(em, { name: 'Other' })
      const post = makePublishedPost(em, author, 'shared-post')
      const comment = await new CommentFactory(em).createOne({ post, user: author })

      const response = await request
        .withSession(otherSession)
        .patch(`/posts/${post.slug}/comments/${comment.id}`)
        .send({ content: 'Hijacked comment' })

      expect(response.status).toBe(403)
    })

    it('should return 403 when updating an anonymous comment', async (context) => {
      const { em, request } = context
      const { user, session } = await createUserWithSession(em)
      const post = makePublishedPost(em, user, 'anonymous-post')
      const comment = await new CommentFactory(em).createOne({ post, authorName: 'Anonymous' })

      const response = await request
        .withSession(session)
        .patch(`/posts/${post.slug}/comments/${comment.id}`)
        .send({ content: 'Edited anonymous comment' })

      expect(response.status).toBe(403)
    })

    it('should return 401 when unauthenticated', async (context) => {
      const { em, request } = context
      const user = await createUserData(em)
      const post = makePublishedPost(em, user, 'guard-post')
      const comment = await new CommentFactory(em).createOne({ post, user })

      const response = await request.patch(`/posts/${post.slug}/comments/${comment.id}`).send({
        content: 'Updated comment',
      })

      expect(response.status).toBe(401)
    })
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
/**
 * E2E Tests for PostController
 *
 * Tests the following endpoints:
 * - POST /admin/posts - Create a new post
 * - PATCH /admin/posts/:id/publish - Publish a post
 * - PATCH /admin/posts/:id/unpublish - Unpublish a post
 * - Auth guard behavior (401 when unauthenticated)
 */
import { initializeTestApp } from '../../../../test/helpers/test-app.helper'
import { createRequest } from '../../../../test/helpers/test-auth.helper'
import { createUserWithSession } from '../../../../test/helpers/test-user.helpers'
import { createUserData } from '../../../auth/auth.factory'
import { CreatePostInput } from '../contracts/posts.contract'
import { PostFactory, PostVersionFactory } from '../posts.factory'
import { PostModule } from '../posts.module'

describe('postController (e2e)', () => {
  beforeEach(async (context) => {
    const { orm, app } = await initializeTestApp(
      { orm: context.orm },
      {
        imports: [PostModule],
      },
    )
    context.app = app
    context.em = orm.em.fork()
    context.request = createRequest(app)
  })

  describe('pOST /admin/posts', () => {
    it('should create a post', async (context) => {
      const { em, request } = context
      // Arrange
      const { session } = await createUserWithSession(em)
      const createPostDto: CreatePostInput = {
        title: 'Test Post',
        content: [
          {
            type: 'text',
            data: 'This is a test post content',
          },
        ],
      }

      // Act
      const response = await request.withSession(session).post('/admin/posts').send(createPostDto)

      // Assert
      expect(response.body).toMatchObject({
        id: expect.any(String),
        title: 'Test Post',
        content: expect.any(Array),
        type: 'draft',
      })
    })

    it('should return 401 when unauthenticated', async (context) => {
      const { request } = context
      // Act - no session, unauthenticated request
      const response = await request.post('/admin/posts').send({
        title: 'Test Post',
        content: [{ type: 'text', data: 'content' }],
      })

      // Assert
      expect(response.status).toBe(401)
    })
  })

  describe('pATCH /admin/posts/:id/publish', () => {
    it('should publish a post', async (context) => {
      const { em, request } = context
      // Arrange - a draft post titled "Test Post"
      const { user, session } = await createUserWithSession(em)
      const post = new PostFactory(em).makeOne({ user })
      new PostVersionFactory(em).makeOne({ post, title: 'Test Post' })
      await em.flush()

      // Act
      const publishResponse = await request
        .withSession(session)
        .patch(`/admin/posts/${post.id}/publish`)

      // Assert
      expect(publishResponse.body).toMatchObject({
        id: post.id,
        type: 'published',
        slug: `test-post-${post.id.slice(0, 8)}`,
        publishedAt: expect.any(String),
      })
    })
  })

  describe('pATCH /admin/posts/:id/unpublish', () => {
    it('should unpublish a post', async (context) => {
      const { em, request } = context
      // Arrange - a published post
      const { user, session } = await createUserWithSession(em)
      const post = new PostFactory(em).makeOne({ user, slug: 'published-post' })
      new PostVersionFactory(em).makeOne({ post })
      post.publishedAt = new Date()
      await em.flush()

      // Act
      await request.withSession(session).patch(`/admin/posts/${post.id}/unpublish`)

      // Assert
      const unpublishResponse = await request.withSession(session).get(`/admin/posts/${post.id}`)
      expect(unpublishResponse.body).toMatchObject({
        id: post.id,
        type: 'draft',
        publishedAt: null,
      })
    })
  })

  describe('pOST /public/posts/:slug/like', () => {
    it('should increment likes and return the public post', async (context) => {
      const { em, request } = context
      // Arrange - a published post titled "Likeable Post"
      const user = await createUserData(em)
      const post = new PostFactory(em).makeOne({ user, slug: 'likeable-post' })
      new PostVersionFactory(em).makeOne({ post, title: 'Likeable Post' })
      // Publish after the version exists: public pages only show versions written before publication.
      post.publishedAt = new Date()
      await em.flush()

      // Act - anonymous like (no session)
      const likeResponse = await request.post('/public/posts/likeable-post/like')

      // Assert - 200 (not 404) and the mapped public post with incremented count
      expect(likeResponse.status).toBe(200)
      expect(likeResponse.body).toMatchObject({
        title: 'Likeable Post',
        likesCount: 1,
      })
    })
  })

  describe('session flexibility', () => {
    it('should isolate posts per user', async (context) => {
      const { em, request } = context
      // Arrange - User A owns a post
      const alice = await createUserData(em, { name: 'Alice' })
      const post = new PostFactory(em).makeOne({ user: alice })
      new PostVersionFactory(em).makeOne({ post, title: 'Alice Post' })
      await em.flush()

      // Arrange - User B
      const { session: sessionB } = await createUserWithSession(em, { name: 'Bob' })

      // Act - User B lists posts
      const response = await request.withSession(sessionB).get('/admin/posts')

      // Assert - User B should not see User A's posts
      expect(response.status).toBe(200)
      expect(response.body.data).toEqual(expect.any(Array))
      expect(response.body.data.map((p: { title: string }) => p.title)).not.toContain('Alice Post')
    })
  })
})

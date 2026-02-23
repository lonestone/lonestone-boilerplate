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
import { CreatePostInput } from '../contracts/posts.contract'
import { PostModule } from '../posts.module'

describe('postController (e2e)', () => {
  beforeEach(async (context) => {
    const { orm, app } = await initializeTestApp({ orm: context.orm }, {
      imports: [PostModule],
    })
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
      // Arrange
      const { session } = await createUserWithSession(em)

      // First create a post
      const createResponse = await request.withSession(session).post('/admin/posts').send({
        title: 'Test Post',
        content: [
          {
            type: 'text',
            data: 'This is a test post content',
          },
        ],
      })
      const postId = createResponse.body.id

      // Act - publish it
      const publishResponse = await request.withSession(session).patch(`/admin/posts/${postId}/publish`)

      // Assert
      expect(publishResponse.body).toMatchObject({
        id: postId,
        type: 'published',
        slug: `test-post-${postId.slice(0, 8)}`,
        publishedAt: expect.any(String),
      })
    })
  })

  describe('pATCH /admin/posts/:id/unpublish', () => {
    it('should unpublish a post', async (context) => {
      const { em, request } = context
      // Arrange
      const { session } = await createUserWithSession(em)

      // First create a post
      const createResponse = await request.withSession(session).post('/admin/posts').send({
        title: 'Test Post',
        content: [
          {
            type: 'text',
            data: 'This is a test post content',
          },
        ],
      })
      const postId = createResponse.body.id

      // Publish it
      await request.withSession(session).patch(`/admin/posts/${postId}/publish`)

      // Act - unpublish it
      await request.withSession(session).patch(`/admin/posts/${postId}/unpublish`)

      // Assert
      const unpublishResponse = await request.withSession(session).get(`/admin/posts/${postId}`)
      expect(unpublishResponse.body).toMatchObject({
        id: postId,
        type: 'draft',
        publishedAt: null,
      })
    })
  })

  describe('session flexibility', () => {
    it('should isolate posts per user', async (context) => {
      const { em, request } = context
      // Arrange - User A creates a post
      const { session: sessionA } = await createUserWithSession(em, { name: 'Alice' })
      await request.withSession(sessionA).post('/admin/posts').send({
        title: 'Alice Post',
        content: [{ type: 'text', data: 'content' }],
      })

      // Arrange - User B
      const { session: sessionB } = await createUserWithSession(em, { name: 'Bob' })

      // Act - User B lists posts
      const response = await request.withSession(sessionB).get('/admin/posts')

      // Assert - User B should not see User A's posts
      const posts = response.body.data ?? response.body
      const alicePosts = Array.isArray(posts)
        ? posts.filter((p: { title: string }) => p.title === 'Alice Post')
        : []
      expect(alicePosts).toHaveLength(0)
    })
  })
})

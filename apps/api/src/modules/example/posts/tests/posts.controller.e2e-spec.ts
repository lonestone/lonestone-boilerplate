import { beforeEach, describe, expect, it } from 'vitest'
/**
 * E2E Tests for PostController
 *
 * Tests the following endpoints:
 * - POST /admin/posts - Create a new post
 * - PATCH /admin/posts/:id/publish - Publish a post
 * - PATCH /admin/posts/:id/unpublish - Unpublish a post
 * - PUT and DELETE /admin/posts/:id/cover-image - Set and remove the cover image
 * - PUT /admin/posts/:id/multipart - Update a post and its cover image in one multipart request
 * - Auth guard behavior (401 when unauthenticated)
 */
import {
  IStorageProvider,
  SignedUrl,
  STORAGE_PROVIDER,
  StorageProviderUploadInput,
} from '../../../storage/providers/storage-provider.interface'
import { Media } from '../../../media/media.entity'
import { initializeTestApp } from '../../../../test/helpers/test-app.helper'
import { createRequest, TestRequest } from '../../../../test/helpers/test-auth.helper'
import { createUserWithSession } from '../../../../test/helpers/test-user.helpers'
import { BetterAuthSession } from '../../../auth/auth.config'
import { Post } from '../posts.entity'
import { PostModule } from '../posts.module'

const MINIMAL_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex',
)

const MINIMAL_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
])

const COVER_IMAGE_MAX_SIZE_BYTES = 10 * 1024 * 1024

const FAKE_STORAGE_ORIGIN = 'https://storage.test'

class InMemoryStorageProvider implements IStorageProvider {
  private readonly objects = new Map<string, Buffer>()
  uploadCount = 0

  async upload(input: StorageProviderUploadInput): Promise<void> {
    this.uploadCount += 1
    this.objects.set(input.key, input.body)
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key)
  }

  async getSignedUrl(key: string): Promise<SignedUrl> {
    return {
      url: `${FAKE_STORAGE_ORIGIN}/${key}?X-Amz-Signature=fake`,
      expiresAt: new Date(Date.now() + 3600_000),
    }
  }

  get objectCount(): number {
    return this.objects.size
  }

  /** Plays the bucket: returns the bytes a browser would get from a signed URL. */
  readSignedUrl(url: string): Buffer | undefined {
    const { origin, pathname } = new URL(url)
    if (origin !== FAKE_STORAGE_ORIGIN) return undefined

    return this.objects.get(pathname.slice(1))
  }
}

async function createPost(
  request: TestRequest,
  session: BetterAuthSession,
  title = 'Illustrated Post',
): Promise<string> {
  const response = await request
    .withSession(session)
    .post('/admin/posts')
    .send({ title, content: [{ type: 'text', data: 'Post body' }] })
  return response.body.id as string
}

function uploadCoverImage(
  request: TestRequest,
  session: BetterAuthSession,
  postId: string,
  input: { body: Buffer; filename: string; contentType: string } = {
    body: MINIMAL_PNG,
    filename: 'cover.png',
    contentType: 'image/png',
  },
) {
  return request
    .withSession(session)
    .put(`/admin/posts/${postId}/cover-image`)
    .attach('file', input.body, { filename: input.filename, contentType: input.contentType })
}

/** Sends the fields the way the generated SDK does: one field per array item, objects as JSON. */
function updatePostViaMultipart(
  request: TestRequest,
  session: BetterAuthSession,
  postId: string,
  input: { title?: string; content?: { type: 'text'; data: string }[]; tags?: string[] },
) {
  let multipartRequest = request.withSession(session).put(`/admin/posts/${postId}/multipart`)
  if (input.title) multipartRequest = multipartRequest.field('title', input.title)
  for (const item of input.content ?? []) {
    multipartRequest = multipartRequest.field('content', JSON.stringify(item))
  }
  for (const tag of input.tags ?? []) {
    multipartRequest = multipartRequest.field('tags', tag)
  }
  return multipartRequest
}

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
      const { session } = await createUserWithSession(em)

      const response = await request
        .withSession(session)
        .post('/admin/posts')
        .send({
          title: 'Test Post',
          content: [{ type: 'text', data: 'This is a test post content' }],
        })

      expect(response.body).toMatchObject({
        id: expect.any(String),
        title: 'Test Post',
        content: expect.any(Array),
        type: 'draft',
      })
    })

    it('should return 401 when unauthenticated', async (context) => {
      const { request } = context
      const response = await request.post('/admin/posts').send({
        title: 'Test Post',
        content: [{ type: 'text', data: 'content' }],
      })

      expect(response.status).toBe(401)
    })
  })

  describe('pATCH /admin/posts/:id/publish', () => {
    it('should publish a post', async (context) => {
      const { em, request } = context
      const { session } = await createUserWithSession(em)
      const postId = await createPost(request, session, 'Test Post')

      const publishResponse = await request
        .withSession(session)
        .patch(`/admin/posts/${postId}/publish`)

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
      const { session } = await createUserWithSession(em)
      const postId = await createPost(request, session, 'Test Post')

      await request.withSession(session).patch(`/admin/posts/${postId}/publish`)
      await request.withSession(session).patch(`/admin/posts/${postId}/unpublish`)

      const unpublishResponse = await request.withSession(session).get(`/admin/posts/${postId}`)
      expect(unpublishResponse.body).toMatchObject({
        id: postId,
        type: 'draft',
        publishedAt: null,
      })
    })
  })

  describe('pOST /public/posts/:slug/like', () => {
    it('should increment likes and return the public post', async (context) => {
      const { em, request } = context
      const { session } = await createUserWithSession(em)
      const postId = await createPost(request, session, 'Likeable Post')
      const publishResponse = await request
        .withSession(session)
        .patch(`/admin/posts/${postId}/publish`)
      const slug = publishResponse.body.slug

      const likeResponse = await request.post(`/public/posts/${slug}/like`)

      expect(likeResponse.status).toBe(200)
      expect(likeResponse.body).toMatchObject({
        title: 'Likeable Post',
        likesCount: 1,
      })
    })
  })

  describe('pUT /admin/posts/:id/cover-image with storage disabled', () => {
    it('returns 503', async (context) => {
      const { em, request } = context
      const { session } = await createUserWithSession(em)
      const postId = await createPost(request, session)

      const response = await uploadCoverImage(request, session, postId)

      expect(response.status).toBe(503)
      expect(response.body.message).toMatch(/storage is disabled/i)
    })
  })

  describe('read routes with storage disabled', () => {
    it('omits the cover image instead of failing', async (context) => {
      const { em, request } = context
      const { session } = await createUserWithSession(em, { name: 'Alice' })
      const postId = await createPost(request, session)
      const publishResponse = await request
        .withSession(session)
        .patch(`/admin/posts/${postId}/publish`)
      const storedPostEm = em.fork()
      const storedPost = await storedPostEm.findOneOrFail(Post, { id: postId })
      storedPost.coverImage = Object.assign(new Media(), {
        storageKey: 'stored-before-storage-was-disabled',
        filename: 'cover.png',
        mimeType: 'image/png',
        size: MINIMAL_PNG.length,
      })
      await storedPostEm.flush()

      const responses = await Promise.all([
        request.withSession(session).get('/admin/posts'),
        request.withSession(session).get(`/admin/posts/${postId}`),
        request.get('/public/posts'),
        request.get('/public/posts/random'),
        request.get(`/public/posts/${publishResponse.body.slug}`),
        request.get('/public/authors/Alice/posts'),
      ])

      for (const response of responses) {
        expect(response.status).toBe(200)
        expect(JSON.stringify(response.body)).not.toContain('coverImage')
      }
    })
  })

  describe('session flexibility', () => {
    it('should isolate posts per user', async (context) => {
      const { em, request } = context
      const { session: sessionA } = await createUserWithSession(em, { name: 'Alice' })
      const createAlice = await request
        .withSession(sessionA)
        .post('/admin/posts')
        .send({ title: 'Alice Post', content: [{ type: 'text', data: 'content' }] })
      expect(createAlice.status).toBe(201)
      expect(createAlice.body.id).toEqual(expect.any(String))

      const { session: sessionB } = await createUserWithSession(em, { name: 'Bob' })
      const response = await request.withSession(sessionB).get('/admin/posts')

      // Assert - User B should not see User A's posts
      expect(response.status).toBe(200)
      expect(response.body.data).toEqual(expect.any(Array))
      expect(response.body.data.map((p: { title: string }) => p.title)).not.toContain('Alice Post')
    })
  })
})

describe('postController cover image (e2e)', () => {
  let storageProvider: InMemoryStorageProvider

  beforeEach(async (context) => {
    storageProvider = new InMemoryStorageProvider()
    const { orm, app } = await initializeTestApp(
      { orm: context.orm },
      {
        imports: [PostModule],
        providers: [
          {
            provide: STORAGE_PROVIDER,
            useValue: storageProvider,
          },
        ],
      },
    )
    context.app = app
    context.em = orm.em.fork()
    context.request = createRequest(app)
  })

  it('sets a cover image and returns a signed URL to the owner', async (context) => {
    const { session } = await createUserWithSession(context.em)
    const postId = await createPost(context.request, session)

    const uploadResponse = await uploadCoverImage(context.request, session, postId)

    expect(uploadResponse.status).toBe(200)
    expect(uploadResponse.body).toMatchObject({ id: postId, title: 'Illustrated Post' })
    expect(uploadResponse.body.coverImage).toEqual({
      id: expect.any(String),
      filename: 'cover.png',
      mimeType: 'image/png',
      size: MINIMAL_PNG.length,
      url: expect.stringMatching(new RegExp(`^${FAKE_STORAGE_ORIGIN}/`)),
      expiresAt: expect.any(String),
    })
    expect(uploadResponse.body.coverImage).not.toHaveProperty('storageKey')
    expect(storageProvider.readSignedUrl(uploadResponse.body.coverImage.url)).toEqual(MINIMAL_PNG)

    const ownerResponse = await context.request.withSession(session).get(`/admin/posts/${postId}`)
    const listResponse = await context.request.withSession(session).get('/admin/posts')

    expect(storageProvider.readSignedUrl(ownerResponse.body.coverImage.url)).toEqual(MINIMAL_PNG)
    expect(listResponse.body.data[0].coverImage).toMatchObject({
      id: uploadResponse.body.coverImage.id,
      url: expect.any(String),
    })
  })

  it('returns no cover image for a post without an image', async (context) => {
    const { session } = await createUserWithSession(context.em)
    const postId = await createPost(context.request, session, 'Plain Post')
    const publishResponse = await context.request
      .withSession(session)
      .patch(`/admin/posts/${postId}/publish`)

    const publicResponse = await context.request.get(`/public/posts/${publishResponse.body.slug}`)

    expect(publishResponse.body).not.toHaveProperty('coverImage')
    expect(publicResponse.body).not.toHaveProperty('coverImage')
  })

  it('keeps the cover image when the post is updated', async (context) => {
    const { session } = await createUserWithSession(context.em)
    const postId = await createPost(context.request, session)
    const uploadResponse = await uploadCoverImage(context.request, session, postId)

    const updateResponse = await context.request
      .withSession(session)
      .put(`/admin/posts/${postId}`)
      .send({ title: 'Updated title' })

    expect(updateResponse.body).toMatchObject({
      title: 'Updated title',
      coverImage: { id: uploadResponse.body.coverImage.id, filename: 'cover.png' },
    })
  })

  it('replaces a cover image and deletes the previous file', async (context) => {
    const { session } = await createUserWithSession(context.em)
    const postId = await createPost(context.request, session)
    const firstResponse = await uploadCoverImage(context.request, session, postId)

    const secondResponse = await uploadCoverImage(context.request, session, postId, {
      body: MINIMAL_JPEG,
      filename: 'cover.jpg',
      contentType: 'image/jpeg',
    })

    expect(secondResponse.body.coverImage).toMatchObject({
      filename: 'cover.jpg',
      mimeType: 'image/jpeg',
    })
    expect(secondResponse.body.coverImage.id).not.toBe(firstResponse.body.coverImage.id)
    expect(storageProvider.readSignedUrl(secondResponse.body.coverImage.url)).toEqual(MINIMAL_JPEG)
    expect(storageProvider.readSignedUrl(firstResponse.body.coverImage.url)).toBeUndefined()
    await expect(
      context.em.fork().findOne(Media, { id: firstResponse.body.coverImage.id }),
    ).resolves.toBeNull()
  })

  it('returns a signed URL in public responses once the post is published', async (context) => {
    const { session } = await createUserWithSession(context.em)
    const postId = await createPost(context.request, session)
    const uploadResponse = await uploadCoverImage(context.request, session, postId)

    const draftListResponse = await context.request.get('/public/posts')
    expect(draftListResponse.body.data).toHaveLength(0)

    const publishResponse = await context.request
      .withSession(session)
      .patch(`/admin/posts/${postId}/publish`)
    const publicPostResponse = await context.request.get(
      `/public/posts/${publishResponse.body.slug}`,
    )
    const publicListResponse = await context.request.get('/public/posts')

    expect(publicPostResponse.body.coverImage).toMatchObject({
      id: uploadResponse.body.coverImage.id,
      filename: 'cover.png',
      url: expect.any(String),
    })
    expect(publicPostResponse.body.coverImage).not.toHaveProperty('storageKey')
    expect(storageProvider.readSignedUrl(publicPostResponse.body.coverImage.url)).toEqual(
      MINIMAL_PNG,
    )
    expect(publicListResponse.body.data[0].coverImage).toMatchObject({
      id: uploadResponse.body.coverImage.id,
    })
  })

  it('removes a cover image for the owner', async (context) => {
    const { session } = await createUserWithSession(context.em)
    const postId = await createPost(context.request, session)
    const uploadResponse = await uploadCoverImage(context.request, session, postId)

    const deleteResponse = await context.request
      .withSession(session)
      .del(`/admin/posts/${postId}/cover-image`)

    expect(deleteResponse.status).toBe(204)
    const postResponse = await context.request.withSession(session).get(`/admin/posts/${postId}`)
    expect(postResponse.body).not.toHaveProperty('coverImage')
    expect(storageProvider.readSignedUrl(uploadResponse.body.coverImage.url)).toBeUndefined()
    await expect(
      context.em.fork().findOne(Media, { id: uploadResponse.body.coverImage.id }),
    ).resolves.toBeNull()
  })

  it('returns not found when removing a missing cover image', async (context) => {
    const { session } = await createUserWithSession(context.em)
    const postId = await createPost(context.request, session)

    const response = await context.request
      .withSession(session)
      .del(`/admin/posts/${postId}/cover-image`)

    expect(response.status).toBe(404)
  })

  it('returns not found when another user sets or removes a cover image', async (context) => {
    const { session: ownerSession } = await createUserWithSession(context.em, { name: 'Owner' })
    const { session: otherSession } = await createUserWithSession(context.em, { name: 'Other' })
    const postId = await createPost(context.request, ownerSession)
    const uploadResponse = await uploadCoverImage(context.request, ownerSession, postId)

    const otherUploadResponse = await uploadCoverImage(context.request, otherSession, postId)
    const otherDeleteResponse = await context.request
      .withSession(otherSession)
      .del(`/admin/posts/${postId}/cover-image`)

    expect(otherUploadResponse.status).toBe(404)
    expect(otherDeleteResponse.status).toBe(404)
    expect(storageProvider.readSignedUrl(uploadResponse.body.coverImage.url)).toEqual(MINIMAL_PNG)
  })

  it('rejects unauthenticated cover image requests', async (context) => {
    const postId = '44b82136-0dd7-4b5f-a36b-38b26a4941aa'

    const uploadResponse = await context.request
      .put(`/admin/posts/${postId}/cover-image`)
      .attach('file', MINIMAL_PNG, { filename: 'cover.png', contentType: 'image/png' })
    const deleteResponse = await context.request.del(`/admin/posts/${postId}/cover-image`)

    expect(uploadResponse.status).toBe(401)
    expect(deleteResponse.status).toBe(401)
  })

  it('rejects a request without a file', async (context) => {
    const { session } = await createUserWithSession(context.em)
    const postId = await createPost(context.request, session)

    const response = await context.request
      .withSession(session)
      .put(`/admin/posts/${postId}/cover-image`)

    expect(response.status).toBe(400)
  })

  it('rejects text fields sent alongside the file', async (context) => {
    const { session } = await createUserWithSession(context.em)
    const postId = await createPost(context.request, session)

    const response = await context.request
      .withSession(session)
      .put(`/admin/posts/${postId}/cover-image`)
      .field('padding', 'x'.repeat(1024))
      .attach('file', MINIMAL_PNG, { filename: 'cover.png', contentType: 'image/png' })

    expect(response.status).toBe(400)
    const postResponse = await context.request.withSession(session).get(`/admin/posts/${postId}`)
    expect(postResponse.body).not.toHaveProperty('coverImage')
  })

  it('rejects a file that is not a supported image, whatever its declared type', async (context) => {
    const { session } = await createUserWithSession(context.em)
    const postId = await createPost(context.request, session)

    const response = await uploadCoverImage(context.request, session, postId, {
      body: Buffer.from('hello storage'),
      filename: 'notes.png',
      contentType: 'image/png',
    })

    expect(response.status).toBe(400)
    const postResponse = await context.request.withSession(session).get(`/admin/posts/${postId}`)
    expect(postResponse.body).not.toHaveProperty('coverImage')
  })

  it('rejects a file above the size limit', async (context) => {
    const { session } = await createUserWithSession(context.em)
    const postId = await createPost(context.request, session)

    const response = await uploadCoverImage(context.request, session, postId, {
      body: Buffer.alloc(COVER_IMAGE_MAX_SIZE_BYTES + 1),
      filename: 'large.png',
      contentType: 'image/png',
    })

    expect(response.status).toBe(413)
  })

  describe('pUT /admin/posts/:id/multipart', () => {
    it('updates a post and replaces its cover image in one request', async (context) => {
      const { session } = await createUserWithSession(context.em)
      const postId = await createPost(context.request, session)
      const firstResponse = await uploadCoverImage(context.request, session, postId)

      const response = await updatePostViaMultipart(context.request, session, postId, {
        title: 'Multipart title',
        content: [
          { type: 'text', data: 'First' },
          { type: 'text', data: 'Second' },
        ],
        tags: ['news', '2026'],
      }).attach('coverImage', MINIMAL_JPEG, { filename: 'cover.jpg', contentType: 'image/jpeg' })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        title: 'Multipart title',
        content: [
          { type: 'text', data: 'First' },
          { type: 'text', data: 'Second' },
        ],
        coverImage: { filename: 'cover.jpg', mimeType: 'image/jpeg' },
      })
      expect(response.body.tags.map((tag: { name: string }) => tag.name).sort()).toEqual([
        '2026',
        'news',
      ])
      expect(storageProvider.readSignedUrl(response.body.coverImage.url)).toEqual(MINIMAL_JPEG)
      expect(storageProvider.readSignedUrl(firstResponse.body.coverImage.url)).toBeUndefined()
      expect(storageProvider.objectCount).toBe(1)
    })

    it('updates a post without a file and keeps its cover image', async (context) => {
      const { session } = await createUserWithSession(context.em)
      const postId = await createPost(context.request, session)
      const uploadResponse = await uploadCoverImage(context.request, session, postId)

      const response = await updatePostViaMultipart(context.request, session, postId, {
        title: 'Text only',
      })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        title: 'Text only',
        coverImage: { id: uploadResponse.body.coverImage.id },
      })
    })

    it('rejects a file that is not a supported image and leaves the post unchanged', async (context) => {
      const { session } = await createUserWithSession(context.em)
      const postId = await createPost(context.request, session)

      const response = await updatePostViaMultipart(context.request, session, postId, {
        title: 'Should not be saved',
      }).attach('coverImage', Buffer.from('hello storage'), {
        filename: 'notes.png',
        contentType: 'image/png',
      })

      expect(response.status).toBe(400)
      const postResponse = await context.request.withSession(session).get(`/admin/posts/${postId}`)
      expect(postResponse.body.title).toBe('Illustrated Post')
      expect(storageProvider.objectCount).toBe(0)
    })

    it('rejects content that is not valid post content', async (context) => {
      const { session } = await createUserWithSession(context.em)
      const postId = await createPost(context.request, session)

      const response = await context.request
        .withSession(session)
        .put(`/admin/posts/${postId}/multipart`)
        .field('content', 'not json')

      expect(response.status).toBe(400)
    })

    it('removes the uploaded file and keeps the current image when the save fails', async (context) => {
      const { session } = await createUserWithSession(context.em)
      const postId = await createPost(context.request, session)
      const uploadResponse = await uploadCoverImage(context.request, session, postId)

      // A tag longer than its column makes the database reject the save, after the upload.
      const response = await updatePostViaMultipart(context.request, session, postId, {
        title: 'Should not be saved',
        tags: ['x'.repeat(300)],
      }).attach('coverImage', MINIMAL_JPEG, { filename: 'cover.jpg', contentType: 'image/jpeg' })

      expect(response.status).toBe(500)
      expect(storageProvider.uploadCount).toBe(2)
      expect(storageProvider.objectCount).toBe(1)
      const postResponse = await context.request.withSession(session).get(`/admin/posts/${postId}`)
      expect(postResponse.body).toMatchObject({
        title: 'Illustrated Post',
        coverImage: { id: uploadResponse.body.coverImage.id },
      })
      expect(storageProvider.readSignedUrl(postResponse.body.coverImage.url)).toEqual(MINIMAL_PNG)
    })

    it('returns not found when another user updates the post', async (context) => {
      const { session: ownerSession } = await createUserWithSession(context.em, { name: 'Owner' })
      const { session: otherSession } = await createUserWithSession(context.em, { name: 'Other' })
      const postId = await createPost(context.request, ownerSession)

      const response = await updatePostViaMultipart(context.request, otherSession, postId, {
        title: 'Hijacked',
      }).attach('coverImage', MINIMAL_PNG, { filename: 'cover.png', contentType: 'image/png' })

      expect(response.status).toBe(404)
      expect(storageProvider.objectCount).toBe(0)
    })
  })
})

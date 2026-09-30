import { beforeEach, describe, expect, it } from 'vitest'
/**
 * E2E Tests for PostController
 *
 * Tests the following endpoints:
 * - POST /admin/posts - Create a new post
 * - PATCH /admin/posts/:id/publish - Publish a post
 * - PATCH /admin/posts/:id/unpublish - Unpublish a post
 * - Auth guard behavior (401 when unauthenticated)
 * - Post image upload, signed URLs, replacement, and removal
 */
import {
  IStorageProvider,
  SignedUrl,
  STORAGE_PROVIDER,
  StorageProviderObject,
  StorageProviderUploadInput,
} from '../../../storage/providers/storage-provider.interface'
import { Media } from '../../../media/media.entity'
import { StorageModule } from '../../../storage/storage.module'
import { initializeTestApp } from '../../../../test/helpers/test-app.helper'
import { createRequest, TestRequest } from '../../../../test/helpers/test-auth.helper'
import { createUserWithSession } from '../../../../test/helpers/test-user.helpers'
import { POST_COVER_IMAGE_MAX_SIZE_BYTES } from '../image-file.util'
import { PostModule } from '../posts.module'

const MINIMAL_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex',
)

const MINIMAL_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
])

const FAKE_STORAGE_ORIGIN = 'https://storage.test'

class InMemoryStorageProvider implements IStorageProvider {
  private readonly objects = new Map<string, Buffer>()

  async upload(input: StorageProviderUploadInput): Promise<void> {
    this.objects.set(input.key, input.body)
  }

  async download(): Promise<StorageProviderObject | null> {
    throw new Error('Posts must not download objects through the API')
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

  /** Plays the bucket: returns the bytes a browser would get from a signed URL. */
  readSignedUrl(url: string): Buffer | undefined {
    const { origin, pathname } = new URL(url)
    if (origin !== FAKE_STORAGE_ORIGIN) return undefined

    return this.objects.get(pathname.slice(1))
  }
}

function postFields(
  request: ReturnType<TestRequest['post']>,
  input: { title: string; content: { type: 'text' | 'image' | 'video'; data: string }[] },
) {
  return request.field('title', input.title).field('content', JSON.stringify(input.content))
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

      const response = await postFields(request.withSession(session).post('/admin/posts'), {
        title: 'Test Post',
        content: [{ type: 'text', data: 'This is a test post content' }],
      })

      expect(response.body).toMatchObject({
        id: expect.any(String),
        title: 'Test Post',
        content: expect.any(Array),
        type: 'draft',
      })
      expect(response.body).not.toHaveProperty('coverImageStorageKey')
    })

    it('should return 401 when unauthenticated', async (context) => {
      const { request } = context
      const response = await postFields(request.post('/admin/posts'), {
        title: 'Test Post',
        content: [{ type: 'text', data: 'content' }],
      })

      expect(response.status).toBe(401)
    })

    it('rejects an image upload when storage is disabled', async (context) => {
      const { em, request } = context
      const { session } = await createUserWithSession(em)

      const response = await postFields(request.withSession(session).post('/admin/posts'), {
        title: 'Test Post',
        content: [{ type: 'text', data: 'content' }],
      }).attach('coverImage', MINIMAL_PNG, { filename: 'cover.png', contentType: 'image/png' })

      expect(response.status).toBe(503)
      expect(response.body.message).toMatch(/storage is disabled/i)
    })
  })

  describe('pATCH /admin/posts/:id/publish', () => {
    it('should publish a post', async (context) => {
      const { em, request } = context
      const { session } = await createUserWithSession(em)

      const createResponse = await postFields(request.withSession(session).post('/admin/posts'), {
        title: 'Test Post',
        content: [{ type: 'text', data: 'This is a test post content' }],
      })
      const postId = createResponse.body.id

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

      const createResponse = await postFields(request.withSession(session).post('/admin/posts'), {
        title: 'Test Post',
        content: [{ type: 'text', data: 'This is a test post content' }],
      })
      const postId = createResponse.body.id

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
      const createResponse = await postFields(request.withSession(session).post('/admin/posts'), {
        title: 'Likeable Post',
        content: [{ type: 'text', data: 'Content worth liking.' }],
      })
      const postId = createResponse.body.id
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

  describe('session flexibility', () => {
    it('should isolate posts per user', async (context) => {
      const { em, request } = context
      const { session: sessionA } = await createUserWithSession(em, { name: 'Alice' })
      await postFields(request.withSession(sessionA).post('/admin/posts'), {
        title: 'Alice Post',
        content: [{ type: 'text', data: 'content' }],
      })

      const { session: sessionB } = await createUserWithSession(em, { name: 'Bob' })
      const response = await request.withSession(sessionB).get('/admin/posts')

      const posts = response.body.data ?? response.body
      const alicePosts = Array.isArray(posts)
        ? posts.filter((p: { title: string }) => p.title === 'Alice Post')
        : []
      expect(alicePosts).toHaveLength(0)
    })
  })
})

describe('postController images (e2e)', () => {
  let storageProvider: InMemoryStorageProvider

  beforeEach(async (context) => {
    storageProvider = new InMemoryStorageProvider()
    const { orm, app } = await initializeTestApp(
      { orm: context.orm },
      {
        imports: [PostModule, StorageModule],
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

  it('creates a post with an image and returns a signed URL to the owner', async (context) => {
    const { session } = await createUserWithSession(context.em)

    const createResponse = await postFields(
      context.request.withSession(session).post('/admin/posts'),
      {
        title: 'Illustrated Post',
        content: [{ type: 'text', data: 'Has a cover' }],
      },
    ).attach('coverImage', MINIMAL_PNG, { filename: 'cover.png', contentType: 'image/png' })

    expect(createResponse.status).toBe(201)
    expect(createResponse.body.coverImage).toEqual({
      id: expect.any(String),
      filename: 'cover.png',
      mimeType: 'image/png',
      size: MINIMAL_PNG.length,
      url: expect.stringMatching(new RegExp(`^${FAKE_STORAGE_ORIGIN}/`)),
      expiresAt: expect.any(String),
    })
    expect(createResponse.body.coverImage).not.toHaveProperty('storageKey')
    expect(storageProvider.readSignedUrl(createResponse.body.coverImage.url)).toEqual(MINIMAL_PNG)

    const postId = createResponse.body.id as string
    const ownerResponse = await context.request.withSession(session).get(`/admin/posts/${postId}`)
    const listResponse = await context.request.withSession(session).get('/admin/posts')

    expect(ownerResponse.body.coverImage.url).toEqual(expect.any(String))
    expect(storageProvider.readSignedUrl(ownerResponse.body.coverImage.url)).toEqual(MINIMAL_PNG)
    expect(listResponse.body.data[0].coverImage).toMatchObject({
      id: createResponse.body.coverImage.id,
      url: expect.any(String),
    })
  })

  it('returns no cover image for a post without an image', async (context) => {
    const { session } = await createUserWithSession(context.em)
    const createResponse = await postFields(
      context.request.withSession(session).post('/admin/posts'),
      {
        title: 'Plain Post',
        content: [{ type: 'text', data: 'No cover' }],
      },
    )
    const postId = createResponse.body.id as string
    const publishResponse = await context.request
      .withSession(session)
      .patch(`/admin/posts/${postId}/publish`)

    const publicResponse = await context.request.get(`/public/posts/${publishResponse.body.slug}`)

    expect(createResponse.body).not.toHaveProperty('coverImage')
    expect(publishResponse.body).not.toHaveProperty('coverImage')
    expect(publicResponse.body).not.toHaveProperty('coverImage')
  })

  it('keeps the current image when an update omits the image field', async (context) => {
    const { session } = await createUserWithSession(context.em)
    const createResponse = await postFields(
      context.request.withSession(session).post('/admin/posts'),
      {
        title: 'Illustrated Post',
        content: [{ type: 'text', data: 'Has a cover' }],
      },
    ).attach('coverImage', MINIMAL_PNG, { filename: 'cover.png', contentType: 'image/png' })
    const postId = createResponse.body.id as string

    const updateResponse = await context.request
      .withSession(session)
      .put(`/admin/posts/${postId}`)
      .field('title', 'Updated title')

    expect(updateResponse.body).toMatchObject({
      title: 'Updated title',
      coverImage: {
        id: createResponse.body.coverImage.id,
        filename: 'cover.png',
        mimeType: 'image/png',
      },
    })
    expect(storageProvider.readSignedUrl(updateResponse.body.coverImage.url)).toEqual(MINIMAL_PNG)
  })

  it('replaces an image and signs a URL for the new file', async (context) => {
    const { session } = await createUserWithSession(context.em)
    const createResponse = await postFields(
      context.request.withSession(session).post('/admin/posts'),
      {
        title: 'Illustrated Post',
        content: [{ type: 'text', data: 'Has a cover' }],
      },
    ).attach('coverImage', MINIMAL_PNG, { filename: 'cover.png', contentType: 'image/png' })
    const postId = createResponse.body.id as string

    const updateResponse = await context.request
      .withSession(session)
      .put(`/admin/posts/${postId}`)
      .attach('coverImage', MINIMAL_JPEG, { filename: 'cover.jpg', contentType: 'image/jpeg' })

    expect(updateResponse.body.coverImage).toMatchObject({
      id: expect.any(String),
      filename: 'cover.jpg',
      mimeType: 'image/jpeg',
    })
    expect(updateResponse.body.coverImage.id).not.toBe(createResponse.body.coverImage.id)
    expect(storageProvider.readSignedUrl(updateResponse.body.coverImage.url)).toEqual(MINIMAL_JPEG)
    expect(storageProvider.readSignedUrl(createResponse.body.coverImage.url)).toBeUndefined()
    await expect(
      context.em.fork().findOne(Media, { id: createResponse.body.coverImage.id }),
    ).resolves.toBeNull()
  })

  it('returns a signed URL in public responses once the post is published', async (context) => {
    const { session } = await createUserWithSession(context.em)
    const createResponse = await postFields(
      context.request.withSession(session).post('/admin/posts'),
      {
        title: 'Public Cover',
        content: [{ type: 'text', data: 'Draft first' }],
      },
    ).attach('coverImage', MINIMAL_PNG, { filename: 'cover.png', contentType: 'image/png' })
    const postId = createResponse.body.id as string

    const draftListResponse = await context.request.get('/public/posts')
    expect(draftListResponse.body.data).toHaveLength(0)

    const publishResponse = await context.request
      .withSession(session)
      .patch(`/admin/posts/${postId}/publish`)
    const slug = publishResponse.body.slug as string

    const publicPostResponse = await context.request.get(`/public/posts/${slug}`)
    const publicListResponse = await context.request.get('/public/posts')

    expect(publicPostResponse.body.coverImage).toEqual({
      id: createResponse.body.coverImage.id,
      filename: 'cover.png',
      mimeType: 'image/png',
      size: MINIMAL_PNG.length,
      url: expect.any(String),
      expiresAt: expect.any(String),
    })
    expect(publicPostResponse.body.coverImage).not.toHaveProperty('storageKey')
    expect(storageProvider.readSignedUrl(publicPostResponse.body.coverImage.url)).toEqual(
      MINIMAL_PNG,
    )
    expect(publicListResponse.body.data[0].coverImage).toMatchObject({
      id: createResponse.body.coverImage.id,
      url: expect.any(String),
    })
  })

  it('removes an image for the owner', async (context) => {
    const { session } = await createUserWithSession(context.em)
    const createResponse = await postFields(
      context.request.withSession(session).post('/admin/posts'),
      {
        title: 'Illustrated Post',
        content: [{ type: 'text', data: 'Has a cover' }],
      },
    ).attach('coverImage', MINIMAL_PNG, { filename: 'cover.png', contentType: 'image/png' })
    const postId = createResponse.body.id as string

    const deleteResponse = await context.request
      .withSession(session)
      .del(`/admin/posts/${postId}/cover-image`)

    expect(deleteResponse.status).toBe(204)
    const postResponse = await context.request.withSession(session).get(`/admin/posts/${postId}`)
    expect(postResponse.body).not.toHaveProperty('coverImage')
    expect(storageProvider.readSignedUrl(createResponse.body.coverImage.url)).toBeUndefined()
    await expect(
      context.em.fork().findOne(Media, { id: createResponse.body.coverImage.id }),
    ).resolves.toBeNull()
  })

  it('returns not found when another user removes an image', async (context) => {
    const { session: ownerSession } = await createUserWithSession(context.em, { name: 'Owner' })
    const { session: otherSession } = await createUserWithSession(context.em, { name: 'Other' })
    const createResponse = await postFields(
      context.request.withSession(ownerSession).post('/admin/posts'),
      {
        title: 'Private Cover',
        content: [{ type: 'text', data: 'Mine' }],
      },
    ).attach('coverImage', MINIMAL_PNG, { filename: 'cover.png', contentType: 'image/png' })
    const postId = createResponse.body.id as string

    const deleteResponse = await context.request
      .withSession(otherSession)
      .del(`/admin/posts/${postId}/cover-image`)

    expect(deleteResponse.status).toBe(404)
    expect(storageProvider.readSignedUrl(createResponse.body.coverImage.url)).toEqual(MINIMAL_PNG)
  })

  it('rejects unauthenticated image requests', async (context) => {
    const postId = '44b82136-0dd7-4b5f-a36b-38b26a4941aa'

    const uploadResponse = await postFields(context.request.post('/admin/posts'), {
      title: 'Nope',
      content: [{ type: 'text', data: 'content' }],
    }).attach('coverImage', MINIMAL_PNG, { filename: 'cover.png', contentType: 'image/png' })
    const deleteResponse = await context.request.del(`/admin/posts/${postId}/cover-image`)

    expect(uploadResponse.status).toBe(401)
    expect(deleteResponse.status).toBe(401)
  })

  it('rejects files that are not a supported image format', async (context) => {
    const { session } = await createUserWithSession(context.em)

    const response = await postFields(context.request.withSession(session).post('/admin/posts'), {
      title: 'Bad File',
      content: [{ type: 'text', data: 'content' }],
    }).attach('coverImage', Buffer.from('hello storage'), {
      filename: 'notes.txt',
      contentType: 'text/plain',
    })

    expect(response.status).toBe(400)
  })

  it('rejects files above the configured size limit', async (context) => {
    const { session } = await createUserWithSession(context.em)

    const response = await postFields(context.request.withSession(session).post('/admin/posts'), {
      title: 'Huge File',
      content: [{ type: 'text', data: 'content' }],
    }).attach('coverImage', Buffer.alloc(POST_COVER_IMAGE_MAX_SIZE_BYTES + 1), {
      filename: 'large.png',
      contentType: 'image/png',
    })

    expect(response.status).toBe(413)
  })
})

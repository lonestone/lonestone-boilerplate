import { MikroORM } from '@mikro-orm/core'
import { INestApplication } from '@nestjs/common'
import {
  closeTestApp,
  createRequest,
  initializeTestApp,
  TestAppContext,
  TestRequest,
} from '../../../../test/test.utils'
import { CreatePostInput } from '../contracts/posts.contract'
import { PostModule } from '../posts.module'

describe('postController (e2e)', () => {
  let ctx: TestAppContext
  let app: INestApplication
  let orm: MikroORM
  let request: TestRequest

  beforeAll(async () => {
    ctx = await initializeTestApp({
      imports: [PostModule],
    })
    app = ctx.app
    orm = ctx.orm
    request = createRequest(app)
  })

  beforeEach(async () => {
    await orm.schema.refreshDatabase()
    vi.clearAllMocks()
  })

  afterAll(async () => {
    await closeTestApp(ctx)
  })

  describe('pOST /admin/posts', () => {
    it('should create a post', async () => {
      const createPostDto: CreatePostInput = {
        title: 'Test Post',
        content: [
          {
            type: 'text',
            data: 'This is a test post content',
          },
        ],
      }

      try {
        const response = await createRequest(app).post('/admin/posts').send(createPostDto)

        expect(response.body).toMatchObject({
          id: expect.any(String),
          title: 'Test Post',
          content: expect.any(Array),
          type: 'draft',
        })

        return response
      }
      catch (error: unknown) {
        if (error instanceof Error) {
          console.error('Error creating post:', error.message)
        }
        else {
          console.error('Error creating post:', error)
        }
        throw error
      }
    })
  })

  describe('pATCH /admin/posts/:id/publish', () => {
    it('should publish a post', async () => {
      try {
        // First create a post
        const createResponse = await request.post('/admin/posts').send({
          title: 'Test Post',
          content: [
            {
              type: 'text',
              data: 'This is a test post content',
            },
          ],
        })

        const postId = createResponse.body.id

        // Then publish it
        const publishResponse = await request.patch(`/admin/posts/${postId}/publish`)

        expect(publishResponse.body).toMatchObject({
          id: postId,
          type: 'published',
          slug: `test-post-${postId.slice(0, 8)}`,
          publishedAt: expect.any(String),
        })

        return publishResponse
      }
      catch (error: unknown) {
        if (error instanceof Error) {
          console.error('Error in publish test:', error.message)
        }
        else {
          console.error('Error in publish test:', error)
        }
        throw error
      }
    })
  })

  describe('pATCH /admin/posts/:id/unpublish', () => {
    it('should unpublish a post', async () => {
      try {
        // First create a post
        const createResponse = await request.post('/admin/posts').send({
          title: 'Test Post',
          content: [
            {
              type: 'text',
              data: 'This is a test post content',
            },
          ],
        })

        const postId = createResponse.body.id

        // Then publish it
        await request.patch(`/admin/posts/${postId}/publish`)

        // Finally unpublish it
        await request.patch(`/admin/posts/${postId}/unpublish`)

        const unpublishResponse = await request.get(`/admin/posts/${postId}`)

        expect(unpublishResponse.body).toMatchObject({
          id: postId,
          type: 'draft',
          publishedAt: null,
        })

        return unpublishResponse
      }
      catch (error: unknown) {
        if (error instanceof Error) {
          console.error('Error in unpublish test:', error.message)
        }
        else {
          console.error('Error in unpublish test:', error)
        }
        throw error
      }
    })
  })
})

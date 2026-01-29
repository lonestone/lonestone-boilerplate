import { EntityManager, MikroORM } from '@mikro-orm/core'
import { INestApplication } from '@nestjs/common'
import { createUserData } from '../../../factories/user.factory'
import {
  closeTestApp,
  initializeTestApp,
  initRequestWithAuth,
  TestAppContext,
} from '../../../test/test.utils'
import { User } from '../../auth/auth.entity'
import { CreatePostInput } from '../contracts/posts.contract'
import { PostModule } from '../posts.module'

describe('postController (e2e)', () => {
  // We set a high timeout to have enough time to launch the testcontainers
  jest.setTimeout(60000)

  let testContext: TestAppContext
  let app: INestApplication
  let orm: MikroORM

  let em: EntityManager
  let testUser: User
  let requestWithAuth: ReturnType<typeof initRequestWithAuth>

  // We initialize the NestJS app and the database
  beforeAll(async () => {
    // Initialiser l'application de test
    testContext = await initializeTestApp({
      imports: [PostModule],
    })
    app = testContext.app
    orm = testContext.orm
    em = orm.em.fork()
  })

  // Before each test we clean the database to ensure we start with a fresh state
  beforeEach(async () => {
    await orm.schema.refreshDatabase()
    testUser = await createUserData(em)
    requestWithAuth = initRequestWithAuth(app, testUser.id)
  })

  // After all tests we close the NestJS app and the database, the testcontainer is shut down
  afterAll(async () => {
    await closeTestApp(testContext)
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
        const response = await requestWithAuth('post', '/admin/posts').send(createPostDto)

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
        const createResponse = await requestWithAuth('post', '/admin/posts').send({
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
        const publishResponse = await requestWithAuth('patch', `/admin/posts/${postId}/publish`)

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
        const createResponse = await requestWithAuth('post', '/admin/posts').send({
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
        await requestWithAuth('patch', `/admin/posts/${postId}/publish`)

        // Finally unpublish it
        await requestWithAuth('patch', `/admin/posts/${postId}/unpublish`)

        const unpublishResponse = await requestWithAuth('get', `/admin/posts/${postId}`)

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

import { Readable } from 'node:stream'
import { beforeEach, describe, expect, it } from 'vitest'
import { config } from '../../../../config/env.config'
import {
  IStorageProvider,
  STORAGE_PROVIDER,
  StorageProviderObject,
  StorageProviderUploadInput,
} from '../../../storage/providers/storage-provider.interface'
import { initializeTestApp } from '../../../../test/helpers/test-app.helper'
import { createRequest } from '../../../../test/helpers/test-auth.helper'
import { createUserWithSession } from '../../../../test/helpers/test-user.helpers'
import { DocumentModule } from '../document.module'

class InMemoryStorageProvider implements IStorageProvider {
  private readonly objects = new Map<
    string,
    Omit<StorageProviderObject, 'body'> & { body: Buffer }
  >()

  async upload(input: StorageProviderUploadInput): Promise<void> {
    this.objects.set(input.key, {
      body: input.body,
      contentType: input.contentType,
      filename: input.filename,
      size: input.size,
    })
  }

  async download(_bucket: string, key: string): Promise<StorageProviderObject | null> {
    const object = this.objects.get(key)
    if (!object) return null

    return {
      ...object,
      body: Readable.from(object.body),
    }
  }

  async delete(_bucket: string, key: string): Promise<void> {
    this.objects.delete(key)
  }
}

describe('DocumentController (e2e)', () => {
  beforeEach(async (context) => {
    const { orm, app } = await initializeTestApp(
      { orm: context.orm },
      {
        imports: [DocumentModule],
        providers: [
          {
            provide: STORAGE_PROVIDER,
            useValue: new InMemoryStorageProvider(),
          },
        ],
      },
    )
    context.app = app
    context.em = orm.em.fork()
    context.request = createRequest(app)
  })

  it('allows an owner to upload, download, and delete a document', async (context) => {
    const { session } = await createUserWithSession(context.em)

    const uploadResponse = await context.request
      .withSession(session)
      .post('/documents')
      .attach('file', Buffer.from('hello storage'), {
        filename: 'hello.txt',
        contentType: 'text/plain',
      })

    expect(uploadResponse.status).toBe(201)
    expect(uploadResponse.body).toMatchObject({
      id: expect.any(String),
      filename: 'hello.txt',
      mimeType: 'text/plain',
      size: 13,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    })
    expect(uploadResponse.body).not.toHaveProperty('storageKey')

    const documentId = uploadResponse.body.id
    const downloadResponse = await context.request
      .withSession(session)
      .get(`/documents/${documentId}`)

    expect(downloadResponse.status).toBe(200)
    expect(downloadResponse.headers['content-type']).toContain('text/plain')
    expect(downloadResponse.headers['content-disposition']).toContain('hello.txt')
    expect(downloadResponse.text).toBe('hello storage')

    const deleteResponse = await context.request
      .withSession(session)
      .del(`/documents/${documentId}`)

    expect(deleteResponse.status).toBe(204)
    await expect(
      context.request.withSession(session).get(`/documents/${documentId}`),
    ).resolves.toMatchObject({ status: 404 })
  })

  it('returns not found when another user reads or deletes a document', async (context) => {
    const { session: ownerSession } = await createUserWithSession(context.em, { name: 'Owner' })
    const { session: otherSession } = await createUserWithSession(context.em, { name: 'Other' })
    const uploadResponse = await context.request
      .withSession(ownerSession)
      .post('/documents')
      .attach('file', Buffer.from('private'), 'private.txt')
    const documentId = uploadResponse.body.id

    const downloadResponse = await context.request
      .withSession(otherSession)
      .get(`/documents/${documentId}`)
    const deleteResponse = await context.request
      .withSession(otherSession)
      .del(`/documents/${documentId}`)

    expect(downloadResponse.status).toBe(404)
    expect(deleteResponse.status).toBe(404)
    await expect(
      context.request.withSession(ownerSession).get(`/documents/${documentId}`),
    ).resolves.toMatchObject({ status: 200 })
  })

  it('rejects unauthenticated document requests', async (context) => {
    const documentId = '44b82136-0dd7-4b5f-a36b-38b26a4941aa'

    const uploadResponse = await context.request
      .post('/documents')
      .attach('file', Buffer.from('content'), 'file.txt')
    const downloadResponse = await context.request.get(`/documents/${documentId}`)
    const deleteResponse = await context.request.del(`/documents/${documentId}`)

    expect(uploadResponse.status).toBe(401)
    expect(downloadResponse.status).toBe(401)
    expect(deleteResponse.status).toBe(401)
  })

  it('rejects files above the configured size limit', async (context) => {
    const { session } = await createUserWithSession(context.em)

    const response = await context.request
      .withSession(session)
      .post('/documents')
      .attach('file', Buffer.alloc(config.storage.maxUploadSize + 1), 'large.bin')

    expect(response.status).toBe(413)
  })
})

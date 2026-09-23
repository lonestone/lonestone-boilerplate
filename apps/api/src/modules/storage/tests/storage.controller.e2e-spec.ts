import { Readable } from 'node:stream'
import { beforeEach, describe, expect, it } from 'vitest'
import { config } from '../../../config/env.config'
import { initializeTestApp } from '../../../test/helpers/test-app.helper'
import { createRequest } from '../../../test/helpers/test-auth.helper'
import { createUserWithSession } from '../../../test/helpers/test-user.helpers'
import {
  IStorageProvider,
  STORAGE_PROVIDER,
  StorageProviderObject,
  StorageProviderUploadInput,
} from '../providers/storage-provider.interface'
import { StorageModule } from '../storage.module'

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

describe('StorageController (e2e)', () => {
  let provider: InMemoryStorageProvider

  beforeEach(async (context) => {
    provider = new InMemoryStorageProvider()
    const { orm, app } = await initializeTestApp(
      { orm: context.orm },
      {
        imports: [StorageModule],
        providers: [
          {
            provide: STORAGE_PROVIDER,
            useValue: provider,
          },
        ],
      },
    )
    context.app = app
    context.em = orm.em.fork()
    context.request = createRequest(app)
  })

  it('uploads, downloads, and deletes a file', async (context) => {
    const { session } = await createUserWithSession(context.em)

    const uploadResponse = await context.request
      .withSession(session)
      .post('/storage')
      .attach('file', Buffer.from('hello storage'), {
        filename: 'hello.txt',
        contentType: 'text/plain',
      })

    expect(uploadResponse.status).toBe(201)
    expect(uploadResponse.body).toMatchObject({
      key: expect.any(String),
      filename: 'hello.txt',
      mimeType: 'text/plain',
      size: 13,
    })

    const downloadResponse = await context.request
      .withSession(session)
      .get(`/storage/${uploadResponse.body.key}`)

    expect(downloadResponse.status).toBe(200)
    expect(downloadResponse.headers['content-type']).toContain('text/plain')
    expect(downloadResponse.headers['content-disposition']).toContain('hello.txt')
    expect(downloadResponse.text).toBe('hello storage')

    const deleteResponse = await context.request
      .withSession(session)
      .del(`/storage/${uploadResponse.body.key}`)

    expect(deleteResponse.status).toBe(204)

    const missingResponse = await context.request
      .withSession(session)
      .get(`/storage/${uploadResponse.body.key}`)

    expect(missingResponse.status).toBe(404)
  })

  it('rejects requests without a session', async (context) => {
    const response = await context.request
      .post('/storage')
      .attach('file', Buffer.from('content'), 'file.txt')

    expect(response.status).toBe(401)
  })

  it('rejects files above the configured size limit', async (context) => {
    const { session } = await createUserWithSession(context.em)

    const response = await context.request
      .withSession(session)
      .post('/storage')
      .attach('file', Buffer.alloc(config.storage.maxUploadSize + 1), 'large.bin')

    expect(response.status).toBe(413)
  })
})

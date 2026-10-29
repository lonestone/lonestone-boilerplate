import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { afterEach, beforeEach, describe, expect, it, MockInstance, vi } from 'vitest'
import { S3StorageProvider, S3StorageProviderOptions } from '../providers/s3-storage.provider'

describe('S3StorageProvider', () => {
  const options: S3StorageProviderOptions = {
    bucket: 'test-bucket',
    endpoint: 'http://localhost:9000',
    region: 'us-east-1',
    accessKeyId: 'access-key',
    secretAccessKey: 'secret-key',
    forcePathStyle: true,
    createBucket: true,
    signedUrlExpiresIn: 600,
  }
  let send: MockInstance<(command: object) => Promise<unknown>>
  let provider: S3StorageProvider

  beforeEach(() => {
    send = vi.spyOn(S3Client.prototype, 'send') as unknown as MockInstance<
      (command: object) => Promise<unknown>
    >
    provider = new S3StorageProvider(options)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('uploads content and metadata', async () => {
    send.mockResolvedValue({})

    await provider.upload({
      key: 'object-key',
      body: Buffer.from('content'),
      contentType: 'text/plain',
      filename: 'résumé.txt',
      size: 7,
    })

    const command = send.mock.calls[0]?.[0]
    expect(command).toBeInstanceOf(PutObjectCommand)
    if (!(command instanceof PutObjectCommand)) throw new Error('Expected a put object command')
    expect(command.input).toMatchObject({
      Bucket: 'test-bucket',
      Key: 'object-key',
      ContentLength: 7,
      ContentType: 'text/plain',
      Metadata: {
        filename: 'r%C3%A9sum%C3%A9.txt',
      },
    })
  })

  it('deletes an object', async () => {
    send.mockResolvedValue({})

    await provider.delete('object-key')

    const command = send.mock.calls[0]?.[0]
    expect(command).toBeInstanceOf(DeleteObjectCommand)
    if (!(command instanceof DeleteObjectCommand)) throw new Error('Expected a delete command')
    expect(command.input).toEqual({
      Bucket: 'test-bucket',
      Key: 'object-key',
    })
  })

  it('signs a GET URL with the configured expiry and response headers', async () => {
    vi.useFakeTimers({ now: new Date('2026-01-01T00:07:00.000Z') })

    const actualSignedUrl = await provider.getSignedUrl('object-key', {
      filename: "l'été.png",
      mimeType: 'image/png',
    })

    const actualUrl = new URL(actualSignedUrl.url)
    expect(actualUrl.origin).toBe('http://localhost:9000')
    expect(actualUrl.pathname).toBe('/test-bucket/object-key')
    expect(actualUrl.searchParams.get('X-Amz-Date')).toBe('20260101T000500Z')
    expect(actualUrl.searchParams.get('X-Amz-Expires')).toBe('600')
    expect(actualUrl.searchParams.get('X-Amz-Signature')).toEqual(expect.any(String))
    expect(actualUrl.searchParams.get('response-content-type')).toBe('image/png')
    expect(actualUrl.searchParams.get('response-content-disposition')).toBe(
      "inline; filename*=UTF-8''l%27%C3%A9t%C3%A9.png",
    )
    expect(actualUrl.searchParams.get('response-cache-control')).toBe(
      'private, max-age=600, immutable',
    )
    expect(actualSignedUrl.expiresAt).toEqual(new Date('2026-01-01T00:15:00.000Z'))
    expect(send).not.toHaveBeenCalled()
  })

  it('returns the same URL for every call within a signing window', async () => {
    const inputOptions = { filename: 'cover.png', mimeType: 'image/png' }
    vi.useFakeTimers({ now: new Date('2026-01-01T00:05:00.000Z') })
    const firstSignedUrl = await provider.getSignedUrl('object-key', inputOptions)

    vi.setSystemTime(new Date('2026-01-01T00:09:59.999Z'))
    const sameWindowSignedUrl = await provider.getSignedUrl('object-key', inputOptions)

    vi.setSystemTime(new Date('2026-01-01T00:10:00.000Z'))
    const nextWindowSignedUrl = await provider.getSignedUrl('object-key', inputOptions)

    expect(sameWindowSignedUrl).toEqual(firstSignedUrl)
    expect(nextWindowSignedUrl.url).not.toBe(firstSignedUrl.url)
  })

  it('creates the default bucket when it is missing', async () => {
    const error = new Error('missing')
    error.name = 'NotFound'
    send.mockRejectedValueOnce(error).mockResolvedValueOnce({})

    await provider.onModuleInit()

    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(HeadBucketCommand)
    const createCommand = send.mock.calls[1]?.[0]
    expect(createCommand).toBeInstanceOf(CreateBucketCommand)
    if (!(createCommand instanceof CreateBucketCommand)) {
      throw new Error('Expected a create bucket command')
    }
    expect(createCommand.input).toEqual({
      Bucket: 'test-bucket',
      CreateBucketConfiguration: undefined,
    })
  })

  it('does not inspect the bucket when initialization is disabled', async () => {
    provider = new S3StorageProvider({ ...options, createBucket: false })

    await provider.onModuleInit()

    expect(send).not.toHaveBeenCalled()
  })

  it('does not create a bucket for non-missing-bucket failures', async () => {
    const error = new Error('forbidden')
    error.name = 'AccessDenied'
    send.mockRejectedValue(error)

    await expect(provider.onModuleInit()).rejects.toBe(error)
    expect(send).toHaveBeenCalledTimes(1)
  })
})

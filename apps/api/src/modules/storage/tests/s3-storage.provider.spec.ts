import { Readable } from 'node:stream'
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  }
  let send: ReturnType<typeof vi.fn<(command: object) => Promise<unknown>>>
  let provider: S3StorageProvider

  beforeEach(() => {
    send = vi.fn<(command: object) => Promise<unknown>>()
    provider = new S3StorageProvider(options, { send })
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

  it('returns a readable object with decoded metadata', async () => {
    const body = Readable.from('content')
    send.mockResolvedValue({
      Body: body,
      ContentLength: 7,
      ContentType: 'text/plain',
      Metadata: {
        filename: 'r%C3%A9sum%C3%A9.txt',
      },
    })

    const actualObject = await provider.download('object-key')

    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(GetObjectCommand)
    expect(actualObject).toEqual({
      body,
      contentType: 'text/plain',
      filename: 'résumé.txt',
      size: 7,
    })
  })

  it('returns null when an object does not exist', async () => {
    const error = new Error('missing')
    error.name = 'NoSuchKey'
    send.mockRejectedValue(error)

    await expect(provider.download('object-key')).resolves.toBeNull()
  })

  it('keeps a missing bucket as an infrastructure failure', async () => {
    const error = new Error('missing bucket')
    error.name = 'NoSuchBucket'
    send.mockRejectedValue(error)

    await expect(provider.download('object-key')).rejects.toBe(error)
  })

  it('rejects invalid object responses', async () => {
    send.mockResolvedValue({
      Body: 'not-a-readable-stream',
    })

    await expect(provider.download('object-key')).rejects.toThrow(
      'The storage provider returned an invalid object stream',
    )
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
    provider = new S3StorageProvider({ ...options, createBucket: false }, { send })

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

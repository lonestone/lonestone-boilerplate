import { Readable } from 'node:stream'
import {
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IStorageProvider, StorageUnavailableError } from '../providers/storage-provider.interface'
import { StorageService } from '../storage.service'

describe('StorageService', () => {
  let provider: IStorageProvider
  let service: StorageService

  beforeEach(() => {
    provider = {
      upload: vi.fn(),
      download: vi.fn(),
      delete: vi.fn(),
    }
    service = new StorageService(provider)
  })

  it('uploads an object with generated provider-neutral metadata', async () => {
    const file = {
      body: Buffer.from('content'),
      filename: 'report.txt',
      mimeType: 'text/plain',
      size: 7,
    }

    const actualObject = await service.upload(file)

    expect(actualObject).toMatchObject({
      key: expect.any(String),
      filename: file.filename,
      mimeType: file.mimeType,
      size: file.size,
    })
    expect(provider.upload).toHaveBeenCalledWith({
      key: actualObject.key,
      body: file.body,
      contentType: file.mimeType,
      filename: file.filename,
      size: file.size,
    })
  })

  it('returns a provider object for streaming', async () => {
    const expectedObject = {
      body: Readable.from('content'),
      contentType: 'text/plain',
      filename: 'report.txt',
      size: 7,
    }
    vi.mocked(provider.download).mockResolvedValue(expectedObject)

    const actualObject = await service.download('44b82136-0dd7-4b5f-a36b-38b26a4941aa')

    expect(actualObject).toBe(expectedObject)
  })

  it('maps a missing object to a not found exception', async () => {
    vi.mocked(provider.download).mockResolvedValue(null)

    await expect(service.download('44b82136-0dd7-4b5f-a36b-38b26a4941aa')).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })

  it('normalizes provider failures', async () => {
    const providerError = new Error('S3 unavailable')
    vi.mocked(provider.upload).mockRejectedValue(providerError)

    await expect(
      service.upload({
        body: Buffer.from('content'),
        filename: 'report.txt',
        mimeType: 'text/plain',
        size: 7,
      }),
    ).rejects.toMatchObject({
      constructor: InternalServerErrorException,
      cause: providerError,
    })
  })

  it('maps disabled storage to a service unavailable exception', async () => {
    vi.mocked(provider.upload).mockRejectedValue(new StorageUnavailableError())

    await expect(
      service.upload({
        body: Buffer.from('content'),
        filename: 'report.txt',
        mimeType: 'text/plain',
        size: 7,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException)
  })

  it('preserves download failures as their exception cause', async () => {
    const providerError = new Error('S3 unavailable')
    vi.mocked(provider.download).mockRejectedValue(providerError)

    await expect(service.download('44b82136-0dd7-4b5f-a36b-38b26a4941aa')).rejects.toMatchObject({
      cause: providerError,
    })
  })

  it('preserves delete failures as their exception cause', async () => {
    const providerError = new Error('S3 unavailable')
    vi.mocked(provider.delete).mockRejectedValue(providerError)

    await expect(service.delete('44b82136-0dd7-4b5f-a36b-38b26a4941aa')).rejects.toMatchObject({
      cause: providerError,
    })
  })

  it('deletes an object by key', async () => {
    await service.delete('44b82136-0dd7-4b5f-a36b-38b26a4941aa')

    expect(provider.delete).toHaveBeenCalledWith('44b82136-0dd7-4b5f-a36b-38b26a4941aa')
  })
})

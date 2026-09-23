import { Readable } from 'node:stream'
import { EntityManager } from '@mikro-orm/core'
import { InternalServerErrorException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StorageService } from '../../../storage/storage.service'
import { Document } from '../document.entity'
import { DocumentService } from '../document.service'

describe('DocumentService', () => {
  let em: EntityManager
  let storageService: StorageService
  let service: DocumentService

  beforeEach(() => {
    em = {
      findOne: vi.fn(),
      flush: vi.fn(),
      getReference: vi.fn().mockReturnValue({ id: 'owner-id' }),
      persist: vi.fn(),
      remove: vi.fn(),
    } as unknown as EntityManager
    storageService = {
      upload: vi.fn(),
      download: vi.fn(),
      delete: vi.fn(),
    } as unknown as StorageService
    service = new DocumentService(em, storageService)
  })

  it('stores document metadata after uploading an object', async () => {
    vi.mocked(storageService.upload).mockResolvedValue({
      key: 'storage-key',
      filename: 'report.txt',
      mimeType: 'text/plain',
      size: 7,
    })

    const document = await service.upload('owner-id', {
      body: Buffer.from('content'),
      filename: 'report.txt',
      mimeType: 'text/plain',
      size: 7,
    })

    expect(document).toMatchObject({
      storageKey: 'storage-key',
      filename: 'report.txt',
      mimeType: 'text/plain',
      size: 7,
    })
    expect(em.persist).toHaveBeenCalledWith(document)
    expect(em.flush).toHaveBeenCalled()
  })

  it('deletes the uploaded object when saving metadata fails', async () => {
    const persistenceError = new Error('database unavailable')
    vi.mocked(storageService.upload).mockResolvedValue({
      key: 'storage-key',
      filename: 'report.txt',
      mimeType: 'text/plain',
      size: 7,
    })
    vi.mocked(em.flush).mockRejectedValue(persistenceError)

    await expect(
      service.upload('owner-id', {
        body: Buffer.from('content'),
        filename: 'report.txt',
        mimeType: 'text/plain',
        size: 7,
      }),
    ).rejects.toMatchObject({
      constructor: InternalServerErrorException,
      cause: persistenceError,
    })
    expect(storageService.delete).toHaveBeenCalledWith('storage-key')
  })

  it('downloads an owned document by its private storage key', async () => {
    const document = Object.assign(new Document(), {
      id: 'document-id',
      storageKey: 'storage-key',
    })
    const object = {
      body: Readable.from('content'),
      contentType: 'text/plain',
      filename: 'report.txt',
      size: 7,
    }
    vi.mocked(em.findOne).mockResolvedValue(document)
    vi.mocked(storageService.download).mockResolvedValue(object)

    const result = await service.download('document-id', 'owner-id')

    expect(em.findOne).toHaveBeenCalledWith(Document, {
      id: 'document-id',
      owner: 'owner-id',
    })
    expect(storageService.download).toHaveBeenCalledWith('storage-key')
    expect(result).toEqual({ document, object })
  })

  it('returns not found when the document is not owned by the user', async () => {
    vi.mocked(em.findOne).mockResolvedValue(null)

    await expect(service.download('document-id', 'other-owner-id')).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })

  it('deletes the object and its owned metadata', async () => {
    const document = Object.assign(new Document(), {
      id: 'document-id',
      storageKey: 'storage-key',
    })
    vi.mocked(em.findOne).mockResolvedValue(document)

    await service.delete('document-id', 'owner-id')

    expect(storageService.delete).toHaveBeenCalledWith('storage-key')
    expect(em.remove).toHaveBeenCalledWith(document)
    expect(em.flush).toHaveBeenCalled()
  })
})

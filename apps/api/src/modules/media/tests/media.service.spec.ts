import { EntityManager } from '@mikro-orm/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StorageService } from '../../storage/storage.service'
import { Media } from '../media.entity'
import { MediaService } from '../media.service'

const imageUpload = {
  body: Buffer.from('image-bytes'),
  filename: 'cover.png',
  mimeType: 'image/png',
  size: 11,
}

describe('MediaService', () => {
  let em: EntityManager
  let storageService: StorageService
  let service: MediaService

  beforeEach(() => {
    em = {
      persist: vi.fn(),
      flush: vi.fn(),
    } as unknown as EntityManager
    storageService = {
      upload: vi.fn(),
      delete: vi.fn(),
    } as unknown as StorageService
    service = new MediaService(em, storageService)
  })

  it('uploads the bytes and persists a media without flushing', async () => {
    vi.mocked(storageService.upload).mockResolvedValue({
      key: 'new-key',
      filename: imageUpload.filename,
      mimeType: imageUpload.mimeType,
      size: imageUpload.size,
    })

    const actualMedia = await service.create(imageUpload)

    expect(storageService.upload).toHaveBeenCalledWith(imageUpload)
    expect(actualMedia).toBeInstanceOf(Media)
    expect(actualMedia).toMatchObject({
      storageKey: 'new-key',
      filename: 'cover.png',
      mimeType: 'image/png',
      size: 11,
    })
    expect(em.persist).toHaveBeenCalledWith(actualMedia)
    expect(em.flush).not.toHaveBeenCalled()
  })

  it('does not persist a media when the upload fails', async () => {
    const uploadError = new Error('storage unavailable')
    vi.mocked(storageService.upload).mockRejectedValue(uploadError)

    await expect(service.create(imageUpload)).rejects.toBe(uploadError)

    expect(em.persist).not.toHaveBeenCalled()
  })

  it('deletes an object by storage key', async () => {
    await service.deleteObject('stored-key')

    expect(storageService.delete).toHaveBeenCalledWith('stored-key')
  })
})

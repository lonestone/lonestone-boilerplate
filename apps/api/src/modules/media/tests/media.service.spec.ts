import { EntityManager } from '@mikro-orm/core'
import { Logger } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StorageService } from '../../storage/storage.service'
import { Media } from '../media.entity'
import { MediaService } from '../media.service'

const imageFile = new File([Buffer.from('image-bytes')], 'cover.png', { type: 'image/png' })

function createStoredMedia(storageKey: string): Media {
  return Object.assign(new Media(), {
    storageKey,
    filename: 'old.png',
    mimeType: 'image/png',
    size: 3,
  })
}

describe('MediaService', () => {
  let em: EntityManager
  let storageService: StorageService
  let service: MediaService

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    em = {
      persist: vi.fn(),
    } as unknown as EntityManager
    storageService = {
      upload: vi.fn().mockResolvedValue({
        key: 'new-key',
        filename: 'cover.png',
        mimeType: 'image/png',
        size: 11,
      }),
      delete: vi.fn(),
    } as unknown as StorageService
    service = new MediaService(em, storageService)
  })

  describe('upload', () => {
    it('stores the file and returns a media that is not persisted yet', async () => {
      const actualMedia = await service.upload(imageFile)

      expect(storageService.upload).toHaveBeenCalledWith({
        body: Buffer.from('image-bytes'),
        filename: 'cover.png',
        mimeType: 'image/png',
        size: 11,
      })
      expect(actualMedia).toBeInstanceOf(Media)
      expect(actualMedia).toMatchObject({
        storageKey: 'new-key',
        filename: 'cover.png',
        mimeType: 'image/png',
        size: 11,
      })
      expect(em.persist).not.toHaveBeenCalled()
    })

    it('rethrows the storage error', async () => {
      const uploadError = new Error('storage unavailable')
      vi.mocked(storageService.upload).mockRejectedValue(uploadError)

      await expect(service.upload(imageFile)).rejects.toBe(uploadError)
    })
  })

  describe('attach', () => {
    it('persists the media without flushing', () => {
      const inputMedia = createStoredMedia('new-key')

      const actualMedia = service.attach(inputMedia)

      expect(em.persist).toHaveBeenCalledWith(inputMedia)
      expect(actualMedia).toBe(inputMedia)
    })
  })

  describe('remove', () => {
    it('deletes the media object from the bucket', async () => {
      await service.remove(createStoredMedia('old-key'))

      expect(storageService.delete).toHaveBeenCalledWith('old-key')
    })

    it('does not throw when the object cannot be deleted', async () => {
      vi.mocked(storageService.delete).mockRejectedValue(new Error('storage unavailable'))

      await expect(service.remove(createStoredMedia('old-key'))).resolves.toBeUndefined()
      expect(Logger.prototype.error).toHaveBeenCalled()
    })
  })
})

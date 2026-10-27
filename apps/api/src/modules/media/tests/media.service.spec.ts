import { EntityManager } from '@mikro-orm/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StorageService } from '../../storage/storage.service'
import { Media } from '../media.entity'
import { MediaService } from '../media.service'

const inputFile = new File([Buffer.from('image-bytes')], 'cover.png', { type: 'image/png' })

function createMedia(storageKey: string): Media {
  return Object.assign(new Media(), { storageKey })
}

describe('MediaService', () => {
  let em: EntityManager
  let storageService: StorageService
  let service: MediaService

  beforeEach(() => {
    em = { persist: vi.fn() } as unknown as EntityManager
    storageService = {
      upload: vi.fn().mockResolvedValue({
        key: 'new-key',
        filename: 'cover.png',
        mimeType: 'image/png',
        size: 11,
      }),
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as StorageService
    service = new MediaService(em, storageService)
  })

  describe('upload', () => {
    it('stores the file and returns a media that is not persisted yet', async () => {
      const actualMedia = await service.upload(inputFile)

      expect(storageService.upload).toHaveBeenCalledWith({
        body: Buffer.from('image-bytes'),
        filename: 'cover.png',
        mimeType: 'image/png',
        size: 11,
      })
      expect(actualMedia).toBeInstanceOf(Media)
      expect(actualMedia).toMatchObject({ storageKey: 'new-key', filename: 'cover.png', size: 11 })
      expect(em.persist).not.toHaveBeenCalled()
    })

    it('propagates a storage failure', async () => {
      const expectedError = new Error('storage unavailable')
      vi.mocked(storageService.upload).mockRejectedValue(expectedError)

      await expect(service.upload(inputFile)).rejects.toBe(expectedError)
    })
  })

  describe('attach', () => {
    it('persists the media and returns it', () => {
      const inputMedia = createMedia('new-key')

      const actualMedia = service.attach(inputMedia)

      expect(em.persist).toHaveBeenCalledWith(inputMedia)
      expect(actualMedia).toBe(inputMedia)
    })
  })

  describe('remove', () => {
    it('deletes the file from the bucket', async () => {
      await service.remove(createMedia('old-key'))

      expect(storageService.delete).toHaveBeenCalledWith('old-key')
    })

    it('does not throw when the deletion fails', async () => {
      vi.mocked(storageService.delete).mockRejectedValue(new Error('storage unavailable'))

      await expect(service.remove(createMedia('old-key'))).resolves.toBeUndefined()
    })
  })
})

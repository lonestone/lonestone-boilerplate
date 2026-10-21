import { EntityManager } from '@mikro-orm/core'
import { Logger } from '@nestjs/common'
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
      remove: vi.fn(),
      flush: vi.fn(),
    } as unknown as EntityManager
    storageService = {
      upload: vi.fn().mockResolvedValue({
        key: 'new-key',
        filename: imageUpload.filename,
        mimeType: imageUpload.mimeType,
        size: imageUpload.size,
      }),
      delete: vi.fn(),
    } as unknown as StorageService
    service = new MediaService(em, storageService)
  })

  describe('replace', () => {
    it('uploads, attaches and flushes a first media', async () => {
      const mockAttach = vi.fn()

      const actualMedia = await service.replace({ upload: imageUpload, attach: mockAttach })

      expect(storageService.upload).toHaveBeenCalledWith(imageUpload)
      expect(actualMedia).toBeInstanceOf(Media)
      expect(actualMedia).toMatchObject({
        storageKey: 'new-key',
        filename: 'cover.png',
        mimeType: 'image/png',
        size: 11,
      })
      expect(em.persist).toHaveBeenCalledWith(actualMedia)
      expect(mockAttach).toHaveBeenCalledWith(actualMedia)
      expect(em.flush).toHaveBeenCalled()
      expect(storageService.delete).not.toHaveBeenCalled()
    })

    it('removes the previous media and deletes its object after the flush', async () => {
      const inputCurrent = createStoredMedia('old-key')

      await service.replace({ current: inputCurrent, upload: imageUpload, attach: vi.fn() })

      expect(em.remove).toHaveBeenCalledWith(inputCurrent)
      expect(storageService.delete).toHaveBeenCalledWith('old-key')
      expect(vi.mocked(em.flush).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(storageService.delete).mock.invocationCallOrder[0],
      )
    })

    it('does not persist anything when the upload fails', async () => {
      const uploadError = new Error('storage unavailable')
      vi.mocked(storageService.upload).mockRejectedValue(uploadError)
      const mockAttach = vi.fn()

      await expect(service.replace({ upload: imageUpload, attach: mockAttach })).rejects.toBe(
        uploadError,
      )

      expect(em.persist).not.toHaveBeenCalled()
      expect(mockAttach).not.toHaveBeenCalled()
    })

    it('deletes the new object and rethrows the original error when the flush fails', async () => {
      const flushError = new Error('unique constraint')
      vi.mocked(em.flush).mockRejectedValue(flushError)
      const inputCurrent = createStoredMedia('old-key')

      await expect(
        service.replace({ current: inputCurrent, upload: imageUpload, attach: vi.fn() }),
      ).rejects.toBe(flushError)

      expect(storageService.delete).toHaveBeenCalledTimes(1)
      expect(storageService.delete).toHaveBeenCalledWith('new-key')
    })

    it('rethrows the original error even when the cleanup fails', async () => {
      const flushError = new Error('unique constraint')
      vi.mocked(em.flush).mockRejectedValue(flushError)
      vi.mocked(storageService.delete).mockRejectedValue(new Error('storage unavailable'))

      await expect(service.replace({ upload: imageUpload, attach: vi.fn() })).rejects.toBe(
        flushError,
      )
    })

    it('keeps the new media when the previous object cannot be deleted', async () => {
      vi.mocked(storageService.delete).mockRejectedValue(new Error('storage unavailable'))

      const actualMedia = await service.replace({
        current: createStoredMedia('old-key'),
        upload: imageUpload,
        attach: vi.fn(),
      })

      expect(actualMedia.storageKey).toBe('new-key')
    })
  })

  describe('remove', () => {
    it('detaches the media, flushes, then deletes its object', async () => {
      const inputMedia = createStoredMedia('old-key')
      const mockDetach = vi.fn()

      await service.remove({ media: inputMedia, detach: mockDetach })

      expect(mockDetach).toHaveBeenCalled()
      expect(em.remove).toHaveBeenCalledWith(inputMedia)
      expect(storageService.delete).toHaveBeenCalledWith('old-key')
      expect(vi.mocked(em.flush).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(storageService.delete).mock.invocationCallOrder[0],
      )
    })

    it('keeps the object when the flush fails', async () => {
      const flushError = new Error('database unavailable')
      vi.mocked(em.flush).mockRejectedValue(flushError)

      await expect(
        service.remove({ media: createStoredMedia('old-key'), detach: vi.fn() }),
      ).rejects.toBe(flushError)

      expect(storageService.delete).not.toHaveBeenCalled()
    })
  })
})

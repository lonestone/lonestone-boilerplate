import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StorageService } from '../../storage/storage.service'
import { mediaSchema } from '../contracts/media.contract'
import { Media } from '../media.entity'
import { MediaMapper } from '../media.mapper'

describe('MediaMapper', () => {
  let storageService: StorageService
  let mapper: MediaMapper

  beforeEach(() => {
    storageService = {
      getSignedUrl: vi.fn(),
    } as unknown as StorageService
    mapper = new MediaMapper(storageService)
  })

  it('maps a media to its public contract with a signed URL', async () => {
    const inputMedia = Object.assign(new Media(), {
      id: '44b82136-0dd7-4b5f-a36b-38b26a4941aa',
      storageKey: 'secret-storage-key',
      filename: 'cover.png',
      mimeType: 'image/png',
      size: 11,
    })
    const mockSignedUrl = {
      url: 'https://storage.test/signed?X-Amz-Signature=signature',
      expiresAt: new Date('2026-01-01T01:00:00.000Z'),
    }
    vi.mocked(storageService.getSignedUrl).mockResolvedValue(mockSignedUrl)

    const actualMedia = await mapper.toMedia(inputMedia)

    expect(storageService.getSignedUrl).toHaveBeenCalledWith('secret-storage-key', {
      filename: 'cover.png',
      mimeType: 'image/png',
    })
    expect(actualMedia).toEqual({
      id: '44b82136-0dd7-4b5f-a36b-38b26a4941aa',
      filename: 'cover.png',
      mimeType: 'image/png',
      size: 11,
      url: mockSignedUrl.url,
      expiresAt: mockSignedUrl.expiresAt,
    })
    expect(actualMedia).not.toHaveProperty('storageKey')
    expect(JSON.stringify(actualMedia)).not.toContain('secret-storage-key')
    expect(mediaSchema.safeParse(actualMedia).success).toBe(true)
  })
})

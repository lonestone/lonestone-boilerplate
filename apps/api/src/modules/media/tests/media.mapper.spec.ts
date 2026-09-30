import { describe, expect, it } from 'vitest'
import { mediaSchema } from '../contracts/media.contract'
import { Media } from '../media.entity'
import { MediaMapper } from '../media.mapper'

describe('MediaMapper', () => {
  it('maps a media to its public contract without the storage key', () => {
    const inputMedia = Object.assign(new Media(), {
      id: '44b82136-0dd7-4b5f-a36b-38b26a4941aa',
      storageKey: 'secret-storage-key',
      filename: 'cover.png',
      mimeType: 'image/png',
      size: 11,
    })

    const actualMedia = new MediaMapper().toMedia(inputMedia)

    expect(actualMedia).toEqual({
      id: '44b82136-0dd7-4b5f-a36b-38b26a4941aa',
      filename: 'cover.png',
      mimeType: 'image/png',
      size: 11,
    })
    expect(actualMedia).not.toHaveProperty('storageKey')
    expect(JSON.stringify(actualMedia)).not.toContain('secret-storage-key')
    expect(mediaSchema.safeParse(actualMedia).success).toBe(true)
  })
})

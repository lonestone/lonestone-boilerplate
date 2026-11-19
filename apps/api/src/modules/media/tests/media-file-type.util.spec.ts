import { describe, expect, it } from 'vitest'
import { detectMimeType } from '../media-file-type.util'

describe('detectMimeType', () => {
  it.each([
    ['image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])],
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0])],
    ['image/gif', Buffer.from('GIF89a...')],
    ['image/gif', Buffer.from('GIF87a...')],
    ['image/webp', Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')])],
  ])('detects %s from its first bytes', (expectedMimeType, inputBuffer) => {
    expect(detectMimeType(inputBuffer)).toBe(expectedMimeType)
  })

  it('returns null for an unknown type', () => {
    expect(detectMimeType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull()
  })

  it('returns null for a buffer shorter than any signature', () => {
    expect(detectMimeType(Buffer.from([0x89]))).toBeNull()
  })
})

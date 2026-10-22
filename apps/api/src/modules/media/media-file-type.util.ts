const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff])
const GIF87A_SIGNATURE = Buffer.from('GIF87a')
const GIF89A_SIGNATURE = Buffer.from('GIF89a')

/** File types recognized from their first bytes. Add a signature here to accept a new type. */
export type DetectableMimeType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

export const IMAGE_MIME_TYPES: readonly DetectableMimeType[] = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]

function hasPrefix(buffer: Buffer, signature: Buffer): boolean {
  return buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature)
}

/**
 * Detects the real type of a file from its first bytes, so the MIME type sent by the client
 * is never trusted. Returns null for an unknown type.
 */
export function detectMimeType(buffer: Buffer): DetectableMimeType | null {
  if (hasPrefix(buffer, JPEG_SIGNATURE)) return 'image/jpeg'
  if (hasPrefix(buffer, PNG_SIGNATURE)) return 'image/png'
  if (hasPrefix(buffer, GIF87A_SIGNATURE) || hasPrefix(buffer, GIF89A_SIGNATURE)) return 'image/gif'
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }

  return null
}

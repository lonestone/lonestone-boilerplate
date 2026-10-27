const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff])
const GIF87A_SIGNATURE = Buffer.from('GIF87a')
const GIF89A_SIGNATURE = Buffer.from('GIF89a')

function hasPrefix(buffer: Buffer, signature: Buffer): boolean {
  return buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature)
}

function isWebp(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  )
}

/**
 * Reads the MIME type from the file's first bytes. The type sent by the client is never trusted.
 * Add a signature here to accept a new format.
 * @returns The detected MIME type, or `application/octet-stream` when the format is unknown.
 */
export function detectMimeType(buffer: Buffer): string {
  if (hasPrefix(buffer, JPEG_SIGNATURE)) return 'image/jpeg'
  if (hasPrefix(buffer, PNG_SIGNATURE)) return 'image/png'
  if (hasPrefix(buffer, GIF87A_SIGNATURE) || hasPrefix(buffer, GIF89A_SIGNATURE)) return 'image/gif'
  if (isWebp(buffer)) return 'image/webp'

  return 'application/octet-stream'
}

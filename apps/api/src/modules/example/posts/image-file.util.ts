import { BadRequestException, PayloadTooLargeException } from '@nestjs/common'
import { StorageUpload } from '../../storage/storage.service'

export const POST_COVER_IMAGE_MAX_SIZE_BYTES = 10 * 1024 * 1024

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff])
const GIF87A_SIGNATURE = Buffer.from('GIF87a')
const GIF89A_SIGNATURE = Buffer.from('GIF89a')

export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const

export type SupportedImageMimeType = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number]

function hasPrefix(buffer: Buffer, signature: Buffer): boolean {
  return buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature)
}

/**
 * Detects the MIME type of an image file based on its signature (for security reasons).
 * @param buffer - The buffer containing the image file.
 * @returns The MIME type of the image, or null if the MIME type is not supported.
 */
export function detectImageMimeType(buffer: Buffer): SupportedImageMimeType | null {
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

export function parsePostImageFile(file: Express.Multer.File): StorageUpload {
  if (file.size > POST_COVER_IMAGE_MAX_SIZE_BYTES) {
    throw new PayloadTooLargeException('Image exceeds the 10 MiB size limit')
  }

  const mimeType = detectImageMimeType(file.buffer)
  if (!mimeType) {
    throw new BadRequestException(
      'Unsupported image format. Allowed formats: JPEG, PNG, GIF, and WebP',
    )
  }

  return {
    body: file.buffer,
    filename: file.originalname || 'image',
    mimeType,
    size: file.size,
  }
}

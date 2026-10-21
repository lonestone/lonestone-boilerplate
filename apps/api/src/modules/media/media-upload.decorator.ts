import {
  applyDecorators,
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  UnsupportedMediaTypeException,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBody, ApiConsumes } from '@nestjs/swagger'
import type { Request } from 'express'
import { StorageUpload } from '../storage/storage.service'
import { DetectableMimeType, detectMimeType } from './media-file-type.util'

const MEDIA_UPLOAD_FIELD = 'file'
const MEDIA_UPLOAD_RULES = Symbol('MEDIA_UPLOAD_RULES')

export interface MediaUploadRules {
  maxSizeBytes: number
  mimeTypes: readonly DetectableMimeType[]
}

/**
 * Turns a route into a single-file `multipart/form-data` upload, sent in a `file` field.
 * Documents the body in OpenAPI so the generated client sends `FormData`.
 * Read the validated file with `@UploadedMedia()`.
 */
export function MediaUpload(rules: MediaUploadRules): MethodDecorator {
  return applyDecorators(
    SetMetadata(MEDIA_UPLOAD_RULES, rules),
    UseInterceptors(
      FileInterceptor(MEDIA_UPLOAD_FIELD, {
        limits: { fileSize: rules.maxSizeBytes, files: 1 },
      }),
    ),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      required: true,
      schema: {
        type: 'object',
        required: [MEDIA_UPLOAD_FIELD],
        properties: {
          [MEDIA_UPLOAD_FIELD]: {
            type: 'string',
            format: 'binary',
            description: `Accepted types: ${rules.mimeTypes.join(', ')}. Maximum size: ${rules.maxSizeBytes} bytes.`,
          },
        },
      },
    }),
  )
}

/**
 * Returns the file of a `@MediaUpload()` route, ready for `MediaService`.
 * Its type is read from its first bytes: the MIME type sent by the client is ignored.
 */
export const UploadedMedia = createParamDecorator(
  (_: unknown, context: ExecutionContext): StorageUpload => {
    const rules: MediaUploadRules | undefined = Reflect.getMetadata(
      MEDIA_UPLOAD_RULES,
      context.getHandler(),
    )
    if (!rules) throw new Error('@UploadedMedia() requires @MediaUpload() on the same route')

    const { file } = context.switchToHttp().getRequest<Request>()
    if (!file) throw new BadRequestException(`A "${MEDIA_UPLOAD_FIELD}" file is required`)

    const mimeType = detectMimeType(file.buffer)
    if (!mimeType || !rules.mimeTypes.includes(mimeType)) {
      throw new UnsupportedMediaTypeException(
        `Unsupported file type. Accepted types: ${rules.mimeTypes.join(', ')}`,
      )
    }

    return {
      body: file.buffer,
      filename: file.originalname || MEDIA_UPLOAD_FIELD,
      mimeType,
      size: file.size,
    }
  },
)

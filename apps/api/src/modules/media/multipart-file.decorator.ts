import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Request } from 'express'
import { Observable } from 'rxjs'
import { detectMimeType } from './media-file-type.util'

const UNKNOWN_MIME_TYPE = 'application/octet-stream'

interface MultipartFileOptions {
  maxSize: number
  /**
   * Text fields accepted next to the file. Defaults to none, so a text field cannot be used to
   * send more data than `maxSize`. Set it on routes whose schema declares text fields.
   */
  maxFields?: number
}

@Injectable()
class FileToBodyInterceptor implements NestInterceptor {
  constructor(private readonly fieldName: string) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>()

    if (request.file) {
      const { buffer, originalname } = request.file
      request.body = {
        ...request.body,
        [this.fieldName]: new File([new Uint8Array(buffer)], originalname || this.fieldName, {
          type: detectMimeType(buffer) ?? UNKNOWN_MIME_TYPE,
        }),
      }
    }

    return next.handle()
  }
}

/**
 * Accepts one file from a multipart field and adds it to the body as a `File`, so the route's
 * `TypedMultipartBody` schema validates it with `z.file()`. Declare the field in that schema to
 * document it in OpenAPI.
 *
 * The file's type is read from its first bytes: the MIME type sent by the client is ignored.
 * `maxSize` stops Multer before an oversized file is loaded in memory (413).
 *
 * @example
 * @MultipartFile('file', { maxSize: 10 * 1024 * 1024 })
 * async setCoverImage(@TypedMultipartBody(setCoverImageSchema) body: SetCoverImageInput) {}
 */
export function MultipartFile(fieldName: string, options: MultipartFileOptions): MethodDecorator {
  const maxFields = options.maxFields ?? 0

  return UseInterceptors(
    FileInterceptor(fieldName, {
      // Do not add `parts`: busboy counts the closing boundary and would reject a valid upload.
      limits: {
        fileSize: options.maxSize,
        files: 1,
        fields: maxFields,
        ...(maxFields === 0 && { fieldSize: 0 }),
      },
    }),
    new FileToBodyInterceptor(fieldName),
  )
}

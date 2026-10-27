import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Request } from 'express'
import { Observable } from 'rxjs'
import { detectMimeType } from './mime-type.util'

interface MultipartFileOptions {
  maxSize: number
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
          type: detectMimeType(buffer),
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
 * `maxSize` stops Multer before an oversized file is loaded in memory (413).
 *
 * @example
 * @MultipartFile('coverImage', { maxSize: 10 * 1024 * 1024 })
 * async create(@TypedMultipartBody(createPostSchema) body: CreatePostInput) {}
 */
export function MultipartFile(fieldName: string, options: MultipartFileOptions) {
  return UseInterceptors(
    FileInterceptor(fieldName, { limits: { fileSize: options.maxSize } }),
    new FileToBodyInterceptor(fieldName),
  )
}

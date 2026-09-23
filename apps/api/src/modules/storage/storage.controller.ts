import {
  TypedController,
  TypedMultipartBody,
  TypedParam,
  TypedRoute,
} from '@lonestone/nzoth/server'
import {
  BadRequestException,
  HttpCode,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiProduces,
} from '@nestjs/swagger'
import { config } from '../../config/env.config'
import { AuthGuard } from '../auth/auth.guard'
import {
  StoredObject,
  storageKeySchema,
  storageMultipartSchema,
  storedObjectSchema,
} from './contracts/storage.contract'
import { StorageService } from './storage.service'

const SWAGGER_API_PARAMETERS = 'swagger/apiParameters'

function ApiStorageUploadBody(): MethodDecorator {
  const apiBody = ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })

  return (target, propertyKey, descriptor): void => {
    if (!descriptor?.value) return

    const existingParameters: unknown = Reflect.getMetadata(
      SWAGGER_API_PARAMETERS,
      descriptor.value,
    )
    const parameters = Array.isArray(existingParameters)
      ? existingParameters.filter((parameter: unknown) => !isBodyParameter(parameter))
      : []

    Reflect.defineMetadata(SWAGGER_API_PARAMETERS, parameters, descriptor.value)
    apiBody(target, propertyKey, descriptor)
  }
}

function isBodyParameter(value: unknown): boolean {
  return typeof value === 'object' && value !== null && 'in' in value && value.in === 'body'
}

@TypedController('storage', undefined, {
  tags: ['Storage'],
})
@UseGuards(AuthGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @ApiStorageUploadBody()
  @ApiConsumes('multipart/form-data')
  @TypedRoute.Post('', storedObjectSchema, { status: 201 })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: config.storage.maxUploadSize,
      },
    }),
  )
  async upload(
    @TypedMultipartBody(storageMultipartSchema) _body: Record<string, never>,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<StoredObject> {
    if (!file) throw new BadRequestException('A file is required')

    return this.storageService.upload({
      body: file.buffer,
      filename: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size,
    })
  }

  @TypedRoute.Get(':key')
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({
    description: 'Stored object contents',
    content: {
      'application/octet-stream': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async download(@TypedParam('key', storageKeySchema) key: string): Promise<StreamableFile> {
    const object = await this.storageService.download(key)

    return new StreamableFile(object.body, {
      type: object.contentType,
      length: object.size,
      disposition: `attachment; filename*=UTF-8''${this.encodeFilename(object.filename)}`,
    })
  }

  @TypedRoute.Delete(':key')
  @ApiNoContentResponse()
  @HttpCode(204)
  async delete(@TypedParam('key', storageKeySchema) key: string): Promise<void> {
    await this.storageService.delete(key)
  }

  private encodeFilename(filename: string): string {
    return encodeURIComponent(filename).replaceAll("'", '%27')
  }
}

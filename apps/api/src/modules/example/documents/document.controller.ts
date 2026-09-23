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
import { config } from '../../../config/env.config'
import { LoggedInBetterAuthSession } from '../../auth/auth.config'
import { Session } from '../../auth/auth.decorator'
import { AuthGuard } from '../../auth/auth.guard'
import {
  DocumentResponse,
  documentIdSchema,
  documentMultipartSchema,
  documentSchema,
} from './contracts/document.contract'
import { DocumentMapper } from './document.mapper'
import { DocumentService } from './document.service'

const SWAGGER_API_PARAMETERS = 'swagger/apiParameters'

function ApiDocumentUploadBody(): MethodDecorator {
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

@TypedController('documents', undefined, {
  tags: ['Documents'],
})
@UseGuards(AuthGuard)
export class DocumentController {
  constructor(
    private readonly documentService: DocumentService,
    private readonly documentMapper: DocumentMapper,
  ) {}

  @ApiDocumentUploadBody()
  @ApiConsumes('multipart/form-data')
  @TypedRoute.Post('', documentSchema, { status: 201 })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: config.storage.maxUploadSize,
      },
    }),
  )
  async upload(
    @Session() session: LoggedInBetterAuthSession,
    @TypedMultipartBody(documentMultipartSchema) _body: Record<string, never>,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<DocumentResponse> {
    if (!file) throw new BadRequestException('A file is required')

    const document = await this.documentService.upload(session.user.id, {
      body: file.buffer,
      filename: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size,
    })

    return this.documentMapper.toResponse(document)
  }

  @TypedRoute.Get(':id')
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({
    description: 'Document contents',
    content: {
      'application/octet-stream': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async download(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('id', documentIdSchema) documentId: string,
  ): Promise<StreamableFile> {
    const { document, object } = await this.documentService.download(documentId, session.user.id)

    return new StreamableFile(object.body, {
      type: document.mimeType,
      length: document.size,
      disposition: `attachment; filename*=UTF-8''${this.encodeFilename(document.filename)}`,
    })
  }

  @TypedRoute.Delete(':id')
  @ApiNoContentResponse()
  @HttpCode(204)
  async delete(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('id', documentIdSchema) documentId: string,
  ): Promise<void> {
    await this.documentService.delete(documentId, session.user.id)
  }

  private encodeFilename(filename: string): string {
    return encodeURIComponent(filename).replaceAll("'", '%27')
  }
}

import { Injectable } from '@nestjs/common'
import { DocumentResponse } from './contracts/document.contract'
import { Document } from './document.entity'

@Injectable()
export class DocumentMapper {
  toResponse(document: Document): DocumentResponse {
    return {
      id: document.id,
      filename: document.filename,
      mimeType: document.mimeType,
      size: document.size,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    }
  }
}

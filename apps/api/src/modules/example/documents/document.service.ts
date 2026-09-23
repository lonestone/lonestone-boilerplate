import { EntityManager } from '@mikro-orm/core'
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common'
import { User } from '../../auth/auth.entity'
import { StorageDownload, StorageService, StorageUpload } from '../../storage/storage.service'
import { Document } from './document.entity'

export interface DocumentDownload {
  document: Document
  object: StorageDownload
}

@Injectable()
export class DocumentService {
  constructor(
    private readonly em: EntityManager,
    private readonly storageService: StorageService,
  ) {}

  async upload(ownerId: string, file: StorageUpload): Promise<Document> {
    const storedObject = await this.storageService.upload(file)
    const document = new Document()
    document.owner = this.em.getReference(User, ownerId)
    document.storageKey = storedObject.key
    document.filename = storedObject.filename
    document.mimeType = storedObject.mimeType
    document.size = storedObject.size

    try {
      this.em.persist(document)
      await this.em.flush()
    } catch (error: unknown) {
      await this.deleteCompensatingObject(storedObject.key, error)
    }

    return document
  }

  async download(documentId: string, ownerId: string): Promise<DocumentDownload> {
    const document = await this.findOwnedDocument(documentId, ownerId)
    const object = await this.storageService.download(document.storageKey)

    return { document, object }
  }

  async delete(documentId: string, ownerId: string): Promise<void> {
    const document = await this.findOwnedDocument(documentId, ownerId)
    await this.storageService.delete(document.storageKey)
    this.em.remove(document)
    await this.em.flush()
  }

  private async findOwnedDocument(documentId: string, ownerId: string): Promise<Document> {
    const document = await this.em.findOne(Document, {
      id: documentId,
      owner: ownerId,
    })
    if (!document) throw new NotFoundException('Document not found')

    return document
  }

  private async deleteCompensatingObject(
    storageKey: string,
    persistenceError: unknown,
  ): Promise<never> {
    try {
      await this.storageService.delete(storageKey)
    } catch (cleanupError: unknown) {
      throw new InternalServerErrorException('Failed to save document metadata', {
        cause: new AggregateError(
          [persistenceError, cleanupError],
          'Document metadata save and object cleanup failed',
        ),
      })
    }

    throw new InternalServerErrorException('Failed to save document metadata', {
      cause: persistenceError,
    })
  }
}

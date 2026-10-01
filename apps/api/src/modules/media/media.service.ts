import { EntityManager } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'
import { StorageService, StorageUpload } from '../storage/storage.service'
import { Media } from './media.entity'

@Injectable()
export class MediaService {
  constructor(
    private readonly em: EntityManager,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Uploads the bytes and persists a new `Media` without flushing, so the caller
   * can attach it to its own entity and commit both in one transaction.
   */
  async create(upload: StorageUpload): Promise<Media> {
    const storedObject = await this.storageService.upload(upload)

    const media = new Media()
    media.storageKey = storedObject.key
    media.filename = storedObject.filename
    media.mimeType = storedObject.mimeType
    media.size = storedObject.size
    this.em.persist(media)

    return media
  }

  async deleteObject(storageKey: string): Promise<void> {
    await this.storageService.delete(storageKey)
  }
}

import { EntityManager } from '@mikro-orm/core'
import { Injectable, Logger } from '@nestjs/common'
import { StorageService, StorageUpload } from '../storage/storage.service'
import { Media } from './media.entity'

export interface ReplaceMediaInput {
  current?: Media
  upload: StorageUpload
  /** Points the owning entity to the new media. Called before the flush. */
  attach: (media: Media) => void
}

export interface RemoveMediaInput {
  media: Media
  /** Unlinks the media from its owning entity. Called before the flush. */
  detach: () => void
}

/**
 * Owns the lifecycle of stored files: a `Media` row and its object in storage never drift apart.
 * Domain modules call it instead of touching `StorageService` directly.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name)

  constructor(
    private readonly em: EntityManager,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Uploads a new file, attaches it and flushes. If the flush fails, the new object is
   * deleted and the original error is rethrown. Once committed, the previous object is deleted.
   * Leave `current` empty to attach a first file.
   */
  async replace({ current, upload, attach }: ReplaceMediaInput): Promise<Media> {
    const media = await this.create(upload)

    try {
      attach(media)
      if (current) this.em.remove(current)
      await this.em.flush()
    } catch (error: unknown) {
      await this.deleteObjectQuietly(media.storageKey)
      throw error
    }

    if (current) await this.deleteObjectQuietly(current.storageKey)
    return media
  }

  /** Detaches the media, deletes its row, then deletes its object once the row is gone. */
  async remove({ media, detach }: RemoveMediaInput): Promise<void> {
    detach()
    this.em.remove(media)
    await this.em.flush()
    await this.deleteObjectQuietly(media.storageKey)
  }

  private async create(upload: StorageUpload): Promise<Media> {
    const storedObject = await this.storageService.upload(upload)

    const media = new Media()
    media.storageKey = storedObject.key
    media.filename = storedObject.filename
    media.mimeType = storedObject.mimeType
    media.size = storedObject.size
    this.em.persist(media)

    return media
  }

  // An orphan object only costs storage; failing the request would undo nothing.
  private async deleteObjectQuietly(storageKey: string): Promise<void> {
    try {
      await this.storageService.delete(storageKey)
    } catch (error: unknown) {
      this.logger.error(`Failed to delete storage object ${storageKey}`, error)
    }
  }
}

import { EntityManager } from '@mikro-orm/core'
import { Injectable, Logger } from '@nestjs/common'
import { StorageService } from '../storage/storage.service'
import { Media } from './media.entity'

/**
 * Keeps a `Media` row and its object in the bucket together. The owner's service decides when to
 * flush, so it can save the media with its other changes or inside a transaction.
 *
 * Typical use, in the owner's service:
 *
 * @example
 * const previous = post.coverImage
 * const media = this.mediaService.attach(await this.mediaService.upload(file))
 * post.coverImage = media
 * if (previous) this.em.remove(previous)
 *
 * try {
 *   await this.em.flush()
 * } catch (error) {
 *   await this.mediaService.remove(media)
 *   throw error
 * }
 *
 * // The old file goes only once its row is gone, so a failed save keeps the image working.
 * if (previous) await this.mediaService.remove(previous)
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name)

  constructor(
    private readonly em: EntityManager,
    private readonly storageService: StorageService,
  ) {}

  /** Stores the file in the bucket and returns its `Media`, not yet persisted. */
  async upload(file: File): Promise<Media> {
    const storedObject = await this.storageService.upload({
      body: Buffer.from(await file.arrayBuffer()),
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    })

    const media = new Media()
    media.storageKey = storedObject.key
    media.filename = storedObject.filename
    media.mimeType = storedObject.mimeType
    media.size = storedObject.size
    return media
  }

  /** Persists the media, without flushing, so it is saved with its owner. */
  attach(media: Media): Media {
    this.em.persist(media)
    return media
  }

  /**
   * Deletes the media's file from the bucket. Call it in a `catch` after a failed flush, or after
   * the flush that removed the media row. It never throws, so it cannot hide the caller's error:
   * a failure only leaves an orphan in the bucket, and is logged.
   */
  async remove(media: Media): Promise<void> {
    try {
      await this.storageService.delete(media.storageKey)
    } catch (error: unknown) {
      this.logger.error(`Failed to delete storage object ${media.storageKey}`, error)
    }
  }
}

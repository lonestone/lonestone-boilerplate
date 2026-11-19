import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { StorageService } from '../storage/storage.service'
import { MediaResponse } from './contracts/media.contract'
import { Media } from './media.entity'

@Injectable()
export class MediaMapper {
  constructor(private readonly storageService: StorageService) {}

  async toMedia(media: Media): Promise<MediaResponse> {
    const { url, expiresAt } = await this.storageService.getSignedUrl(media.storageKey, {
      filename: media.filename,
      mimeType: media.mimeType,
    })

    return {
      id: media.id,
      filename: media.filename,
      mimeType: media.mimeType,
      size: media.size,
      url,
      expiresAt,
    }
  }

  /**
   * Maps an optional relation. Returns undefined while storage is disabled, so a list that
   * contains one file still loads.
   */
  async toOptionalMedia(media?: Media): Promise<MediaResponse | undefined> {
    if (!media) return undefined

    try {
      return await this.toMedia(media)
    } catch (error: unknown) {
      if (error instanceof ServiceUnavailableException) return undefined
      throw error
    }
  }
}

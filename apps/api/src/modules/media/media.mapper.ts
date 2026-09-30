import { Injectable } from '@nestjs/common'
import { MediaResponse } from './contracts/media.contract'
import { Media } from './media.entity'

@Injectable()
export class MediaMapper {
  toMedia(media: Media): MediaResponse {
    return {
      id: media.id,
      filename: media.filename,
      mimeType: media.mimeType,
      size: media.size,
    }
  }
}

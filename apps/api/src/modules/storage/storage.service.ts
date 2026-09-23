import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common'
import { IStorageProvider, STORAGE_PROVIDER } from './providers/storage-provider.interface'

export interface StorageUpload {
  body: Buffer
  filename: string
  mimeType: string
  size: number
}

export interface StoredObject {
  key: string
  filename: string
  mimeType: string
  size: number
}

export interface StorageDownload {
  body: Readable
  contentType: string
  filename: string
  size: number
}

@Injectable()
export class StorageService {
  constructor(
    @Inject(STORAGE_PROVIDER)
    private readonly provider: IStorageProvider,
    @Inject('STORAGE_BUCKET')
    private readonly bucket: string,
  ) {}

  async upload(file: StorageUpload): Promise<StoredObject> {
    const key = randomUUID()

    try {
      await this.provider.upload({
        bucket: this.bucket,
        key,
        body: file.body,
        contentType: file.mimeType,
        filename: file.filename,
        size: file.size,
      })
    } catch (error: unknown) {
      throw new InternalServerErrorException('Failed to upload object', { cause: error })
    }

    return {
      key,
      filename: file.filename,
      mimeType: file.mimeType,
      size: file.size,
    }
  }

  async download(key: string): Promise<StorageDownload> {
    try {
      const object = await this.provider.download(this.bucket, key)
      if (!object) throw new NotFoundException('Stored object not found')
      return object
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error
      throw new InternalServerErrorException('Failed to download object', { cause: error })
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.provider.delete(this.bucket, key)
    } catch (error: unknown) {
      throw new InternalServerErrorException('Failed to delete object', { cause: error })
    }
  }
}

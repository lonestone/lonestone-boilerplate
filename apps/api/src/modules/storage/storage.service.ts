import { randomUUID } from 'node:crypto'
import { Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common'
import { StoredObject } from './contracts/storage.contract'
import {
  IStorageProvider,
  STORAGE_PROVIDER,
  StorageProviderObject,
} from './providers/storage-provider.interface'

export interface StorageUpload {
  body: Buffer
  filename: string
  mimeType: string
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
    } catch {
      throw new InternalServerErrorException('Failed to upload object')
    }

    return {
      key,
      filename: file.filename,
      mimeType: file.mimeType,
      size: file.size,
    }
  }

  async download(key: string): Promise<StorageProviderObject> {
    try {
      const object = await this.provider.download(this.bucket, key)
      if (!object) throw new NotFoundException('Stored object not found')
      return object
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error
      throw new InternalServerErrorException('Failed to download object')
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.provider.delete(this.bucket, key)
    } catch {
      throw new InternalServerErrorException('Failed to delete object')
    }
  }
}

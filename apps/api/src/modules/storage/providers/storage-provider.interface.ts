import { Readable } from 'node:stream'

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER')

export interface StorageProviderUploadInput {
  bucket: string
  key: string
  body: Buffer
  contentType: string
  filename: string
  size: number
}

export interface StorageProviderObject {
  body: Readable
  contentType: string
  filename: string
  size: number
}

export interface IStorageProvider {
  upload(input: StorageProviderUploadInput): Promise<void>
  download(bucket: string, key: string): Promise<StorageProviderObject | null>
  delete(bucket: string, key: string): Promise<void>
}

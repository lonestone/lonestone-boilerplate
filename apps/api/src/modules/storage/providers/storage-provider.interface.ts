export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER')

export class StorageUnavailableError extends Error {
  constructor() {
    super('File storage is disabled')
    this.name = StorageUnavailableError.name
  }
}

export interface StorageProviderUploadInput {
  key: string
  body: Buffer
  contentType: string
  filename: string
  size: number
}

export interface SignedUrlOptions {
  filename: string
  mimeType: string
}

export interface SignedUrl {
  url: string
  expiresAt: Date
}

export interface IStorageProvider {
  upload(input: StorageProviderUploadInput): Promise<void>
  delete(key: string): Promise<void>
  getSignedUrl(key: string, options: SignedUrlOptions): Promise<SignedUrl>
}

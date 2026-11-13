import { IStorageProvider, SignedUrl, StorageUnavailableError } from './storage-provider.interface'

export class DisabledStorageProvider implements IStorageProvider {
  async upload(): Promise<void> {
    throw new StorageUnavailableError()
  }

  async delete(): Promise<void> {
    throw new StorageUnavailableError()
  }

  async getSignedUrl(): Promise<SignedUrl> {
    throw new StorageUnavailableError()
  }
}

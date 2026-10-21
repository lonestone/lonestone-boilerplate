import {
  IStorageProvider,
  SignedUrl,
  StorageProviderObject,
  StorageUnavailableError,
} from './storage-provider.interface'

export class DisabledStorageProvider implements IStorageProvider {
  upload(): Promise<void> {
    throw new StorageUnavailableError()
  }

  download(): Promise<StorageProviderObject | null> {
    throw new StorageUnavailableError()
  }

  delete(): Promise<void> {
    throw new StorageUnavailableError()
  }

  getSignedUrl(): Promise<SignedUrl> {
    throw new StorageUnavailableError()
  }
}
